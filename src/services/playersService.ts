import { supabase } from '@/lib/supabase';
import { getAttendanceSummary, WorkoutPlanLike, WorkoutSessionLike } from '@/lib/workoutAttendance';
import {
  buildTargetsForExercises, mergeTargetMaps, computeLoadRecommendation,
  ExerciseTargetRange, ExerciseSessionMean, PlanExerciseLike, canonicalizeExerciseName,
} from '@/lib/targetEvaluation';
import { Database } from '@/types/database';

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
    .single() as { data: { id: string } | null };
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

    const playersWithStats = await Promise.all(
      players.map(async (player: any) => {
        const stats = await calculatePlayerStats(player.id);
        return {
          ...player,
          name: player.full_name,
          group: player.groups?.name || '',
          team: player.groups,
          ...stats,
        } as PlayerWithStats;
      })
    );

    return playersWithStats;
  } catch (error) {
    console.error('Error in getAllPlayersWithStats:', error);
    throw error;
  }
};

/**
 * Fetch players for a specific team (kept for backwards compatibility).
 */
export const getPlayersByTeamIds = async (teamIds: string[]): Promise<PlayerWithStats[]> => {
  try {
    const { data: players, error } = await (supabase as any)
      .from('players')
      .select('*, groups!players_team_id_fkey(*)')
      .in('team_id', teamIds)
      .order('full_name', { ascending: true });

    if (error) throw error;
    if (!players || players.length === 0) return [];

    const playersWithStats = await Promise.all(
      players.map(async (player: any) => {
        const stats = await calculatePlayerStats(player.id);
        return {
          ...player,
          name: player.full_name,
          group: player.groups?.name || '',
          team: player.groups,
          ...stats,
        } as PlayerWithStats;
      })
    );

    return playersWithStats;
  } catch (error) {
    console.error('Error in getPlayersByTeamIds:', error);
    throw error;
  }
};

/**
 * Fetch players for a single team (kept for backwards compatibility).
 */
export const getPlayersByTeamId = async (teamId: string): Promise<PlayerWithStats[]> => {
  if (!teamId) return [];
  return getPlayersByTeamIds([teamId]);
};

