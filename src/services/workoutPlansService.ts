import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];
type WorkoutPlanInsert = Database['public']['Tables']['workout_plans']['Insert'];

// Helper type to handle joined data
interface WorkoutPlanWithPlayer extends WorkoutPlan {
  players: { full_name: string | null } | null;
}

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  targetVelocity: number;
}

export interface WorkoutPlanData {
  workoutName: string;
  exercises: WorkoutExercise[];
  notes?: string;
}

/**
 * Send a workout plan to one or more players
 */
export const sendWorkoutPlan = async (
  playerIds: string[],
  coachId: string | null,
  scheduledDate: Date,
  planData: WorkoutPlanData
): Promise<{ success: boolean; count: number; error?: string }> => {
  try {
    // Ensure scheduledDate is a Date object and format as YYYY-MM-DD
    const dateStr = scheduledDate instanceof Date 
      ? scheduledDate.toISOString().split('T')[0] 
      : scheduledDate;

    const exercisesArray = planData.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight ?? 0,
      weightUnit: ex.weightUnit ?? 'lbs',
      targetVelocity: ex.targetVelocity,
    }));

    // Create workout plan records for each player
    const workoutPlans = playerIds.map((playerId) => ({
      player_id: playerId,
      coach_id: coachId || null,
      date: dateStr,
      title: planData.workoutName,
      description: planData.notes || null,
      exercises: exercisesArray,
      notes: planData.notes || null,
      is_completed: false,
      is_template: false,
    }));

    console.log('Inserting workout plans:', workoutPlans);

    const { data, error } = await supabase
      .from('workout_plans')
      // FIX: Cast to any to bypass strict type checking on insert
      .insert(workoutPlans as any)
      .select();

    if (error) {
      console.error('Error sending workout plans:', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || 0 };
  } catch (error: any) {
    console.error('Error in sendWorkoutPlan:', error);
    return { success: false, count: 0, error: error.message || 'Unknown error' };
  }
};

/**
 * Get workout plans for a specific player
 */
export const getPlayerWorkoutPlans = async (
  playerId: string
): Promise<WorkoutPlan[]> => {
  try {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('player_id', playerId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching workout plans:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPlayerWorkoutPlans:', error);
    throw error;
  }
};

/**
 * Get all workout plans created by a coach
 */
export const getCoachWorkoutPlans = async (
  coachId: string
): Promise<WorkoutPlan[]> => {
  try {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*, players(full_name)')
      .eq('coach_id', coachId)
      .eq('is_template', false)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching coach workout plans:', error);
      throw error;
    }

    // FIX: Cast to any because the join 'players' adds a property not in the base type
    return (data as any) || [];
  } catch (error) {
    console.error('Error in getCoachWorkoutPlans:', error);
    throw error;
  }
};

/**
 * Update workout plan completion status (when player completes it)
 */
export const updateWorkoutPlanStatus = async (
  planId: string,
  isCompleted: boolean
): Promise<boolean> => {
  try {
    const updateData: any = { 
      is_completed: isCompleted 
    };
    
    if (isCompleted) {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }
    
    const { error } = await supabase
      .from('workout_plans')
      .update(updateData)
      .eq('id', planId);

    if (error) {
      console.error('Error updating workout plan status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateWorkoutPlanStatus:', error);
    return false;
  }
};

/**
 * Delete a workout plan
 */
export const deleteWorkoutPlan = async (planId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('workout_plans')
      .delete()
      .eq('id', planId);

    if (error) {
      console.error('Error deleting workout plan:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteWorkoutPlan:', error);
    return false;
  }
};

/**
 * Get upcoming workout plans for a team
 */
export const getUpcomingWorkoutPlans = async (
  playerIds: string[],
  daysAhead: number = 7
): Promise<WorkoutPlan[]> => {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('workout_plans')
      .select('*, players(full_name)')
      .in('player_id', playerIds)
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', futureDate.toISOString().split('T')[0])
      .eq('is_completed', false)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching upcoming workout plans:', error);
      throw error;
    }

    // FIX: Cast to any to resolve the mismatch caused by the join
    return (data as any) || [];
  } catch (error) {
    console.error('Error in getUpcomingWorkoutPlans:', error);
    throw error;
  }
};

/**
 * Get workout plan by ID
 */
export const getWorkoutPlanById = async (planId: string): Promise<WorkoutPlan | null> => {
  try {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*, players(full_name)')
      .eq('id', planId)
      .single();

    if (error) {
      console.error('Error fetching workout plan:', error);
      return null;
    }

    return data as any;
  } catch (error) {
    console.error('Error in getWorkoutPlanById:', error);
    return null;
  }
};

/**
 * Get aggregated workout history for the History page, scoped to the authenticated coach.
 * Resolves coaches.id from auth user ID, then fetches sent plans (is_template = false)
 * for that coach only, grouped into batches by title + send date.
 */
export const getCoachWorkoutHistory = async (userId: string) => {
  try {
    const { data: coach } = await (supabase as any)
      .from('coaches')
      .select('id')
      .eq('user_id', userId)
      .single() as { data: { id: string } | null };

    if (!coach) return [];

    const { data: plans } = await supabase
      .from('workout_plans')
      .select('*, players(full_name)')
      .eq('coach_id', coach.id as any)
      .eq('is_template', false as any)
      .order('created_at', { ascending: false });

    if (!plans) return [];

    // Group by workout name + calendar date sent (batches sent same day are one row)
    const batchMap = new Map<string, any>();
    (plans as any[]).forEach((plan) => {
      const key = `${plan.title}-${plan.created_at?.slice(0, 10)}`;
      if (!batchMap.has(key)) {
        batchMap.set(key, {
          id: plan.id,
          workoutName: plan.title,
          sentAt: plan.created_at,
          scheduledDate: plan.date,
          recipients: [],
          totalCount: 0,
          exercises: plan.exercises,
        });
      }
      const batch = batchMap.get(key);
      const playerName = (plan as any).players?.full_name;
      if (playerName) batch.recipients.push(playerName);
      batch.totalCount++;
    });

    return Array.from(batchMap.values());
  } catch (error) {
    console.error('Error fetching workout history:', error);
    return [];
  }
};