import { supabase } from '@/lib/supabase';
import { getAttendanceSummary, WorkoutPlanLike, WorkoutSessionLike } from '@/lib/workoutAttendance';

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

    const playerIds = players.map((p) => p.id);
    const sessionOwnerIds = Array.from(
      new Set(players.flatMap((p) => [p.id, p.user_id].filter(Boolean) as string[]))
    );

    const [{ data: allWorkoutPlans }, { data: allSessions }] = await Promise.all([
      supabase
        .from('workout_plans')
        .select('player_id, date, title, is_completed')
        .in('player_id', playerIds),
      sessionOwnerIds.length > 0
        ? supabase
            .from('sessions')
            .select('id, user_id, created_at, name')
            .in('user_id', sessionOwnerIds)
        : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; created_at: string; name: string }> }),
    ]);

    const plansByPlayerId = new Map<string, Array<{ date: string; title: string; is_completed: boolean }>>();
    (allWorkoutPlans || []).forEach((plan) => {
      const existing = plansByPlayerId.get(plan.player_id) || [];
      existing.push({ date: plan.date, title: plan.title, is_completed: plan.is_completed });
      plansByPlayerId.set(plan.player_id, existing);
    });

    let totalSessions = 0;
    let totalCompletedSessions = 0;
    const attendancePercentages: number[] = [];
    let lowestAttendance = 0;
    let topPerformer = 'N/A';
    let topAttendance = -1;

    players.forEach((player) => {
      const ownerIds = new Set([player.id, player.user_id].filter(Boolean) as string[]);
      const playerSessions = (allSessions || [])
        .filter((session) => ownerIds.has(session.user_id))
        .map((session) => ({
          id: session.id,
          date: session.created_at.slice(0, 10),
          name: session.name,
          createdAt: session.created_at,
        })) as WorkoutSessionLike[];
      const playerPlans = (plansByPlayerId.get(player.id) || []).map((plan) => ({
        date: plan.date,
        title: plan.title,
        is_completed: plan.is_completed,
      })) as WorkoutPlanLike[];
      const attendanceSummary = getAttendanceSummary(playerPlans, playerSessions);

      const playerTotalWorkouts = attendanceSummary.totalTrackedCount;
      const playerCompletedWorkouts = attendanceSummary.completedTrackedCount;
      const playerAttendance = attendanceSummary.attendancePercent;

      totalSessions += playerTotalWorkouts;
      totalCompletedSessions += playerCompletedWorkouts;
      attendancePercentages.push(playerAttendance);

      if (playerAttendance > topAttendance) {
        topAttendance = playerAttendance;
        topPerformer = player.full_name;
      }
    });

    const avgAttendance = totalSessions > 0
      ? Math.round((totalCompletedSessions / totalSessions) * 100)
      : 0;

    lowestAttendance = attendancePercentages.length > 0
      ? Math.min(...attendancePercentages)
      : 0;

    // Each coach record has a single canonical team_id in the current schema.
    const teamCount = teamId ? 1 : 0;

    return {
      totalSessions,
      activeAthletes,
      avgAttendance,
      totalTeams: teamCount,
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

