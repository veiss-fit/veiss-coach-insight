import { supabase } from '@/lib/supabase';
import { chunk } from '@/lib/utils';
import { addDays, differenceInCalendarWeeks, format, startOfWeek, subWeeks } from 'date-fns';
import { isValidExerciseName } from '@/lib/athleteSummaryUtils';
import { canonicalizeExerciseName } from '@/lib/targetEvaluation';
import { summarizeSession, type RepInput } from '@/lib/metrics/setVelocitySummary';
import { summarizeTimingSession } from '@/lib/metrics/repTiming';
import { rosterSignals, type ExerciseSignalInput, type RosterSignals } from '@/lib/metrics/rosterSignals';
import { velocityVsBaseline } from '@/lib/metrics/velocityVsBaseline';

/**
 * Roster-wide 8-week metric series, fetched with a fixed number of batched
 * queries regardless of roster size (one sessions query, a paginated reps
 * query, one plans query) — deliberately NOT per-player (see the N+1 problem
 * in calculatePlayerStats).
 */

const WEEKS = 8;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
/** Max ids per `.in(...)` call — a long UUID list risks blowing the URL length limit. */
const ID_CHUNK_SIZE = 200;

export interface RosterAthleteMetrics {
  playerId: string;
  /** Weekly avg velocity, oldest → newest. Weeks without sessions carry the previous value.
   *  TODO(cleanup): only read by the Storybook-only AthleteCard/AthleteTable, no production caller currently. */
  velSeries: number[];
  /** Sessions logged per week, oldest → newest.
   *  TODO(cleanup): only read by the Storybook-only AthleteCard/AthleteTable, no production caller currently. */
  sessSeries: number[];
  sessionsThisWeek: number;
  /** Mean session velocity of the last 3 sessions.
   *  TODO(cleanup): only read by the Storybook-only AthleteCard/AthleteTable, no production caller currently. */
  recentVel: number | null;
  /** recentVel minus the mean of the sessions before those 3 (null when < 5 sessions).
   *  TODO(cleanup): only read by the Storybook-only AthleteCard/AthleteTable, no production caller currently. */
  velDelta: number | null;
  /** Within-session velocity drop-off %, correctly partitioned per exercise
   *  (first-set-avg vs last-set-avg per exercise, averaged across exercises),
   *  of the most recent qualifying session. Matches athleteSummaryUtils'
   *  sessionVelocityDropoff — see CALCULATIONS.md.
   *  TODO(cleanup): only read by rosterFlags.flagsFor, whose only caller (AthleteCard) is Storybook-only. */
  dropPct: number | null;
  lastSessionDate: string | null;
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
  /** Plans assigned/completed this week, same plan rows as attSeries's last bucket. */
  assignedThisWeek: number;
  completedThisWeek: number;
  /** Completion pt change vs last week (attSeries last two buckets), null when either is missing. */
  planCompletionDeltaPct: number | null;
  /** SP-08: team total lbs lifted (load x reps) per week, oldest first. */
  volumeSeries: { label: string; totalLbs: number }[];
  /** Share of this window's reps that carry a recorded weight and so count toward volumeSeries. */
  volumeCoveragePct: number;
}

export interface ExerciseBaselineChange {
  playerId: string;
  /** Percent vs the athlete's own 6-week baseline (SP-04 Tier B, pooled/not load-matched), signed. */
  change: number;
  /** The latest session compared against the baseline, for opening/highlighting it elsewhere. */
  sessionId: string | null;
}

export interface LeaderboardValueRow {
  playerId: string;
  value: number;
}

export interface TeamPrEntry {
  playerId: string;
  exercise: string;
  /** Heaviest verified set load for this athlete + exercise in the window, unit not verified (assumed lbs). */
  load: number;
  /** Fastest valid rep at that load, m/s. */
  best: number;
  /** ISO date of the session that holds the record. */
  date: string;
}