/**
 * Calculate player statistics from their workout data
 */export const calculatePlayerStats = async (playerId: string) => {
  try {
    const { data: player, error: playerError } = await (supabase as any)
      .from('players')
      .select('user_id')
      .eq('id', playerId)
      .single() as { data: { user_id: string | null } | null; error: any };

    if (playerError || !player) {
      return { avgVelocity: 0, attendance: 0, loadRec: 'New' as const, avgROM: 0, avgTempo: 0, lastWorkout: null };
    }

    // Full plan history (no date filter) — target_velocity_min/max live on
    // exercises here and the load recommendation needs to be able to look back
    // as far as a targeted exercise was last actually trained.
    const { data: workoutPlans } = await (supabase as any)
      .from('workout_plans')
      .select('date, title, is_completed, exercises')
      .eq('player_id', playerId) as {
        data: Array<Pick<WorkoutPlan, 'date' | 'title' | 'is_completed'> & { exercises: unknown }> | null;
      };

    const sessionOwnerIds = Array.from(new Set([playerId, player.user_id].filter(Boolean) as string[]));

    const { data: allSessions } = sessionOwnerIds.length > 0
      ? await supabase
          .from('sessions')
          .select('id, created_at, name')
          .in('user_id', sessionOwnerIds)
      : { data: [] as Pick<Session, 'id' | 'created_at' | 'name'>[] };

    const lastSession = (allSessions ?? [])
      .filter(s => s.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
    const lastWorkout = lastSession
      ? { name: lastSession.name ?? '', date: lastSession.created_at }
      : null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sessions } = sessionOwnerIds.length > 0
      ? await supabase
          .from('sessions')
          .select('id, created_at')
          .in('user_id', sessionOwnerIds)
          .gte('created_at', thirtyDaysAgo.toISOString())
      : { data: [] as Pick<Session, 'id' | 'created_at'>[] };

    let avgVelocity = 0;
    let avgROM = 0;
    let avgTempo = 0;
    const exerciseSessionMeans: ExerciseSessionMean[] = [];

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      const sessionDateById = new Map<string, string>(
        sessions.map((s): [string, string] => [s.id, s.created_at.slice(0, 10)])
      );

      // Pull ALL Phase 22 metrics, plus exercise_name/session_id so per-exercise
      // means can be grouped for the load recommendation (Part 2 #9).
      const { data: reps } = await (supabase as any)
        .from('reps')
        .select('session_id, exercise_name, average_rep_speed, rom_mm, concentric_duration_s, eccentric_duration_s')
        .in('session_id', sessionIds)
        .not('average_rep_speed', 'is', null) as {
          data: Array<{
            session_id: string; exercise_name: string | null;
            average_rep_speed: number | null; rom_mm: number | null; concentric_duration_s: number | null;
          }> | null
        };

      if (reps && reps.length > 0) {
        const totalV = reps.reduce((sum, r) => sum + (Number(r.average_rep_speed) || 0), 0);
        const totalR = reps.reduce((sum, r) => sum + (Number(r.rom_mm) || 0), 0);
        const totalC = reps.reduce((sum, r) => sum + (Number(r.concentric_duration_s) || 0), 0);

        avgVelocity = parseFloat((totalV / reps.length).toFixed(2));
        avgROM = Math.round(totalR / reps.length);
        avgTempo = parseFloat((totalC / reps.length).toFixed(2));

        // Group by (session, CANONICAL exercise) → mean velocity, for the
        // load-rec rule. Canonicalizing here (not just at match time) means
        // e.g. "Squat" and "Squats" reps logged in the same session correctly
        // merge into one "Back Squat" mean instead of staying fragmented.
        const bySessionExercise = new Map<string, number[]>();
        for (const r of reps) {
          const v = Number(r.average_rep_speed);
          if (!(v > 0) || !r.exercise_name) continue;
          const key = `${r.session_id}::${canonicalizeExerciseName(r.exercise_name)}`;
          const list = bySessionExercise.get(key);
          if (list) list.push(v); else bySessionExercise.set(key, [v]);
        }
        for (const [key, vels] of bySessionExercise) {
          // session_id is a UUID (never contains "::"), so splitting on the
          // first occurrence safely handles exercise names with punctuation.
          const sep = key.indexOf('::');
          const sessionId = key.slice(0, sep);
          const exerciseName = key.slice(sep + 2); // already canonicalized above
          const date = sessionDateById.get(sessionId);
          if (!date) continue;
          exerciseSessionMeans.push({
            sessionDate: date,
            exerciseName,
            avgVelocity: vels.reduce((a, b) => a + b, 0) / vels.length,
          });
        }
      }
    }

    const attendanceSummary = getAttendanceSummary(
      ((workoutPlans || []) as Pick<WorkoutPlan, 'date' | 'title' | 'is_completed'>[]).map((plan) => ({
        date: plan.date,
        title: plan.title,
        is_completed: plan.is_completed,
      })) as WorkoutPlanLike[],
      ((allSessions || []) as Pick<Session, 'id' | 'created_at' | 'name'>[]).map((session) => ({
        id: session.id,
        date: session.created_at.slice(0, 10),
        name: session.name,
        createdAt: session.created_at,
      })) as WorkoutSessionLike[]
    );
    const attendance = attendanceSummary.attendancePercent;

    // Load recommendation — driven entirely by coach-set target_velocity_min/max
    // on the plan exercise itself (see src/lib/targetEvaluation.ts). No fallback
    // to a global velocity threshold: an untargeted exercise reports "No target
    // set" rather than guessing.
    const targetsByDate = new Map<string, Map<string, ExerciseTargetRange>>();
    for (const plan of workoutPlans ?? []) {
      const exercises = Array.isArray(plan.exercises) ? (plan.exercises as PlanExerciseLike[]) : [];
      const dayMap = buildTargetsForExercises(exercises);
      if (dayMap.size === 0) continue;
      const existing = targetsByDate.get(plan.date);
      targetsByDate.set(plan.date, existing ? mergeTargetMaps([existing, dayMap]) : dayMap);
    }
    const loadRec = computeLoadRecommendation(exerciseSessionMeans, targetsByDate, (allSessions ?? []).length > 0);

    return {
      avgVelocity,
      attendance,
      loadRec,
      avgROM,
      avgTempo,
      lastWorkout,
    };
  } catch (error) {
    console.error(error);
    return { avgVelocity: 0, attendance: 0, loadRec: 'New' as const, avgROM: 0, avgTempo: 0, lastWorkout: null };
  }
};

// /**
//  * Add a new player
//  */
// export const addPlayer = async (playerData: {
//   full_name: string;
//   team_id: string | null;
//   jersey_number?: number | null;
//   user_id?: string | null;
// }): Promise<Player> => {
//   try {
//     const { data, error } = await supabase
//       .from('players')
//       .insert(playerData)
//       .select()
//       .single();

//     if (error) {
//       console.error('Error adding player:', error);
//       throw error;
//     }

//     return data;
//   } catch (error) {
//     console.error('Error in addPlayer:', error);
//     throw error;
//   }
// };

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
 * Get player-role profiles that haven't been linked to a player record yet,
 * scoped to players who appear in this coach's teams.
 *
 * NOTE: Truly "unassigned" players (no team_id, no player_id) have no coach
 * association by definition, so a global scan is not possible without an
 * invitation table. This function returns only profiles whose player_id links
 * to a player record owned by this coach's teams — covering the reassignment
 * use case without leaking cross-coach data.
 * TODO: Replace with a proper invitation flow if cross-coach discovery is needed.
 */
export const getUnassignedUsers = async (coachUserId: string): Promise<Array<{
  id: string;
  full_name: string | null;
}>> => {
  if (!coachUserId) return [];

  try {
    const teamIds = await getCoachTeamIds(coachUserId);
    if (teamIds.length === 0) return [];

    // Get player IDs in this coach's teams that don't yet have a linked profile
    const { data: players, error: playersError } = await (supabase as any)
      .from('players')
      .select('id, full_name, user_id')
      .in('team_id', teamIds)
      .is('user_id', null) as {
        data: Array<{ id: string; full_name: string; user_id: string | null }> | null;
        error: any;
      };

    if (playersError) {
      console.error('Error fetching unlinked players:', playersError);
      throw playersError;
    }

    return (players || []).map(p => ({ id: p.id, full_name: p.full_name }));
  } catch (error) {
    console.error('Error in getUnassignedUsers:', error);
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

    const stats = await calculatePlayerStats(player.id);

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

