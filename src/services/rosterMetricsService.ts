import { supabase } from '@/lib/supabase';
import { differenceInCalendarWeeks, startOfWeek, subWeeks } from 'date-fns';
import { isValidExerciseName } from '@/lib/athleteSummaryUtils';
import {
  TargetsReached, ZERO_TARGETS, addTargets, evaluateRepsAgainstTargets,
  buildTargetsForExercises, mergeTargetMaps, PlanExerciseLike, ExerciseTargetRange,
  canonicalizeExerciseName,
} from '@/lib/targetEvaluation';

/**
 * Roster-wide 8-week metric series, fetched with a fixed number of batched
 * queries regardless of roster size (one sessions query, a paginated reps
 * query, one plans query) — deliberately NOT per-player (see the N+1 problem
 * in calculatePlayerStats).
 */

const WEEKS = 8;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

export interface RosterAthleteMetrics {
  playerId: string;
  /** Weekly avg velocity, oldest → newest. Weeks without sessions carry the previous value.
   *  Kept for sorting/flagging (rosterFlags.ts, Index.tsx sort-by), but no longer
   *  shown as a headline number anywhere — see targetsReached below and
   *  CALCULATIONS.md. */
  velSeries: number[];
  /** Sessions logged per week, oldest → newest. */
  sessSeries: number[];
  sessionsThisWeek: number;
  /** Mean session velocity of the last 3 sessions. */
  recentVel: number | null;
  /** recentVel minus the mean of the sessions before those 3 (null when < 5 sessions). */
  velDelta: number | null;
  /** Within-session velocity drop-off %, correctly partitioned per exercise
   *  (first-set-avg vs last-set-avg per exercise, averaged across exercises),
   *  of the most recent qualifying session. Matches athleteSummaryUtils'
   *  sessionVelocityDropoff — see CALCULATIONS.md. */
  dropPct: number | null;
  lastSessionDate: string | null;
  /** Reps landing inside their exercise's coach-set target range, over the
   *  8-week window. withTarget === 0 means no targeted exercise was trained —
   *  render "No targets set", not 0%. */
  targetsReached: TargetsReached;
  /** Weekly targets-reached %, oldest → newest, null for weeks with no
   *  targeted reps (not carried forward — unlike velSeries, a gap here is
   *  real information: nothing was evaluable that week). */
  targetsReachedSeries: (number | null)[];
}

export interface RosterTeamMetrics {
  velSeries: number[];
  /** Weekly plan-completion % (workout_plans completed / assigned). */
  attSeries: number[];
  /** Overall plan-completion % across the whole 8-week window — the SAME
   *  underlying plan rows as attSeries (sum completed / sum assigned, not a
   *  per-week average), so the "Avg attendance" KPI's headline number and its
   *  trend/sparkline are always one consistent pipeline. See CALCULATIONS.md
   *  Part 1 item 3. */
  avgAttendance: number;
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  /** Sessions logged Mon..Sun of the current week. */
  sessionsByDay: number[];
  targetsReached: TargetsReached;
  targetsReachedSeries: number[];
}

export interface RosterMetricsResult {
  perPlayer: Map<string, RosterAthleteMetrics>;
  team: RosterTeamMetrics;
}

const EMPTY_TEAM: RosterTeamMetrics = {
  velSeries: [],
  attSeries: [],
  avgAttendance: 0,
  sessionsThisWeek: 0,
  sessionsLastWeek: 0,
  sessionsByDay: [0, 0, 0, 0, 0, 0, 0],
  targetsReached: ZERO_TARGETS,
  targetsReachedSeries: [],
};

interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
}

interface RepRow {
  session_id: string;
  exercise_name: string | null;
  average_rep_speed: number | null;
  set_number: number | null;
}

interface PlanRow {
  player_id: string;
  date: string;
  is_completed: boolean | null;
  exercises: unknown;
}

/** Carry-forward fill so sparklines have a continuous line; leading gaps take the first real value. */
const fillSeries = (series: (number | null)[]): number[] => {
  const first = series.find((v) => v != null);
  if (first == null) return [];
  let prev = first;
  return series.map((v) => {
    if (v != null) prev = v;
    return prev;
  });
};

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;

/**
 * Same partitioning athleteSummaryUtils.sessionVelocityDropoff uses (per
 * exercise: first-set avg vs last-set avg, averaged across qualifying
 * exercises), reimplemented over raw {exercise_name, set_number,
 * average_rep_speed} rows instead of the already-shaped SessionData that
 * function expects — the roster-wide query here can't afford a per-player
 * sessionsService fetch. Keep this in sync with athleteSummaryUtils.ts if
 * that logic ever changes.
 */
