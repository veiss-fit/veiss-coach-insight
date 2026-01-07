import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Player = Database['public']['Tables']['players']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];
type Session = Database['public']['Tables']['sessions']['Row'];
type Rep = Database['public']['Tables']['reps']['Row'];

export interface PlayerWithStats extends Player {
  team?: Team;
  avgVelocity: number;
  attendance: number;
  loadRec: string;
  engagement: 'High' | 'Moderate' | 'Low';
  // For compatibility with existing UI components
  sport: string;
  group: string;
  level: string;
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
 * Fetch all players for a specific team(s) that the coach manages
 */
export const getPlayersByTeamIds = async (teamIds: string[]): Promise<PlayerWithStats[]> => {
  try {
    // Fetch players with their team data
    const { data: players, error } = await supabase
      .from('players')
      .select('*, teams(*)')
      .in('team_id', teamIds)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching players:', error);
      throw error;
    }

    if (!players || players.length === 0) {
      return [];
    }

    // For each player, calculate their stats
    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const stats = await calculatePlayerStats(player.id);
        
        return {
          ...player,
          name: player.full_name, // Map to 'name' for UI compatibility
          sport: player.teams?.sport || 'Unknown',
          group: 'General', // TODO: Add position/group to players table if needed
          level: 'Varsity', // TODO: Add level to players table if needed
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
 * Fetch all players (for admins or viewing all)
 */
export const getAllPlayers = async (): Promise<PlayerWithStats[]> => {
  try {
    const { data: players, error } = await supabase
      .from('players')
      .select('*, teams(*)')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching all players:', error);
      throw error;
    }

    if (!players || players.length === 0) {
      return [];
    }

    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const stats = await calculatePlayerStats(player.id);
        
        return {
          ...player,
          name: player.full_name,
          sport: player.teams?.sport || 'Unknown',
          group: 'General',
          level: 'Varsity',
          team: player.teams,
          ...stats,
        } as PlayerWithStats;
      })
    );

    return playersWithStats;
  } catch (error) {
    console.error('Error in getAllPlayers:', error);
    throw error;
  }
};

/**
 * Calculate player statistics from their workout data
 */
export const calculatePlayerStats = async (playerId: string) => {
  try {
    // First get the user_id from the player record
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('user_id')
      .eq('id', playerId)
      .single();

    if (playerError || !player?.user_id) {
      // Player doesn't have a linked user account yet, return defaults
      return {
        avgVelocity: 0,
        attendance: 0,
        loadRec: 'New',
        engagement: 'Moderate' as const,
      };
    }

    // Get sessions for this player (last 30 days for stats)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, created_at')
      .eq('user_id', player.user_id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching player sessions:', sessionsError);
    }

    const totalSessions = sessions?.length || 0;

    // Calculate average velocity from reps
    let avgVelocity = 0;
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('average_rep_speed')
        .in('session_id', sessionIds)
        .not('average_rep_speed', 'is', null);

      if (repsError) {
        console.error('Error fetching player reps:', repsError);
      }

      if (reps && reps.length > 0) {
        const totalVelocity = reps.reduce((sum, rep) => sum + (rep.average_rep_speed || 0), 0);
        avgVelocity = parseFloat((totalVelocity / reps.length).toFixed(2));
      }
    }

    // Calculate attendance (percentage of sessions in last 30 days)
    // Assuming expected sessions is ~12 per month (3 per week)
    const expectedSessions = 12;
    const attendance = Math.min(100, Math.round((totalSessions / expectedSessions) * 100));

    // Calculate load recommendation based on velocity trends
    let loadRec = 'Maintain';
    if (avgVelocity >= 1.85) {
      loadRec = '+5%';
    } else if (avgVelocity >= 1.75) {
      loadRec = '+3%';
    } else if (avgVelocity <= 1.65) {
      loadRec = '-3%';
    }

    // Calculate engagement based on attendance and velocity
    let engagement: 'High' | 'Moderate' | 'Low' = 'Moderate';
    if (attendance >= 90 && avgVelocity >= 1.75) {
      engagement = 'High';
    } else if (attendance < 70 || avgVelocity < 1.65) {
      engagement = 'Low';
    }

    return {
      avgVelocity,
      attendance,
      loadRec,
      engagement,
    };
  } catch (error) {
    console.error('Error calculating player stats:', error);
    // Return default values if calculation fails
    return {
      avgVelocity: 0,
      attendance: 0,
      loadRec: 'New',
      engagement: 'Moderate' as const,
    };
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
      level: 'Varsity',
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

