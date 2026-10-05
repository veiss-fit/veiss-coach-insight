import { format, startOfWeek, subWeeks } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { sessionPlacementIso, VISIBLE_SESSION_FILTER } from '@/services/sessionsService';
import { getAttendanceSummary, WorkoutPlanLike, WorkoutSessionLike } from '@/lib/workoutAttendance';
import { chunk } from '@/lib/utils';
import { Database } from '@/types/database';

/** Same window as rosterMetricsService's WEEKS, so the roster table's per-athlete
 *  attendance matches the team tile and leaderboard (A4.3: one attendance definition). */
const ATTENDANCE_WINDOW_WEEKS = 8;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
/** Max ids per `.in(...)` call — a long UUID list risks blowing the URL length limit. */
const ID_CHUNK_SIZE = 200;

type Player = Database['public']['Tables']['players']['Row'];
type Team = Database['public']['Tables']['groups']['Row'];
type Session = Database['public']['Tables']['sessions']['Row'];
type Rep = Database['public']['Tables']['reps']['Row'];
type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];

export interface PlayerWithStats extends Player {
  team?: Team;
  avgVelocity: number;
  attendance: number;
  loadRec: string;

  // ✅ PHASE 22 NEW METRICS
  avgROM: number;
  avgTempo: number;
  lastWorkout: { name: string; date: string } | null;

  // For compatibility with existing UI components
  group: string;
  name: string;
}

/**
 * Update a team's details
 */
export const updateTeam = async (
  teamId: string,
  updates: { name?: string }
): Promise<void> => {
  // Throws rather than returning a boolean so callers can inspect the real
  // Postgres error (via handleError) instead of guessing at a cause.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('groups')
    .update(updates)
    .eq('id', teamId) as { error: unknown };

  if (error) throw error;
};

/**
 * Delete a team
 * Note: This might fail if players are linked to it, depending on your DB constraints
 */
export const deleteTeam = async (teamId: string): Promise<void> => {
  // Throws rather than returning a boolean: the caller previously had to guess why
  // a delete failed and always blamed "players still assigned", when an RLS
  // rejection or network error produced the identical result (§2.4).
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', teamId);

  if (error) throw error;
};

/**
 * Resolve the coaches.id (DB primary key) for a given auth user ID.
 * Returns null if no coach record exists yet.
 */
export const getCoachId = async (coachUserId: string): Promise<string | null> => {
  const { data } = await (supabase as any)
    .from('coaches')
    .select('id')
    .eq('user_id', coachUserId)
    .maybeSingle() as { data: { id: string } | null };
  return data?.id ?? null;
};

/**
 * Return the group IDs owned by a given coach (auth user ID).
 * Returns empty array if coach has no record or no groups — never leaks other coaches' players.
 */
export const getCoachTeamIds = async (coachUserId: string): Promise<string[]> => {
  const coachId = await getCoachId(coachUserId);
  if (!coachId) return []; // No coach record = no groups = no players

  const { data: groups } = await (supabase as any)
    .from('groups')
    .select('id')
    .eq('coach_id', coachId);

  return groups?.map((g: { id: string }) => g.id) ?? [];
};

export interface CoachGroup {
  id: string;
  name: string;
}

/**
 * All groups owned by a coach (auth user ID), including ones with zero
 * players assigned — unlike deriving groups from the player list, which
 * silently drops any group nobody has been assigned to yet.
 */
/**
 * Cheap {id, user_id} refs for a coach's roster, scoped by team — used to kick
 * off roster-series queries (getRosterMetrics) in parallel with the heavier
 * per-player stats fetch instead of waiting on it first.
 */
export const getCoachPlayerRefs = async (coachUserId: string): Promise<Array<{ id: string; user_id: string | null }>> => {
  const teamIds = await getCoachTeamIds(coachUserId);
  if (teamIds.length === 0) return [];

  const { data, error } = await supabase
    .from('players')
    .select('id, user_id')
    .in('team_id', teamIds) as { data: Array<{ id: string; user_id: string | null }> | null; error: unknown };

  if (error) {
    console.error('Error fetching player refs:', error);
    return [];
  }
  return data ?? [];
};

