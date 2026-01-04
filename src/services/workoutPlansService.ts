import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];
type WorkoutPlanInsert = Database['public']['Tables']['workout_plans']['Insert'];

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  weightUnit: 'lbs' | 'kg';
  targetVelocityMin: number;
  targetVelocityMax: number;
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

    // Map exercises to match mobile app format
    const exercisesArray = planData.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      weightUnit: ex.weightUnit,
      targetVelocityMin: ex.targetVelocityMin,
      targetVelocityMax: ex.targetVelocityMax,
    }));

    // Create workout plan records for each player
    // Match the actual schema: date, title, description, exercises (JSONB), notes
    const workoutPlans = playerIds.map((playerId) => ({
      player_id: playerId,
      coach_id: coachId || null,
      date: dateStr, // YYYY-MM-DD format (not scheduled_date)
      title: planData.workoutName, // Use title field
      description: planData.notes || null, // Use description field
      exercises: exercisesArray, // JSONB array of exercises
      notes: planData.notes || null, // Additional notes
      is_completed: false,
    }));

    console.log('Inserting workout plans:', workoutPlans);

    const { data, error } = await supabase
      .from('workout_plans')
      .insert(workoutPlans)
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
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching coach workout plans:', error);
      throw error;
    }

    return data || [];
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
    
    // Set completed_at timestamp when marking as completed
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

    return data || [];
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

    return data;
  } catch (error) {
    console.error('Error in getWorkoutPlanById:', error);
    return null;
  }
};

