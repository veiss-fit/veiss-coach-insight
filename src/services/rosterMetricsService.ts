import { supabase } from '@/lib/supabase';
import { differenceInCalendarWeeks, startOfWeek, subWeeks } from 'date-fns';

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
  /** Weekly avg velocity, oldest → newest. Weeks without sessions carry the previous value. */
  velSeries: number[];
  /** Sessions logged per week, oldest → newest. */
  sessSeries: number[];
  sessionsThisWeek: number;
  /** Mean session velocity of the last 3 sessions. */
  recentVel: number | null;
  /** recentVel minus the mean of the sessions before those 3 (null when < 5 sessions). */
  velDelta: number | null;
  /** Within-session velocity drop-off % of the most recent multi-set session. */
  dropPct: number | null;
  lastSessionDate: string | null;
}

export interface RosterTeamMetrics {
  velSeries: number[];
  /** Weekly plan-completion % (workout_plans completed / assigned). */
  attSeries: number[];
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  /** Sessions logged Mon..Sun of the current week. */
  sessionsByDay: number[];
}

export interface RosterMetricsResult {
  perPlayer: Map<string, RosterAthleteMetrics>;
  team: RosterTeamMetrics;
}

const EMPTY_TEAM: RosterTeamMetrics = {
  velSeries: [],
  attSeries: [],
  sessionsThisWeek: 0,
  sessionsLastWeek: 0,
  sessionsByDay: [0, 0, 0, 0, 0, 0, 0],
};

interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
}

interface RepRow {
  session_id: string;
  average_rep_speed: number | null;
  set_number: number | null;
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
        .select('session_id, average_rep_speed, set_number')
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

  // ── 3. Plans for the attendance series in one query ──────────────────────
  const playerIds = withUser.map((p) => p.id);
  const { data: plans } = await supabase
    .from('workout_plans')
    .select('date, is_completed')
    .in('player_id', playerIds)
    .eq('is_template', false)
    .gte('date', windowStart.toISOString().slice(0, 10))
    .lte('date', now.toISOString().slice(0, 10));

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
    const reps = (repsBySession.get(s.id) ?? []).filter(
      (r) => r.average_rep_speed != null && r.average_rep_speed > 0
    );
    const avgVel = mean(reps.map((r) => r.average_rep_speed as number));

    // Within-session drop-off: first-set avg vs last-set avg
    let dropPct: number | null = null;
    const setNums = [...new Set(reps.map((r) => r.set_number).filter((n): n is number => n != null))].sort((a, b) => a - b);
    if (setNums.length >= 2) {
      const setAvg = (n: number) => mean(reps.filter((r) => r.set_number === n).map((r) => r.average_rep_speed as number));
      const first = setAvg(setNums[0]);
      const last = setAvg(setNums[setNums.length - 1]);
      if (first != null && last != null && first > 0) {
        dropPct = Math.round(((first - last) / first) * 100);
      }
    }
    return { userId: s.user_id, createdAt, weekIdx: weekIdxOf(createdAt), avgVel, dropPct };
  });

  // ── Per-player series ─────────────────────────────────────────────────────
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
  const planRows = (plans ?? []) as Array<{ date: string; is_completed: boolean | null }>;
  for (let w = 0; w < WEEKS; w++) {
    const inWeek = planRows.filter((pl) => weekIdxOf(new Date(pl.date + 'T12:00:00')) === w);
    if (inWeek.length > 0) {
      attWeekly[w] = Math.round((inWeek.filter((pl) => pl.is_completed).length / inWeek.length) * 100);
    }
  }

  const sessionsByDay = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
  for (const a of sessionAggs) {
    if (a.weekIdx === WEEKS - 1) {
      sessionsByDay[(a.createdAt.getDay() + 6) % 7]++;
    }
  }

  return {
    perPlayer,
    team: {
      velSeries: fillSeries(teamWeeklyVels).map((v) => +v.toFixed(2)),
      attSeries: fillSeries(attWeekly),
      sessionsThisWeek: sessionAggs.filter((a) => a.weekIdx === WEEKS - 1).length,
      sessionsLastWeek: sessionAggs.filter((a) => a.weekIdx === WEEKS - 2).length,
      sessionsByDay,
    },
  };
}