export interface RosterMetricsResult {
  perPlayer: Map<string, RosterAthleteMetrics>;
  /** SP-12 row signals per player id. A player with no usable data has no entry. */
  signalsByPlayer: Map<string, RosterSignals>;
  team: RosterTeamMetrics;
  /** SP-04 Tier B, team-wide: every exercise trained in the 6-week window, and each athlete's
   *  change vs their own baseline on it. Unsorted; the caller orders worst-first. */
  exerciseBaseline: {
    exercises: string[];
    /** The exercise with the most athletes with a valid comparison, or "" when none. */
    defaultExercise: string;
    byExercise: Map<string, ExerciseBaselineChange[]>;
  };
  /** Data for RosterViewSwitcher's Leaderboard tab. Unsorted; the caller orders best-first. */
  leaderboard: {
    /** Best single-rep velocity per athlete, per exercise, in the 8-week window. */
    velocityByExercise: Map<string, LeaderboardValueRow[]>;
    /** Total sessions logged per athlete in the 8-week window. */
    sessionsByPlayer: Map<string, number>;
    /** Plan completion % per athlete over the 8-week window (players with 0 assigned plans have no entry). */
    completionByPlayer: Map<string, number>;
    /** Exercises an athlete ranks #1 in by best velocity, per player id. */
    firstPlaceCounts: Map<string, number>;
  };
  /** Data for RosterViewSwitcher's Training grid tab: sessions per athlete, per day of the current week. */
  trainingGrid: {
    /** Short labels, Mon..Sun of the current week, e.g. "Mon 15". */
    dayLabels: string[];
    countsByDayByPlayer: Map<string, number[]>;
  };
  /** Data for RosterViewSwitcher's Team PRs tab: one entry per athlete + exercise PR in the 8-week window. Unsorted. */
  teamPrs: TeamPrEntry[];
}

const EMPTY_TEAM: RosterTeamMetrics = {
  velSeries: [],
  attSeries: [],
  avgAttendance: 0,
  sessionsThisWeek: 0,
  sessionsLastWeek: 0,
  sessionsByDay: [0, 0, 0, 0, 0, 0, 0],
  assignedThisWeek: 0,
  completedThisWeek: 0,
  planCompletionDeltaPct: null,
  volumeSeries: [],
  volumeCoveragePct: 0,
};

const EMPTY_EXERCISE_BASELINE: RosterMetricsResult['exerciseBaseline'] = {
  exercises: [],
  defaultExercise: '',
  byExercise: new Map(),
};

const EMPTY_LEADERBOARD: RosterMetricsResult['leaderboard'] = {
  velocityByExercise: new Map(),
  sessionsByPlayer: new Map(),
  completionByPlayer: new Map(),
  firstPlaceCounts: new Map(),
};

const EMPTY_TRAINING_GRID: RosterMetricsResult['trainingGrid'] = {
  dayLabels: [],
  countsByDayByPlayer: new Map(),
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
  rep_number: number | null;
  weight: number | null;
  concentric_duration_s: number | null;
  eccentric_duration_s: number | null;
}

