import { supabase } from '@/lib/supabase';
import { getAttendanceSummary, WorkoutPlanLike, WorkoutSessionLike } from '@/lib/workoutAttendance';
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
  engagement: 'High' | 'Moderate' | 'Low';
  
  // ✅ PHASE 22 NEW METRICS
  avgROM: number;   
  avgTempo: number; 

  // For compatibility with existing UI components
  sport: string;
  group: string;
  name: string;
}

/**
 * Update a team's details
 */
export const updateTeam = async (
  teamId: string, 
  updates: { name?: string; sport?: string }
): Promise<boolean> => {
  try {
    const { error } = await (supabase as any)
      .from('groups')
      .update(updates)
      .eq('id', teamId) as { error: any };

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating team:', error);
    return false;
  }
};

/**
 * Delete a team
 * Note: This might fail if players are linked to it, depending on your DB constraints
 */
export const deleteTeam = async (teamId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting team:', error);
    return false;
  }
};

/**
 * Batch rename a sport across all teams
 * Useful for fixing typos (e.g. "Socer" -> "Soccer")
 */
export const updateSportName = async (oldName: string, newName: string): Promise<boolean> => {
  try {
    const { error } = await (supabase as any)
      .from('groups')
      .update({ sport: newName })
      .eq('sport', oldName) as { error: any };

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating sport name:', error);
    return false;
  }
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
          sport: player.groups?.sport || '',
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
          sport: player.groups?.sport || '',
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
      return { avgVelocity: 0, attendance: 0, loadRec: 'New', engagement: 'Moderate' as const, avgROM: 0, avgTempo: 0 };
    }

    const { data: workoutPlans } = await supabase
      .from('workout_plans')
      .select('date, title, is_completed')
      .eq('player_id', playerId);

    const sessionOwnerIds = Array.from(new Set([playerId, player.user_id].filter(Boolean) as string[]));

    const { data: allSessions } = sessionOwnerIds.length > 0
      ? await supabase
          .from('sessions')
          .select('id, created_at, name')
          .in('user_id', sessionOwnerIds)
      : { data: [] as Pick<Session, 'id' | 'created_at' | 'name'>[] };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sessions } = sessionOwnerIds.length > 0
      ? await supabase
          .from('sessions')
          .select('id')
          .in('user_id', sessionOwnerIds)
          .gte('created_at', thirtyDaysAgo.toISOString())
      : { data: [] as Pick<Session, 'id'>[] };

    const totalSessions = sessions?.length || 0;
    let avgVelocity = 0;
    let avgROM = 0;
    let avgTempo = 0;

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      
      // Pull ALL Phase 22 metrics
      const { data: reps } = await (supabase as any)
        .from('reps')
        .select('average_rep_speed, rom_mm, concentric_duration_s, eccentric_duration_s')
        .in('session_id', sessionIds)
        .not('average_rep_speed', 'is', null) as { data: Array<{ average_rep_speed: number | null; rom_mm: number | null; concentric_duration_s: number | null }> | null };

      if (reps && reps.length > 0) {
        const totalV = reps.reduce((sum, r) => sum + (Number(r.average_rep_speed) || 0), 0);
        const totalR = reps.reduce((sum, r) => sum + (Number(r.rom_mm) || 0), 0);
        const totalC = reps.reduce((sum, r) => sum + (Number(r.concentric_duration_s) || 0), 0);

        avgVelocity = parseFloat((totalV / reps.length).toFixed(2));
        avgROM = Math.round(totalR / reps.length);
        avgTempo = parseFloat((totalC / reps.length).toFixed(2));
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

    // Improved Load Recommendation (Velocity Based Training Logic)
    let loadRec = 'Maintain';
    if (avgVelocity > 0) {
      if (avgVelocity > 0.85) loadRec = 'Increase Load (+5%)'; 
      else if (avgVelocity < 0.40) loadRec = 'Fatigue: Decrease Load (-10%)';
    }

    return {
      avgVelocity,
      attendance,
      loadRec,
      avgROM,      // NEW
      avgTempo,    // NEW
      engagement: (attendance >= 90 && avgVelocity >= 0.7) ? 'High' : 'Moderate',
    };
  } catch (error) {
    console.error(error);
    return { avgVelocity: 0, attendance: 0, loadRec: 'Error', engagement: 'Low' as const, avgROM: 0, avgTempo: 0 };
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
 * Assign an existing player to a team
 */
export const assignPlayerToTeam = async (
  playerId: string,
  teamId: string | null
): Promise<boolean> => {
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
 * Get all users (profiles) that don't have a player record yet
 */
export const getUnassignedUsers = async (): Promise<Array<{
  id: string;
  full_name: string | null;
  email?: string;
}>> => {
  try {
    // Get all profiles
    const { data: profiles, error: profilesError } = await (supabase as any)
      .from('profiles')
      .select('id, full_name, player_id')
      .eq('role', 'player') as { data: Array<{ id: string; full_name: string | null; player_id: string | null }> | null; error: any };

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    // Filter out profiles that already have player records
    const unassignedProfiles = profiles?.filter(p => !p.player_id) || [];

    // Get email from auth.users if needed (optional)
    return unassignedProfiles.map(p => ({
      id: p.id,
      full_name: p.full_name,
    }));
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
      sport: player.groups?.sport || 'Unknown',
      group: player.groups?.name || 'General',
      team: player.groups,
      ...stats,
    } as PlayerWithStats;
  } catch (error) {
    console.error('Error in getPlayerById:', error);
    return null;
  }
};

/**
 * Get unique sports from teams
 */
export const getSportsList = async (): Promise<string[]> => {
  try {
    const { data: teams, error } = await (supabase as any)
      .from('groups')
      .select('sport')
      .order('sport', { ascending: true }) as { data: Array<{ sport: string }> | null; error: any };

    if (error) {
      console.error('Error fetching sports:', error);
      return [];
    }

    // Get unique sports
    const uniqueSports = [...new Set(teams?.map(t => t.sport) || [])];
    return uniqueSports;
  } catch (error) {
    console.error('Error in getSportsList:', error);
    return [];
  }
};