export const getCoachGroups = async (coachUserId: string): Promise<CoachGroup[]> => {
  const coachId = await getCoachId(coachUserId);
  if (!coachId) return [];

  const { data } = await (supabase as any)
    .from('groups')
    .select('id, name')
    .eq('coach_id', coachId)
    .order('name') as { data: CoachGroup[] | null };

  return data ?? [];
};

/**
 * Fetch players scoped to a coach's groups, with computed stats.
 * Pass the auth user ID — internally resolves team IDs first.
 */
export const getPlayersWithStatsByCoach = async (coachUserId: string): Promise<PlayerWithStats[]> => {
  const teamIds = await getCoachTeamIds(coachUserId);
  return getAllPlayersWithStats(teamIds);
};

/**
 * Fetch players filtered by team IDs (or all players when teamIds is undefined).
 */
export const getAllPlayersWithStats = async (teamIds?: string[]): Promise<PlayerWithStats[]> => {
  // If an explicit empty list is passed, the coach has no groups → return nothing
  if (teamIds !== undefined && teamIds.length === 0) return [];

  try {
    let query = (supabase as any).from('players').select('*, groups!players_team_id_fkey(*)');
    if (teamIds && teamIds.length > 0) {
      query = query.in('team_id', teamIds);
    }
    const { data: players, error } = await query.order('full_name', { ascending: true });

    if (error) throw error;
    if (!players || players.length === 0) return [];

    const statsByPlayer = await getPlayerStatsBatch(players.map((p: any) => ({ id: p.id, user_id: p.user_id })));

    return players.map((player: any) => ({
      ...player,
      name: player.full_name,
      group: player.groups?.name || '',
      team: player.groups,
      ...(statsByPlayer.get(player.id) ?? EMPTY_STATS),
    })) as PlayerWithStats[];
  } catch (error) {
    console.error('Error in getAllPlayersWithStats:', error);
    throw error;
  }
};

export interface PlayerStats {
  avgVelocity: number;
  attendance: number;
  loadRec: string;
  avgROM: number;
  avgTempo: number;
  lastWorkout: { name: string; date: string } | null;
}

const EMPTY_STATS: PlayerStats = { avgVelocity: 0, attendance: 0, loadRec: 'New', avgROM: 0, avgTempo: 0, lastWorkout: null };

type PlanRow = Pick<WorkoutPlan, 'player_id' | 'date' | 'title' | 'is_completed' | 'session_id'>;
/** `created_at` is replaced by the placement instant (see `sessionPlacementIso`) right after the fetch. */
type SessionRow = Pick<Session, 'id' | 'user_id' | 'created_at' | 'name'> & { started_at?: string | null };
type RepRow = Pick<Rep, 'session_id' | 'average_rep_speed' | 'rom_mm' | 'concentric_duration_s'>;

/**
 * Calculate stats (avg velocity/ROM/tempo, attendance, load rec, last workout)
 * for many players at once — a fixed number of batched queries (one plans
 * query, one sessions query, a paginated reps query, all chunked `.in(...)`)
 * regardless of roster size, instead of calculatePlayerStats' 3-4 queries
 * PER player (an N+1 pattern — was the slowest part of loading the roster).
 * Same numbers as the old per-player version for the same inputs.
 */