interface PlanRow {
  date: string;
  is_completed: boolean | null;
  player_id: string;
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
 * TODO(cleanup): feeds RosterAthleteMetrics.dropPct, only read by the Storybook-only AthleteCard.
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

/**
 * SP-12 signals for one athlete from their sessions (oldest first). Per exercise
 * (canonical name), the latest session that contains it is compared with the
 * earlier ones; rosterSignals applies the baseline window itself. Also returns
 * the raw SP-04 Tier B change per exercise (pooled, not load-matched) so the
 * caller can aggregate it team-wide, independent of the biggestDrop reduction.
 */
function computeSignals(
  sessions: { id: string; date: string; reps: RepRow[] }[]
): { signals: RosterSignals | null; perExercise: { exercise: string; change: number; sessionId: string | null }[] } {
  const byExercise = new Map<string, { id: string; date: string; reps: RepInput[] }[]>();
  for (const s of sessions) {
    const perExercise = new Map<string, RepInput[]>();
    for (const r of s.reps) {
      if (!isValidExerciseName(r.exercise_name) || r.set_number == null || r.rep_number == null) continue;
      const name = canonicalizeExerciseName(r.exercise_name);
      const list = perExercise.get(name) ?? [];
      list.push({
        exercise_name: name,
        set_number: r.set_number,
        rep_number: r.rep_number,
        average_rep_speed: r.average_rep_speed,
        weight: r.weight,
        concentric_duration_s: r.concentric_duration_s,
        eccentric_duration_s: r.eccentric_duration_s,
      });
      perExercise.set(name, list);
    }
    for (const [name, reps] of perExercise) {
      const list = byExercise.get(name) ?? [];
      list.push({ id: s.id, date: s.date, reps });
      byExercise.set(name, list);
    }
  }

  const inputs: ExerciseSignalInput[] = [];
  const perExercise: { exercise: string; change: number; sessionId: string | null }[] = [];
  for (const [exercise, list] of byExercise) {
    const summaries = list.map((x) => ({
      sessionId: x.id,
      date: x.date,
      sets: summarizeSession(x.reps)[0].sets,
      timing: summarizeTimingSession(x.reps)[0].sets,
    }));
    const latest = summaries[summaries.length - 1];
    const history = summaries.slice(0, -1).map(({ date, sets }) => ({ date, sets }));
    inputs.push({ exercise, latest, history });

    // SP-04 Tier B (pooled): same call rosterSignals makes internally, kept
    // here too since it only surfaces the single worst exercise, not every one.
    const baseline = velocityVsBaseline(latest.sets, latest.date, history, { pooled: true });
    if (baseline.ok) perExercise.push({ exercise, change: baseline.change, sessionId: latest.sessionId });
  }
  const result = rosterSignals(inputs);
  return { signals: result.biggestDrop || result.slowestTempo ? result : null, perExercise };
}

/**
 * Best single-rep velocity per exercise (any weight) and the heaviest-load PR per exercise
 * (max weight, fastest valid rep at that weight), from one athlete's sessions. Reuses the same
 * reps already fetched for computeSignals — no extra query.
 */
function computeVelocityAndPRs(
  sessions: { id: string; date: string; reps: RepRow[] }[]
): {
  bestVelByExercise: Map<string, number>;
  prByExercise: Map<string, { load: number; best: number; date: string }>;
} {
  const bestVelByExercise = new Map<string, number>();
  const prByExercise = new Map<string, { load: number; best: number; date: string }>();
  for (const s of sessions) {
    for (const r of s.reps) {
      if (!isValidExerciseName(r.exercise_name)) continue;
      if (r.average_rep_speed == null || r.average_rep_speed <= 0) continue;
      const name = canonicalizeExerciseName(r.exercise_name);

      const curBest = bestVelByExercise.get(name);
      if (curBest == null || r.average_rep_speed > curBest) bestVelByExercise.set(name, r.average_rep_speed);

      if (r.weight != null && r.weight > 0) {
        const pr = prByExercise.get(name);
        if (!pr || r.weight > pr.load || (r.weight === pr.load && r.average_rep_speed > pr.best)) {
          prByExercise.set(name, { load: r.weight, best: r.average_rep_speed, date: s.date });
        }
      }
    }
  }
  return { bestVelByExercise, prByExercise };
}

export async function getRosterMetrics(
  players: Array<{ id: string; user_id: string | null }>
): Promise<RosterMetricsResult> {
  const perPlayer = new Map<string, RosterAthleteMetrics>();
  const signalsByPlayer = new Map<string, RosterSignals>();
  const withUser = players.filter((p) => p.user_id);
  if (withUser.length === 0) {
    return {
      perPlayer, signalsByPlayer, team: EMPTY_TEAM, exerciseBaseline: EMPTY_EXERCISE_BASELINE,
      leaderboard: EMPTY_LEADERBOARD, trainingGrid: EMPTY_TRAINING_GRID, teamPrs: [],
    };
  }

  const userIds = withUser.map((p) => p.user_id as string);
  const playerByUser = new Map(withUser.map((p) => [p.user_id as string, p.id]));

  const now = new Date();
  const windowStart = startOfWeek(subWeeks(now, WEEKS - 1), { weekStartsOn: 1 });

  // ── 1. Sessions for the whole roster, chunked past the .in(...) id-list limit ─
  const sessionResults = await Promise.all(
    chunk(userIds, ID_CHUNK_SIZE).map((ids) =>
      supabase
        .from('sessions')
        .select('id, user_id, created_at')
        .in('user_id', ids)
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: true })
    )
  );

  const sessionsError = sessionResults.find((r) => r.error)?.error;
  if (sessionsError) {
    console.error('rosterMetrics: sessions query failed', sessionsError);
    return {
      perPlayer, signalsByPlayer, team: EMPTY_TEAM, exerciseBaseline: EMPTY_EXERCISE_BASELINE,
      leaderboard: EMPTY_LEADERBOARD, trainingGrid: EMPTY_TRAINING_GRID, teamPrs: [],
    };
  }

  const sessionRows = sessionResults.flatMap((r) => (r.data ?? [])) as SessionRow[];

  // ── 2. Reps for those sessions, chunked by id-list size and paginated past the 1000-row cap ─
  const fetchRepsForSessionIds = async (ids: string[]): Promise<RepRow[]> => {
    const collected: RepRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('session_id, exercise_name, average_rep_speed, set_number, rep_number, weight, concentric_duration_s, eccentric_duration_s')
        .in('session_id', ids)
        .order('id', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (repsError) {
        console.error('rosterMetrics: reps query failed', repsError);
        break;
      }
      collected.push(...((reps ?? []) as RepRow[]));
      if (!reps || reps.length < PAGE_SIZE) break;
    }
    return collected;
  };

  const repsBySession = new Map<string, RepRow[]>();
  if (sessionRows.length > 0) {
    const sessionIds = sessionRows.map((s) => s.id);
    const repChunks = await Promise.all(chunk(sessionIds, ID_CHUNK_SIZE).map(fetchRepsForSessionIds));
    for (const rep of repChunks.flat()) {
      const list = repsBySession.get(rep.session_id);
      if (list) list.push(rep);
      else repsBySession.set(rep.session_id, [rep]);
    }
  }

  // ── 3. Plans for the attendance series, chunked past the .in(...) id-list limit ─
  const playerIds = withUser.map((p) => p.id);
  const planResults = await Promise.all(
    chunk(playerIds, ID_CHUNK_SIZE).map((ids) =>
      supabase
        .from('workout_plans')
        .select('date, is_completed, player_id')
        .in('player_id', ids)
        .eq('is_template', false)
        .gte('date', windowStart.toISOString().slice(0, 10))
        .lte('date', now.toISOString().slice(0, 10))
    )
  );

  const planRows = planResults.flatMap((r) => (r.data ?? [])) as PlanRow[];

  // ── Per-session aggregates ────────────────────────────────────────────────
  interface SessionAgg {
    userId: string;
    createdAt: Date;
    weekIdx: number; // 0 = oldest bucket … WEEKS-1 = current week
    avgVel: number | null;
    dropPct: number | null;
  }

  const weekIdxOf = (d: Date) =>
    WEEKS - 1 - differenceInCalendarWeeks(now, d, { weekStartsOn: 1 });

  const sessionAggs: SessionAgg[] = sessionRows.map((s) => {
    const createdAt = new Date(s.created_at);
    const reps = repsBySession.get(s.id) ?? [];
    const validReps = reps.filter((r) => r.average_rep_speed != null && r.average_rep_speed > 0);
    const avgVel = mean(validReps.map((r) => r.average_rep_speed as number));
    const dropPct = computeDropPctFromRows(reps);

    return { userId: s.user_id, createdAt, weekIdx: weekIdxOf(createdAt), avgVel, dropPct };
  });

  // ── Per-player series ─────────────────────────────────────────────────────
  const exerciseBaselineByExercise = new Map<string, ExerciseBaselineChange[]>();
  const velocityByExercise = new Map<string, LeaderboardValueRow[]>();
  const teamPrs: TeamPrEntry[] = [];
  const sessionsByPlayer = new Map<string, number>();
  const completionByPlayer = new Map<string, number>();
  const countsByDayByPlayer = new Map<string, number[]>();
  for (const p of withUser) {
    const own = sessionAggs
      .filter((a) => a.userId === p.user_id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const weeklyVels: (number | null)[] = Array.from({ length: WEEKS }, () => null);
    const sessSeries = Array.from({ length: WEEKS }, () => 0);
    for (let w = 0; w < WEEKS; w++) {
      const inWeek = own.filter((a) => a.weekIdx === w);
      sessSeries[w] = inWeek.length;
      weeklyVels[w] = mean(inWeek.map((a) => a.avgVel).filter((v): v is number => v != null));
    }

    const sessionVels = own.map((a) => a.avgVel).filter((v): v is number => v != null);
    const recentVel = mean(sessionVels.slice(-3));
    const priorVel = sessionVels.length >= 5 ? mean(sessionVels.slice(0, -3)) : null;
    const velDelta =
      recentVel != null && priorVel != null ? +(recentVel - priorVel).toFixed(2) : null;

    const ownSessionsWithReps = sessionRows
      .filter((s) => s.user_id === p.user_id)
      .map((s) => ({ id: s.id, date: s.created_at, reps: repsBySession.get(s.id) ?? [] }));

    const { signals, perExercise } = computeSignals(ownSessionsWithReps);
    if (signals) signalsByPlayer.set(p.id, signals);
    for (const { exercise, change, sessionId } of perExercise) {
      const list = exerciseBaselineByExercise.get(exercise) ?? [];
      list.push({ playerId: p.id, change, sessionId });
      exerciseBaselineByExercise.set(exercise, list);
    }

    const { bestVelByExercise, prByExercise } = computeVelocityAndPRs(ownSessionsWithReps);
    for (const [exercise, value] of bestVelByExercise) {
      const list = velocityByExercise.get(exercise) ?? [];
      list.push({ playerId: p.id, value });
      velocityByExercise.set(exercise, list);
    }
    for (const [exercise, pr] of prByExercise) {
      teamPrs.push({ playerId: p.id, exercise, load: pr.load, best: pr.best, date: pr.date });
    }

    if (own.length > 0) sessionsByPlayer.set(p.id, own.length);
    const ownPlans = planRows.filter((pl) => pl.player_id === p.id);
    if (ownPlans.length > 0) {
      completionByPlayer.set(p.id, Math.round((ownPlans.filter((pl) => pl.is_completed).length / ownPlans.length) * 100));
    }

    const countsByDay = [0, 0, 0, 0, 0, 0, 0];
    for (const a of own) {
      if (a.weekIdx === WEEKS - 1) countsByDay[(a.createdAt.getDay() + 6) % 7]++;
    }
    countsByDayByPlayer.set(p.id, countsByDay);

    const lastWithDrop = [...own].reverse().find((a) => a.dropPct != null);

    perPlayer.set(p.id, {
      playerId: p.id,
      velSeries: fillSeries(weeklyVels),
      sessSeries,
      sessionsThisWeek: sessSeries[WEEKS - 1],
      recentVel: recentVel != null ? +recentVel.toFixed(2) : null,
      velDelta,
      dropPct: lastWithDrop?.dropPct ?? null,
      lastSessionDate: own.length ? own[own.length - 1].createdAt.toISOString() : null,
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

  // Plan completion this week, same rows attWeekly buckets into week WEEKS-1.
  const plansThisWeek = planRows.filter((pl) => weekIdxOf(new Date(pl.date + 'T12:00:00')) === WEEKS - 1);
  const assignedThisWeek = plansThisWeek.length;
  const completedThisWeek = plansThisWeek.filter((pl) => pl.is_completed).length;
  const filledAtt = fillSeries(attWeekly);
  const planCompletionDeltaPct =
    filledAtt.length >= 2 ? filledAtt[filledAtt.length - 1] - filledAtt[filledAtt.length - 2] : null;

  // Weekly team volume (SP-08): sum of weight across all reps in each week's
  // sessions. sessionAggs and sessionRows share index order (aggs is a
  // straight .map over rows), so this reuses each session's weekIdx without
  // a second pass over the date math.
  const weekIdxBySession = new Map(sessionRows.map((s, i) => [s.id, sessionAggs[i].weekIdx]));
  const volumeByWeek = Array.from({ length: WEEKS }, () => 0);
  let repsInWindow = 0;
  let repsWithWeight = 0;
  for (const [sessionId, reps] of repsBySession) {
    const weekIdx = weekIdxBySession.get(sessionId);
    for (const r of reps) {
      repsInWindow++;
      if (r.weight != null && r.weight > 0) {
        repsWithWeight++;
        if (weekIdx != null) volumeByWeek[weekIdx] += r.weight;
      }
    }
  }
  const volumeSeries = volumeByWeek.map((totalLbs, w) => ({
    label: format(startOfWeek(subWeeks(now, WEEKS - 1 - w), { weekStartsOn: 1 }), 'MMM d'),
    totalLbs,
  }));
  const volumeCoveragePct = repsInWindow > 0 ? Math.round((repsWithWeight / repsInWindow) * 100) : 0;

  const exercisesByCount = [...exerciseBaselineByExercise.entries()].sort((a, b) => b[1].length - a[1].length);
  const exerciseBaseline = {
    exercises: exercisesByCount.map(([exercise]) => exercise).sort((a, b) => a.localeCompare(b)),
    defaultExercise: exercisesByCount[0]?.[0] ?? '',
    byExercise: exerciseBaselineByExercise,
  };

  const firstPlaceCounts = new Map<string, number>();
  for (const rows of velocityByExercise.values()) {
    const max = Math.max(...rows.map((r) => r.value));
    for (const r of rows) {
      if (r.value === max) firstPlaceCounts.set(r.playerId, (firstPlaceCounts.get(r.playerId) ?? 0) + 1);
    }
  }

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const dayLabels = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'EEE d'));

  return {
    perPlayer,
    signalsByPlayer,
    exerciseBaseline,
    leaderboard: { velocityByExercise, sessionsByPlayer, completionByPlayer, firstPlaceCounts },
    trainingGrid: { dayLabels, countsByDayByPlayer },
    teamPrs,
    team: {
      velSeries: fillSeries(teamWeeklyVels).map((v) => +v.toFixed(2)),
      attSeries: filledAtt,
      avgAttendance,
      sessionsThisWeek: sessionAggs.filter((a) => a.weekIdx === WEEKS - 1).length,
      sessionsLastWeek: sessionAggs.filter((a) => a.weekIdx === WEEKS - 2).length,
      sessionsByDay,
      assignedThisWeek,
      completedThisWeek,
      planCompletionDeltaPct,
      volumeSeries,
      volumeCoveragePct,
    },
  };
}
