import { supabase } from '@/lib/supabase';
import { getAttendanceSummary, WorkoutPlanLike, WorkoutSessionLike } from '@/lib/workoutAttendance';
import { Database } from '@/types/database';

type Player = Database['public']['Tables']['players']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];
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
    const { error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId);

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
      .from('teams')
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
    const { error } = await supabase
      .from('teams')
      .update({ sport: newName })
      .eq('sport', oldName);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating sport name:', error);
    return false;
  }
};
/**
 * Fetch ALL players across all groups with computed stats.
 * Use this for the main dashboard — it does not filter by team_id.
 */
export const getAllPlayersWithStats = async (): Promise<PlayerWithStats[]> => {
  try {
    const { data: players, error } = await supabase
      .from('players')
      .select('*, teams(*)')
      .order('full_name', { ascending: true });

    if (error) throw error;
    if (!players || players.length === 0) return [];

    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const stats = await calculatePlayerStats(player.id);
        return {
          ...player,
          name: player.full_name,
          sport: player.teams?.sport || '',
          group: player.teams?.name || '',
          team: player.teams,
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
    const { data: players, error } = await supabase
      .from('players')
      .select('*, teams(*)')
      .in('team_id', teamIds)
      .order('full_name', { ascending: true });

    if (error) throw error;
    if (!players || players.length === 0) return [];

    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const stats = await calculatePlayerStats(player.id);
        return {
          ...player,
          name: player.full_name,
          sport: player.teams?.sport || '',
          group: player.teams?.name || '',
          team: player.teams,
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
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('user_id')
      .eq('id', playerId)
      .single();

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
      const { data: reps } = await supabase
        .from('reps')
        .select('average_rep_speed, rom_mm, concentric_duration_s, eccentric_duration_s')
        .in('session_id', sessionIds)
        .not('average_rep_speed', 'is', null);

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
    const { error } = await supabase
      .from('players')
      .update({ team_id: teamId })
      .eq('id', playerId);

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
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, player_id')
      .eq('role', 'player');

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
 * Get all existing players (for assigning to teams)
 */
export const getAllPlayersForAssignment = async (): Promise<Array<{
  id: string;
  full_name: string;
  team_id: string | null;
  current_team_name?: string;
}>> => {
  try {
    const { data: players, error } = await supabase
      .from('players')
      .select('id, full_name, team_id, teams(name)')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching players:', error);
      throw error;
    }

    return players?.map(p => ({
      id: p.id,
      full_name: p.full_name,
      team_id: p.team_id,
      current_team_name: p.teams?.name || null,
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
    const { data: player, error } = await supabase
      .from('players')
      .select('*, teams(*)')
      .eq('id', playerId)
      .single();

    if (error) {
      console.error('Error fetching player:', error);
      return null;
    }

    const stats = await calculatePlayerStats(player.id);

    return {
      ...player,
      name: player.full_name,
      sport: player.teams?.sport || 'Unknown',
      group: 'General',
      team: player.teams,
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
    const { data: teams, error } = await supabase
      .from('teams')
      .select('sport')
      .order('sport', { ascending: true });

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

