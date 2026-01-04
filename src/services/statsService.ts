import { supabase } from '@/lib/supabase';

export interface DashboardStats {
  totalSessions: number;
  activeAthletes: number;
  avgAttendance: number;
  totalTeams: number;
  avgTeamLoad: number;
  topPerformer: string;
  lowestAttendance: number;
}

/**
 * Calculate dashboard statistics for a coach's team(s)
 */
export const getCoachDashboardStats = async (
  teamId: string | null
): Promise<DashboardStats> => {
  try {
    // Get all players for this team
    const playersQuery = teamId 
      ? supabase.from('players').select('id, full_name, user_id').eq('team_id', teamId)
      : supabase.from('players').select('id, full_name, user_id');

    const { data: players, error: playersError } = await playersQuery;

    if (playersError) {
      console.error('Error fetching players:', playersError);
      throw playersError;
    }

    const activeAthletes = players?.length || 0;

    if (!players || players.length === 0) {
      return {
        totalSessions: 0,
        activeAthletes: 0,
        avgAttendance: 0,
        totalTeams: teamId ? 1 : 0,
        avgTeamLoad: 0,
        topPerformer: 'N/A',
        lowestAttendance: 0,
      };
    }

    // Get sessions for these players (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const playerUserIds = players.map(p => p.user_id).filter(id => id !== null);

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, user_id, created_at')
      .in('user_id', playerUserIds)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
    }

    const totalSessions = sessions?.length || 0;

    // Calculate attendance per player
    const expectedSessions = 12; // Assume ~3 sessions per week for 4 weeks
    const playerAttendance = new Map<string, number>();
    const playerNames = new Map<string, string>();

    players.forEach(player => {
      if (player.user_id) {
        playerNames.set(player.user_id, player.full_name);
        playerAttendance.set(player.user_id, 0);
      }
    });

    sessions?.forEach(session => {
      const current = playerAttendance.get(session.user_id) || 0;
      playerAttendance.set(session.user_id, current + 1);
    });

    // Calculate average attendance percentage
    const attendancePercentages: number[] = [];
    playerAttendance.forEach((sessionCount) => {
      const percentage = Math.min(100, Math.round((sessionCount / expectedSessions) * 100));
      attendancePercentages.push(percentage);
    });

    const avgAttendance = attendancePercentages.length > 0
      ? Math.round(attendancePercentages.reduce((sum, p) => sum + p, 0) / attendancePercentages.length)
      : 0;

    const lowestAttendance = attendancePercentages.length > 0
      ? Math.min(...attendancePercentages)
      : 0;

    // Calculate velocities for top performer
    const sessionIds = sessions?.map(s => s.id) || [];
    
    let topPerformer = 'N/A';
    if (sessionIds.length > 0) {
      const { data: reps } = await supabase
        .from('reps')
        .select('session_id, average_rep_speed')
        .in('session_id', sessionIds)
        .not('average_rep_speed', 'is', null);

      if (reps && reps.length > 0) {
        // Group by session, then by user
        const sessionToUser = new Map<string, string>();
        sessions?.forEach(s => {
          sessionToUser.set(s.id, s.user_id);
        });

        const userVelocities = new Map<string, number[]>();
        reps.forEach(rep => {
          const userId = sessionToUser.get(rep.session_id);
          if (userId && rep.average_rep_speed) {
            if (!userVelocities.has(userId)) {
              userVelocities.set(userId, []);
            }
            userVelocities.get(userId)!.push(rep.average_rep_speed);
          }
        });

        // Calculate average velocity per user
        let maxAvgVelocity = 0;
        let topUserId: string | null = null;

        userVelocities.forEach((velocities, userId) => {
          const avgVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
          if (avgVelocity > maxAvgVelocity) {
            maxAvgVelocity = avgVelocity;
            topUserId = userId;
          }
        });

        if (topUserId) {
          topPerformer = playerNames.get(topUserId) || 'Unknown';
        }
      }
    }

    // Get total teams count
    const { count: teamCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });

    return {
      totalSessions,
      activeAthletes,
      avgAttendance,
      totalTeams: teamCount || 0,
      avgTeamLoad: avgAttendance, // Team load is essentially attendance
      topPerformer,
      lowestAttendance,
    };
  } catch (error) {
    console.error('Error in getCoachDashboardStats:', error);
    return {
      totalSessions: 0,
      activeAthletes: 0,
      avgAttendance: 0,
      totalTeams: 0,
      avgTeamLoad: 0,
      topPerformer: 'N/A',
      lowestAttendance: 0,
    };
  }
};

/**
 * Get session count for a specific time period
 */