function computeDropPctFromRows(reps: RepRow[]): number | null {
  // Grouped by CANONICAL name so confirmed raw-name collisions (Squat/Squats,
  // rdl) don't fragment one exercise's drop-off into unrelated buckets.
  const byExercise = new Map<string, RepRow[]>();
  for (const r of reps) {
    if (!isValidExerciseName(r.exercise_name)) continue;
    if (r.average_rep_speed == null || r.average_rep_speed <= 0) continue;
    const key = canonicalizeExerciseName(r.exercise_name);
    const list = byExercise.get(key);
    if (list) list.push(r); else byExercise.set(key, [r]);
  }

  const perExercise: number[] = [];
  for (const exReps of byExercise.values()) {
    const setNums = [...new Set(exReps.map((r) => r.set_number).filter((n): n is number => n != null))].sort((a, b) => a - b);
    if (setNums.length < 2) continue;
    const setAvg = (n: number) => mean(exReps.filter((r) => r.set_number === n).map((r) => r.average_rep_speed as number));
    const first = setAvg(setNums[0]);
    const last = setAvg(setNums[setNums.length - 1]);
    if (first == null || last == null || first === 0) continue;
    perExercise.push(((first - last) / first) * 100);
  }

  if (perExercise.length === 0) return null;
  const result = mean(perExercise) as number;
  return Math.round(Math.min(100, Math.max(-100, result)));
}