export const getPlayerStatsBatch = async (
  players: Array<{ id: string; user_id: string | null }>
): Promise<Map<string, PlayerStats>> => {
  const result = new Map<string, PlayerStats>();
  if (players.length === 0) return result;

  const playerIds = players.map((p) => p.id);
  const windowStart = startOfWeek(subWeeks(new Date(), ATTENDANCE_WINDOW_WEEKS - 1), { weekStartsOn: 1 });
  const windowStartMs = windowStart.getTime();

  // 1. Workout plans for every player, 8-week window, chunked by id-list size.
  const plansByPlayer = new Map<string, WorkoutPlanLike[]>();
  const planChunks = await Promise.all(
    chunk(playerIds, ID_CHUNK_SIZE).map((ids) =>
      supabase
        .from('workout_plans')
        .select('player_id, date, title, is_completed, session_id')
        .in('player_id', ids)
        .eq('is_template', false)
        .gte('date', format(windowStart, 'yyyy-MM-dd'))
    )
  );
  for (const { data } of planChunks) {
    ((data ?? []) as PlanRow[]).forEach((plan) => {
      const list = plansByPlayer.get(plan.player_id) ?? [];
      list.push({ date: plan.date, title: plan.title, is_completed: plan.is_completed, session_id: plan.session_id });
      plansByPlayer.set(plan.player_id, list);
    });
  }

  // 2. Sessions for every player. A session's user_id can match either
  //    players.id or players.user_id (legacy data quirk, see D4 in
  //    KNOWN_BUGS.md) — same dual-match the old per-player version did.
  const ownerToPlayer = new Map<string, string>();
  players.forEach((p) => {
    ownerToPlayer.set(p.id, p.id);
    if (p.user_id) ownerToPlayer.set(p.user_id, p.id);
  });
  const ownerIds = Array.from(ownerToPlayer.keys());

  const sessionsByPlayer = new Map<string, SessionRow[]>();
  if (ownerIds.length > 0) {
    const sessionChunks = await Promise.all(
      chunk(ownerIds, ID_CHUNK_SIZE).map((ids) =>
        supabase.from('sessions').select('id, user_id, created_at, started_at, name').in('user_id', ids).or(VISIBLE_SESSION_FILTER)
      )
    );
    for (const { data } of sessionChunks) {
      ((data ?? []) as SessionRow[]).forEach((row) => {
        const s = { ...row, created_at: sessionPlacementIso(row.started_at ?? null, row.created_at) };
        const playerId = s.user_id ? ownerToPlayer.get(s.user_id) : undefined;
        if (!playerId) return;
        const list = sessionsByPlayer.get(playerId) ?? [];
        list.push(s);
        sessionsByPlayer.set(playerId, list);
      });
    }
  }

  // 3. Reps for every player's last-30-days sessions, paginated past the 1000-row cap.
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const sessionIdToPlayer = new Map<string, string>();
  const recentSessionIds: string[] = [];
  sessionsByPlayer.forEach((sessions, playerId) => {
    sessions.forEach((s) => {
      if (s.created_at && new Date(s.created_at).getTime() >= thirtyDaysAgoMs) {
        sessionIdToPlayer.set(s.id, playerId);
        recentSessionIds.push(s.id);
      }
    });
  });

  const fetchRepsForSessionIds = async (ids: string[]): Promise<RepRow[]> => {
    const collected: RepRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await supabase
        .from('reps')
        .select('session_id, average_rep_speed, rom_mm, concentric_duration_s')
        .in('session_id', ids)
        .not('average_rep_speed', 'is', null)
        .order('id', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) {
        console.error('getPlayerStatsBatch: reps query failed', error);
        break;
      }
      const rows = (data ?? []) as RepRow[];
      collected.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
    return collected;
  };

  const repsByPlayer = new Map<string, RepRow[]>();
  if (recentSessionIds.length > 0) {
    const repChunks = await Promise.all(chunk(recentSessionIds, ID_CHUNK_SIZE).map(fetchRepsForSessionIds));
    for (const rep of repChunks.flat()) {
      const playerId = sessionIdToPlayer.get(rep.session_id);
      if (!playerId) continue;
      const list = repsByPlayer.get(playerId) ?? [];
      list.push(rep);
      repsByPlayer.set(playerId, list);
    }
  }

  // 4. Assemble per-player stats from the batched data above.
  players.forEach((player) => {
    const allSessions = sessionsByPlayer.get(player.id) ?? [];

    const lastSession = allSessions
      .filter((s) => s.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
    const lastWorkout = lastSession ? { name: lastSession.name ?? '', date: lastSession.created_at } : null;

    const recentSessions = allSessions.filter((s) => s.created_at && new Date(s.created_at).getTime() >= thirtyDaysAgoMs);

    const reps = repsByPlayer.get(player.id) ?? [];
    let avgVelocity = 0;
    let avgROM = 0;
    let avgTempo = 0;
    if (reps.length > 0) {
      const totalV = reps.reduce((sum, r) => sum + (Number(r.average_rep_speed) || 0), 0);
      const totalR = reps.reduce((sum, r) => sum + (Number(r.rom_mm) || 0), 0);
      const totalC = reps.reduce((sum, r) => sum + (Number(r.concentric_duration_s) || 0), 0);
      avgVelocity = parseFloat((totalV / reps.length).toFixed(2));
      avgROM = Math.round(totalR / reps.length);
      avgTempo = parseFloat((totalC / reps.length).toFixed(2));
    }

    const attendanceSummary = getAttendanceSummary(
      (plansByPlayer.get(player.id) ?? []) as WorkoutPlanLike[],
      allSessions
        .filter((session) => session.created_at && new Date(session.created_at).getTime() >= windowStartMs)
        .map((session) => ({
          id: session.id,
          date: session.created_at.slice(0, 10),
          name: session.name,
          createdAt: session.created_at,
        })) as WorkoutSessionLike[]
    );
    const attendance = attendanceSummary.attendancePercent;

    // Load recommendation — velocity-based threshold (no coach-set target
    // exists to evaluate against). "increase"/"decrease" prefixes are what
    // classifyLoadRec (src/lib/targetEvaluation.ts) buckets on for the chip
    // and the roster donut, so keep new label text starting with those words.
    let loadRec = 'Maintain';
    if (avgVelocity > 0) {
      if (avgVelocity > 0.85) loadRec = 'Increase Load';
      else if (avgVelocity < 0.40) loadRec = 'Decrease Load (Fatigue)';
    } else if (recentSessions.length === 0) {
      loadRec = 'New';
    }

    result.set(player.id, { avgVelocity, attendance, loadRec, avgROM, avgTempo, lastWorkout });
  });

  return result;
};

/**
 * Stats for a single player — thin wrapper over getPlayerStatsBatch.
 */
export const calculatePlayerStats = async (playerId: string, userId: string | null = null): Promise<PlayerStats> => {
  const batch = await getPlayerStatsBatch([{ id: playerId, user_id: userId }]);
  return batch.get(playerId) ?? EMPTY_STATS;
};

/**
 * Assign an existing player to a team.
 * Pass coachUserId to enforce that the target team belongs to this coach.
 */
export const assignPlayerToTeam = async (
  playerId: string,
  teamId: string | null,
  coachUserId?: string
): Promise<boolean> => {
  // App-layer scope check: verify the target team belongs to this coach
  if (coachUserId && teamId) {
    const coachTeamIds = await getCoachTeamIds(coachUserId);
    if (!coachTeamIds.includes(teamId)) {
      console.error('assignPlayerToTeam: target team does not belong to this coach');
      return false;
    }
  }

  try {
    const { error } = await (supabase as any)
      .from('players')
      .update({ team_id: teamId })
      .eq('id', playerId) as { error: any };

    if (error) {
      console.error('Error assigning player to team:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in assignPlayerToTeam:', error);
    throw error;
  }
};

/**
 * Get players for group reassignment, scoped to the coach's own groups.
 */
export const getAllPlayersForAssignment = async (teamIds?: string[]): Promise<Array<{
  id: string;
  full_name: string;
  team_id: string | null;
  current_team_name?: string;
}>> => {
  // Never return players outside this coach's groups
  if (!teamIds || teamIds.length === 0) return [];

  try {
    const query = (supabase as any)
      .from('players')
      .select('id, full_name, team_id, groups!players_team_id_fkey(name)')
      .in('team_id', teamIds)
      .order('full_name', { ascending: true });

    const { data: players, error } = await query;

    if (error) {
      console.error('Error fetching players:', error);
      throw error;
    }

    return (players as any[])?.map(p => ({
      id: p.id as string,
      full_name: p.full_name as string,
      team_id: p.team_id as string | null,
      current_team_name: (p.groups?.name as string) || null,
    })) || [];
  } catch (error) {
    console.error('Error in getAllPlayersForAssignment:', error);
    throw error;
  }
};

/**
 * Get player by ID with stats
 */
export const getPlayerById = async (playerId: string): Promise<PlayerWithStats | null> => {
  try {
    const { data: player, error } = await (supabase as any)
      .from('players')
      .select('*, groups!players_team_id_fkey(*)')
      .eq('id', playerId)
      .single();

    if (error || !player) {
      console.error('Error fetching player:', error);
      return null;
    }

    const stats = await calculatePlayerStats(player.id, player.user_id);

    return {
      ...player,
      name: player.full_name,
      group: player.groups?.name || 'General',
      team: player.groups,
      ...stats,
    } as PlayerWithStats;
  } catch (error) {
    console.error('Error in getPlayerById:', error);
    return null;
  }
};

