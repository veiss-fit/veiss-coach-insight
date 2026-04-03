import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Session = Database['public']['Tables']['sessions']['Row'];
type Workout = Database['public']['Tables']['workouts']['Row'];
type Rep = Database['public']['Tables']['reps']['Row'];

export interface RepData {
  repNumber: number;
  setNumber: number; // Added to distinguish sets
  velocity: number;
  rom: number;       // NEW: rom_mm
  tempo: number;     // NEW: concentric_duration_s
}

export interface ExerciseData {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  weightUnit: 'lbs' | 'kg';
  avgVelocity: number;
  avgROM: number;    // NEW
  avgTempo: number;  // NEW
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
export const getPlayerSessions = async (
  playerId: string,
  linkedUserId?: string | null
): Promise<SessionData[]> => {
  try {
    const ownerIds = Array.from(new Set([playerId, linkedUserId].filter(Boolean) as string[]));

    // Fetch sessions for this player
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .in('user_id', ownerIds)
      .order('created_at', { ascending: false });

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
    // 1. Fetch reps with the NEW Phase 22 columns
    const { data: reps, error: repsError } = await supabase
      .from('reps')
      .select('*, concentric_duration_s, rom_mm') // Explicitly select new columns
      .eq('session_id', sessionId)
      .order('exercise_name', { ascending: true })
      .order('set_number', { ascending: true })
      .order('rep_number', { ascending: true });

    if (repsError) {
      console.error('Error fetching reps:', repsError);
      throw repsError;
    }

    if (!reps || reps.length === 0) return [];

    // 2. Group reps by exercise
    const exerciseMap = new Map<string, Rep[]>();
    reps.forEach((rep) => {
      const key = rep.exercise_name;
      if (!exerciseMap.has(key)) exerciseMap.set(key, []);
      exerciseMap.get(key)!.push(rep);
    });

    const exercises: ExerciseData[] = [];

    // 3. Process each exercise group
    exerciseMap.forEach((exerciseReps, exerciseName) => {
      const sets = Math.max(...exerciseReps.map(r => r.set_number));
      // Calculate real counts based on the actual algorithm output
      const totalRepsAcrossAllSets = exerciseReps.length;
      const weight = exerciseReps[0]?.weight || 0;

      // Extract Bare Metrics for calculation
      const velocities = exerciseReps.map(r => Number(r.average_rep_speed)).filter(v => v > 0);
      const roms = exerciseReps.map(r => Number(r.rom_mm)).filter(v => v > 0);
      const tempos = exerciseReps.map(r => Number(r.concentric_duration_s)).filter(v => v > 0);

      // Averages
      const avgVelocity = velocities.length > 0
        ? parseFloat((velocities.reduce((a, b) => a + b, 0) / velocities.length).toFixed(2))
        : 0;

      const avgROM = roms.length > 0
        ? Math.round(roms.reduce((a, b) => a + b, 0) / roms.length)
        : 0;

      const avgTempo = tempos.length > 0
        ? parseFloat((tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(2))
        : 0;

      const peakVelocity = velocities.length > 0 ? Math.max(...velocities) : 0;

      // Logic for target zones (Standard VBT defaults)
      const targetVelocityMin = Math.max(0.1, avgVelocity - 0.15);
      const targetVelocityMax = avgVelocity + 0.15;

      // 4. Map the repData (The Bare Metrics)
      const repData: RepData[] = exerciseReps.map((rep) => ({
        repNumber: rep.rep_number,
        setNumber: rep.set_number, // We keep the set number separate now for better graphing
        velocity: Number(rep.average_rep_speed) || 0,
        rom: Number(rep.rom_mm) || 0,
        tempo: Number(rep.concentric_duration_s) || 0,
      }));

      exercises.push({
        id: `${sessionId}-${exerciseName}`,
        name: exerciseName,
        sets,
        reps: Math.round(totalRepsAcrossAllSets / sets), // Estimated reps per set
        weight: weight || 0,
        weightUnit: 'lbs',
        avgVelocity,
        avgROM,   // NEW: Used in UI summary
        avgTempo, // NEW: Used in UI summary
        peakVelocity: parseFloat(peakVelocity.toFixed(2)),
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