export async function getRosterMetrics(
  players: Array<{ id: string; user_id: string | null }>
): Promise<RosterMetricsResult> {
  const perPlayer = new Map<string, RosterAthleteMetrics>();
  const withUser = players.filter((p) => p.user_id);
  if (withUser.length === 0) return { perPlayer, team: EMPTY_TEAM };

  const userIds = withUser.map((p) => p.user_id as string);
  const playerByUser = new Map(withUser.map((p) => [p.user_id as string, p.id]));

  const now = new Date();
  const windowStart = startOfWeek(subWeeks(now, WEEKS - 1), { weekStartsOn: 1 });

  // ── 1. Sessions for the whole roster in one query ─────────────────────────
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, user_id, created_at')
    .in('user_id', userIds)
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: true });

  if (sessionsError) {
    console.error('rosterMetrics: sessions query failed', sessionsError);
    return { perPlayer, team: EMPTY_TEAM };
  }

  const sessionRows = (sessions ?? []) as SessionRow[];

  // ── 2. Reps for those sessions, paginated past the 1000-row cap ──────────
  const repsBySession = new Map<string, RepRow[]>();
  if (sessionRows.length > 0) {
    const sessionIds = sessionRows.map((s) => s.id);
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('session_id, exercise_name, average_rep_speed, set_number')
        .in('session_id', sessionIds)
        .order('id', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (repsError) {
        console.error('rosterMetrics: reps query failed', repsError);
        break;
      }
      for (const rep of (reps ?? []) as RepRow[]) {
        const list = repsBySession.get(rep.session_id);
        if (list) list.push(rep);
        else repsBySession.set(rep.session_id, [rep]);
      }
      if (!reps || reps.length < PAGE_SIZE) break;
    }
  }

  // ── 3. Plans for attendance AND target lookups, in one query ─────────────
  const playerIds = withUser.map((p) => p.id);
  const { data: plans } = await (supabase as any)
    .from('workout_plans')
    .select('player_id, date, is_completed, exercises')
    .in('player_id', playerIds)
    .eq('is_template', false)
    .gte('date', windowStart.toISOString().slice(0, 10))
    .lte('date', now.toISOString().slice(0, 10)) as { data: PlanRow[] | null };

  const planRows = plans ?? [];

  // player_id → date → { exercise name → target range }
  const targetsByPlayerDate = new Map<string, Map<string, Map<string, ExerciseTargetRange>>>();
  for (const plan of planRows) {
    const exercises = Array.isArray(plan.exercises) ? (plan.exercises as PlanExerciseLike[]) : [];
    const dayMap = buildTargetsForExercises(exercises);
    if (dayMap.size === 0) continue;
    let byDate = targetsByPlayerDate.get(plan.player_id);
    if (!byDate) { byDate = new Map(); targetsByPlayerDate.set(plan.player_id, byDate); }
    const existing = byDate.get(plan.date);
    byDate.set(plan.date, existing ? mergeTargetMaps([existing, dayMap]) : dayMap);
  }

  // ── Per-session aggregates ────────────────────────────────────────────────
  interface SessionAgg {
    userId: string;
    playerId: string | null;
    createdAt: Date;
    dateStr: string;
    weekIdx: number; // 0 = oldest bucket … WEEKS-1 = current week
    avgVel: number | null;
    dropPct: number | null;
    targets: TargetsReached;
  }

  const weekIdxOf = (d: Date) =>
    WEEKS - 1 - differenceInCalendarWeeks(now, d, { weekStartsOn: 1 });

  const sessionAggs: SessionAgg[] = sessionRows.map((s) => {
    const createdAt = new Date(s.created_at);
    const dateStr = s.created_at.slice(0, 10);
    const playerId = playerByUser.get(s.user_id) ?? null;
    const reps = repsBySession.get(s.id) ?? [];
    const validReps = reps.filter((r) => r.average_rep_speed != null && r.average_rep_speed > 0);
    const avgVel = mean(validReps.map((r) => r.average_rep_speed as number));
    const dropPct = computeDropPctFromRows(reps);

    const dayTargets = playerId ? targetsByPlayerDate.get(playerId)?.get(dateStr) : undefined;
    const targets = dayTargets
      ? evaluateRepsAgainstTargets(
          validReps.map((r) => ({ exerciseName: r.exercise_name ?? '', velocity: r.average_rep_speed as number })),
          dayTargets
        )
      : ZERO_TARGETS;

    return { userId: s.user_id, playerId, createdAt, dateStr, weekIdx: weekIdxOf(createdAt), avgVel, dropPct, targets };
  });

  // ── Per-player series ─────────────────────────────────────────────────────
  for (const p of withUser) {
    const own = sessionAggs
      .filter((a) => a.userId === p.user_id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const weeklyVels: (number | null)[] = Array.from({ length: WEEKS }, () => null);
    const sessSeries = Array.from({ length: WEEKS }, () => 0);
    const targetsWeekly: TargetsReached[] = Array.from({ length: WEEKS }, () => ({ ...ZERO_TARGETS }));
    for (let w = 0; w < WEEKS; w++) {
      const inWeek = own.filter((a) => a.weekIdx === w);
      sessSeries[w] = inWeek.length;
      weeklyVels[w] = mean(inWeek.map((a) => a.avgVel).filter((v): v is number => v != null));
      targetsWeekly[w] = inWeek.reduce((acc, a) => addTargets(acc, a.targets), { ...ZERO_TARGETS });
    }

    const sessionVels = own.map((a) => a.avgVel).filter((v): v is number => v != null);
    const recentVel = mean(sessionVels.slice(-3));
    const priorVel = sessionVels.length >= 5 ? mean(sessionVels.slice(0, -3)) : null;
    const velDelta =
      recentVel != null && priorVel != null ? +(recentVel - priorVel).toFixed(2) : null;

    const lastWithDrop = [...own].reverse().find((a) => a.dropPct != null);

    const targetsTotal = own.reduce((acc, a) => addTargets(acc, a.targets), { ...ZERO_TARGETS });
    const targetsReachedSeries = targetsWeekly.map((t) => (t.withTarget > 0 ? Math.round((t.inTarget / t.withTarget) * 100) : null));

    perPlayer.set(p.id, {
      playerId: p.id,
      velSeries: fillSeries(weeklyVels),
      sessSeries,
      sessionsThisWeek: sessSeries[WEEKS - 1],
      recentVel: recentVel != null ? +recentVel.toFixed(2) : null,
      velDelta,
      dropPct: lastWithDrop?.dropPct ?? null,
      lastSessionDate: own.length ? own[own.length - 1].createdAt.toISOString() : null,
      targetsReached: targetsTotal,
      targetsReachedSeries,
    });
  }

  // ── Team aggregates ───────────────────────────────────────────────────────
  const teamWeeklyVels: (number | null)[] = Array.from({ length: WEEKS }, (_, w) =>
    mean(
      sessionAggs
        .filter((a) => a.weekIdx === w && a.avgVel != null)
        .map((a) => a.avgVel as number)
    )
  );

  const attWeekly: (number | null)[] = Array.from({ length: WEEKS }, () => null);
  for (let w = 0; w < WEEKS; w++) {
    const inWeek = planRows.filter((pl) => weekIdxOf(new Date(pl.date + 'T12:00:00')) === w);
    if (inWeek.length > 0) {
      attWeekly[w] = Math.round((inWeek.filter((pl) => pl.is_completed).length / inWeek.length) * 100);
    }
  }
  // Overall = sum(completed) / sum(assigned) across the whole window — the same
  // plan rows attWeekly buckets by week, so the KPI's headline number and its
  // sparkline/delta can never disagree about what they're both measuring.
  const avgAttendance = planRows.length > 0
    ? Math.round((planRows.filter((pl) => pl.is_completed).length / planRows.length) * 100)
    : 0;

  const sessionsByDay = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
  for (const a of sessionAggs) {
    if (a.weekIdx === WEEKS - 1) {
      sessionsByDay[(a.createdAt.getDay() + 6) % 7]++;
    }
  }

  const teamTargetsWeekly: TargetsReached[] = Array.from({ length: WEEKS }, (_, w) =>
    sessionAggs.filter((a) => a.weekIdx === w).reduce((acc, a) => addTargets(acc, a.targets), { ...ZERO_TARGETS })
  );
  const teamTargetsTotal = sessionAggs.reduce((acc, a) => addTargets(acc, a.targets), { ...ZERO_TARGETS });
  const teamTargetsSeries = fillSeries(
    teamTargetsWeekly.map((t) => (t.withTarget > 0 ? Math.round((t.inTarget / t.withTarget) * 100) : null))
  );

  return {
    perPlayer,
    team: {
      velSeries: fillSeries(teamWeeklyVels).map((v) => +v.toFixed(2)),
      attSeries: fillSeries(attWeekly),
      avgAttendance,
      sessionsThisWeek: sessionAggs.filter((a) => a.weekIdx === WEEKS - 1).length,
      sessionsLastWeek: sessionAggs.filter((a) => a.weekIdx === WEEKS - 2).length,
      sessionsByDay,
      targetsReached: teamTargetsTotal,
      targetsReachedSeries: teamTargetsSeries,
    },
  };
}
