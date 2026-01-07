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
    const workoutPlans = playerIds.map((playerId) => ({
      player_id: playerId,
      coach_id: coachId || null,
      date: dateStr, 
      title: planData.workoutName, 
      description: planData.notes || null, 
      exercises: exercisesArray, 
      notes: planData.notes || null, 
      is_completed: false,
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
 * Get aggregated workout history for the History page
 * Groups individual sends into batches based on time and title
 */
export const getCoachWorkoutHistory = async (coachId: string) => {
  try {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*, players(full_name)')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // FIX: Explicitly cast data to prevent 'never' errors
    const rawPlans = (data as any[]) || [];

    const groupedHistory: any[] = [];
    
    rawPlans.forEach((plan) => {
      const planTime = new Date(plan.created_at).getTime();
      
      const existingBatch = groupedHistory.find(b => 
        b.workoutName === plan.title && 
        Math.abs(new Date(b.sentAt).getTime() - planTime) < 60000 
      );

      const playerName = plan.players?.full_name || 'Unknown Athlete';

      if (existingBatch) {
        existingBatch.recipients.push(playerName);
        existingBatch.totalCount++;
      } else {
        groupedHistory.push({
          id: plan.id,
          workoutName: plan.title,
          scheduledDate: plan.date,
          sentAt: plan.created_at,
          recipients: [playerName],
          totalCount: 1,
          exercises: plan.exercises
        });
      }
    });

    return groupedHistory;
  } catch (error) {
    console.error('Error fetching workout history:', error);
    return [];
  }
};