export const getSessionCount = async (
  teamId: string | null,
  startDate: Date,
  endDate: Date
): Promise<number> => {
  try {
    // Get players for the team
    const playersQuery = teamId 
      ? supabase.from('players').select('user_id').eq('team_id', teamId)
      : supabase.from('players').select('user_id');

    const { data: players } = await playersQuery;

    if (!players || players.length === 0) {
      return 0;
    }

    const playerUserIds = players.map(p => p.user_id).filter(id => id !== null);

    const { count, error } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .in('user_id', playerUserIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      console.error('Error fetching session count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getSessionCount:', error);
    return 0;
  }
};

/**
 * Get weekly activity summary
 */
export const getWeeklyActivity = async (
  teamId: string | null
): Promise<{ date: string; sessions: number }[]> => {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get players for the team
    const playersQuery = teamId 
      ? supabase.from('players').select('user_id').eq('team_id', teamId)
      : supabase.from('players').select('user_id');

    const { data: players } = await playersQuery;

    if (!players || players.length === 0) {
      return [];
    }

    const playerUserIds = players.map(p => p.user_id).filter(id => id !== null);

    const { data: sessions } = await supabase
      .from('sessions')
      .select('created_at')
      .in('user_id', playerUserIds)
      .gte('created_at', sevenDaysAgo.toISOString())
      .lte('created_at', today.toISOString());

    // Group by date
    const dateMap = new Map<string, number>();
    sessions?.forEach(session => {
      const date = session.created_at.split('T')[0];
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    // Convert to array
    const result: { date: string; sessions: number }[] = [];
    dateMap.forEach((count, date) => {
      result.push({ date, sessions: count });
    });

    return result.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error in getWeeklyActivity:', error);
    return [];
  }
};

/**
 * Get team performance summary
 */
export const getTeamPerformanceSummary = async (
  teamId: string | null
): Promise<{
  avgVelocity: number;
  totalReps: number;
  totalExercises: number;
  improvementRate: number;
}> => {
  try {
    // Get players for the team
    const playersQuery = teamId 
      ? supabase.from('players').select('user_id').eq('team_id', teamId)
      : supabase.from('players').select('user_id');

    const { data: players } = await playersQuery;

    if (!players || players.length === 0) {
      return { avgVelocity: 0, totalReps: 0, totalExercises: 0, improvementRate: 0 };
    }

    const playerUserIds = players.map(p => p.user_id).filter(id => id !== null);

    // Get sessions for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .in('user_id', playerUserIds)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (!sessions || sessions.length === 0) {
      return { avgVelocity: 0, totalReps: 0, totalExercises: 0, improvementRate: 0 };
    }

    const sessionIds = sessions.map(s => s.id);

    // Get reps data
    const { data: reps } = await supabase
      .from('reps')
      .select('average_rep_speed, exercise_name')
      .in('session_id', sessionIds)
      .not('average_rep_speed', 'is', null);

    const totalReps = reps?.length || 0;
    const velocities = reps?.map(r => r.average_rep_speed).filter(v => v !== null) || [];
    const avgVelocity = velocities.length > 0
      ? parseFloat((velocities.reduce((sum, v) => sum + v, 0) / velocities.length).toFixed(2))
      : 0;

    // Count unique exercises
    const uniqueExercises = new Set(reps?.map(r => r.exercise_name) || []);
    const totalExercises = uniqueExercises.size;

    // Calculate improvement rate (compare first half vs second half of period)
    let improvementRate = 0;
    if (sessions.length >= 2) {
      const midPoint = Math.floor(sessions.length / 2);
      const firstHalfIds = sessionIds.slice(0, midPoint);
      const secondHalfIds = sessionIds.slice(midPoint);

      const firstHalfVelocities = reps
        ?.filter(r => firstHalfIds.includes(r.session_id))
        .map(r => r.average_rep_speed)
        .filter(v => v !== null) || [];

      const secondHalfVelocities = reps
        ?.filter(r => secondHalfIds.includes(r.session_id))
        .map(r => r.average_rep_speed)
        .filter(v => v !== null) || [];

      const firstAvg = firstHalfVelocities.length > 0
        ? firstHalfVelocities.reduce((sum, v) => sum + v, 0) / firstHalfVelocities.length
        : 0;

      const secondAvg = secondHalfVelocities.length > 0
        ? secondHalfVelocities.reduce((sum, v) => sum + v, 0) / secondHalfVelocities.length
        : 0;

      if (firstAvg > 0) {
        improvementRate = parseFloat((((secondAvg - firstAvg) / firstAvg) * 100).toFixed(1));
      }
    }

    return {
      avgVelocity,
      totalReps,
      totalExercises,
      improvementRate,
    };
  } catch (error) {
    console.error('Error in getTeamPerformanceSummary:', error);
    return { avgVelocity: 0, totalReps: 0, totalExercises: 0, improvementRate: 0 };
  }
};

