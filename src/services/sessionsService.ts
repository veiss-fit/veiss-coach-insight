import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Session = Database['public']['Tables']['sessions']['Row'];
type Workout = Database['public']['Tables']['workouts']['Row'];
type Rep = Database['public']['Tables']['reps']['Row'];

export interface RepData {
  repNumber: number;
  velocity: number;
}

export interface ExerciseData {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  weightUnit: 'lbs' | 'kg';
  avgVelocity: number;
  peakVelocity: number;
  targetVelocityMin: number;
  targetVelocityMax: number;
  repData: RepData[];
}

export interface SessionData {
  id: string;
  date: string;
  exercises: ExerciseData[];
  notes?: string;
}

/**
 * Fetch all sessions for a specific player
 */
export const getPlayerSessions = async (playerId: string): Promise<SessionData[]> => {
  try {
    // Fetch sessions for this player
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', playerId)
      .order('created_at', { ascending: false })
      .limit(20); // Last 20 sessions

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    // For each session, fetch workouts and reps
    const sessionsWithData = await Promise.all(
      sessions.map(async (session) => {
        const exercises = await getSessionExercises(session.id);
        
        return {
          id: session.id,
          date: session.created_at.split('T')[0], // Format as YYYY-MM-DD
          exercises,
          notes: session.name || undefined,
        };
      })
    );

    return sessionsWithData;
  } catch (error) {
    console.error('Error in getPlayerSessions:', error);
    throw error;
  }
};

/**
 * Get all exercises for a specific session
 */
export const getSessionExercises = async (sessionId: string): Promise<ExerciseData[]> => {
  try {
    // Fetch reps for this session, grouped by exercise
    const { data: reps, error: repsError } = await supabase
      .from('reps')
      .select('*')
      .eq('session_id', sessionId)
      .order('exercise_name', { ascending: true })
      .order('set_number', { ascending: true })
      .order('rep_number', { ascending: true });

    if (repsError) {
      console.error('Error fetching reps:', repsError);
      throw repsError;
    }

    if (!reps || reps.length === 0) {
      return [];
    }

    // Group reps by exercise
    const exerciseMap = new Map<string, Rep[]>();
    reps.forEach((rep) => {
      const key = rep.exercise_name;
      if (!exerciseMap.has(key)) {
        exerciseMap.set(key, []);
      }
      exerciseMap.get(key)!.push(rep);
    });

    // Convert to ExerciseData format
    const exercises: ExerciseData[] = [];
    exerciseMap.forEach((exerciseReps, exerciseName) => {
      const sets = Math.max(...exerciseReps.map(r => r.set_number));
      const repsPerSet = exerciseReps.filter(r => r.set_number === 1).length;
      const weight = exerciseReps[0]?.weight || 0;
      
      // Calculate velocities
      const velocities = exerciseReps
        .map(r => r.average_rep_speed)
        .filter((v): v is number => v !== null);
      
      const avgVelocity = velocities.length > 0
        ? parseFloat((velocities.reduce((sum, v) => sum + v, 0) / velocities.length).toFixed(2))
        : 0;
      
      const peakVelocity = velocities.length > 0
        ? parseFloat(Math.max(...velocities).toFixed(2))
        : 0;

      // For target velocity, we'll use reasonable defaults based on avg
      // In a real system, this would come from the workout plan
      const targetVelocityMin = Math.max(0.8, avgVelocity - 0.2);
      const targetVelocityMax = avgVelocity + 0.2;

      // Convert reps to RepData format
      const repData: RepData[] = exerciseReps.map((rep) => ({
        repNumber: (rep.set_number - 1) * repsPerSet + rep.rep_number,
        velocity: rep.average_rep_speed || 0,
      }));

      exercises.push({
        id: `${sessionId}-${exerciseName}`,
        name: exerciseName,
        sets,
        reps: repsPerSet,
        weight: weight || 0,
        weightUnit: 'lbs',
        avgVelocity,
        peakVelocity,
        targetVelocityMin: parseFloat(targetVelocityMin.toFixed(2)),
        targetVelocityMax: parseFloat(targetVelocityMax.toFixed(2)),
        repData,
      });
    });

    return exercises;
  } catch (error) {
    console.error('Error in getSessionExercises:', error);
    throw error;
  }
};

/**
 * Get performance history for a player (for charts)
 */
export interface PerformanceData {
  date: string;
  velocity: number;
}

export const getPlayerPerformanceHistory = async (
  playerId: string,
  days: number = 30
): Promise<PerformanceData[]> => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch sessions in the date range
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, created_at')
      .eq('user_id', playerId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (sessionsError) {
      console.error('Error fetching performance history:', sessionsError);
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map(s => s.id);

    // Fetch all reps for these sessions
    const { data: reps, error: repsError } = await supabase
      .from('reps')
      .select('session_id, average_rep_speed')
      .in('session_id', sessionIds)
      .not('average_rep_speed', 'is', null);

    if (repsError) {
      console.error('Error fetching reps for performance:', repsError);
      throw repsError;
    }

    if (!reps || reps.length === 0) {
      return [];
    }

    // Group reps by session and calculate average velocity per session
    const sessionVelocityMap = new Map<string, number[]>();
    reps.forEach((rep) => {
      if (rep.average_rep_speed !== null) {
        if (!sessionVelocityMap.has(rep.session_id)) {
          sessionVelocityMap.set(rep.session_id, []);
        }
        sessionVelocityMap.get(rep.session_id)!.push(rep.average_rep_speed);
      }
    });

    // Create performance data points
    const performanceData: PerformanceData[] = sessions.map((session) => {
      const velocities = sessionVelocityMap.get(session.id) || [];
      const avgVelocity = velocities.length > 0
        ? velocities.reduce((sum, v) => sum + v, 0) / velocities.length
        : 0;

      return {
        date: session.created_at.split('T')[0],
        velocity: parseFloat(avgVelocity.toFixed(2)),
      };
    });

    return performanceData;
  } catch (error) {
    console.error('Error in getPlayerPerformanceHistory:', error);
    throw error;
  }
};

/**
 * Get session by ID with full details
 */
export const getSessionById = async (sessionId: string): Promise<SessionData | null> => {
  try {
    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }

    const exercises = await getSessionExercises(session.id);

    return {
      id: session.id,
      date: session.created_at.split('T')[0],
      exercises,
      notes: session.name || undefined,
    };
  } catch (error) {
    console.error('Error in getSessionById:', error);
    return null;
  }
};

