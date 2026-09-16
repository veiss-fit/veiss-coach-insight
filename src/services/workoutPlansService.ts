import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];
type WorkoutPlanInsert = Database['public']['Tables']['workout_plans']['Insert'];

// Helper type to handle joined data
interface WorkoutPlanWithPlayer extends WorkoutPlan {
  players: { full_name: string | null } | null;
}

export interface WorkoutSetSpec {
  reps: number;
  targetVelocity: number | null;
}

export interface WorkoutExercise {
  name: string;
  /** One entry per set — reps and target velocity can differ set to set. */
  perSet: WorkoutSetSpec[];
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  /**
   * Coach-entered target velocity RANGE for this exercise (m/s) — distinct
   * from perSet[].targetVelocity, which is a single prescribed point value
   * per set. This range is what "Targets Reached" evaluates logged reps
   * against (see src/lib/targetEvaluation.ts); both optional, and both must
   * be set for the exercise to count as targeted. Data entry only — never
   * derived/inferred.
   */
  targetVelocityMin?: number | null;
  targetVelocityMax?: number | null;
}

export interface WorkoutPlanData {
  workoutName: string;
  exercises: WorkoutExercise[];
  notes?: string;
  /** Marks this plan as part of a rehab/return-to-play process (migration
   *  009). Drives the athlete-detail RTP trend view via same-day matching. */
  isRehab?: boolean;
}

/**
 * Send a workout plan to one or more players
 */
export const sendWorkoutPlan = async (
  playerIds: string[],
  coachId: string | null,
  scheduledDate: Date,
  planData: WorkoutPlanData
): Promise<{
  success: boolean;
  count: number;
  error?: string;
  /** Push notifications actually delivered; plans are saved regardless. */
  notificationsSent?: number;
  notificationsAttempted?: number;
}> => {
  try {
    // Use local date parts to avoid UTC timezone shift (toISOString would subtract hours for UTC+ zones)
    const dateStr = scheduledDate instanceof Date
      ? [
          scheduledDate.getFullYear(),
          String(scheduledDate.getMonth() + 1).padStart(2, '0'),
          String(scheduledDate.getDate()).padStart(2, '0'),
        ].join('-')
      : scheduledDate;

    // The mobile app currently reads a flat sets/reps/targetVelocity per exercise
    // (confirmed via a mobile-repo audit) and doesn't yet understand per-set data.
    // Keep those flat fields mirroring the FIRST set so it keeps showing a sensible
    // prescription unmodified, while `perSet` carries the full breakdown for when
    // the mobile app is updated to read it.
    const exercisesArray = planData.exercises.map(ex => {
      const perSet = ex.perSet.map(s => ({ reps: s.reps, targetVelocity: s.targetVelocity }));
      const first = perSet[0] ?? { reps: 0, targetVelocity: null };
      return {
        name: ex.name,
        weight: ex.weight ?? 0,
        weightUnit: ex.weightUnit ?? 'lbs',
        sets: perSet.length,
        reps: first.reps,
        targetVelocity: first.targetVelocity ?? 0,
        perSet,
        // Only written when both bounds are set — a one-sided range isn't
        // evaluable (see targetEvaluation.buildTargetsForExercises).
        targetVelocityMin: ex.targetVelocityMin ?? null,
        targetVelocityMax: ex.targetVelocityMax ?? null,
      };
    });

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
      is_rehab: planData.isRehab ?? false,
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

    // Resolve player_ids → auth user_ids via profiles, then push directly
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .in('player_id', playerIds);

    if (profilesError) console.error('Profiles lookup failed:', profilesError);
    const userIds = (profiles || []).map((p: any) => p.id);
    if (userIds.length === 0) console.warn('No auth user IDs resolved — no notifications will be sent');

    const pushResults = await Promise.allSettled(
      userIds.map((userId: string) =>
        supabase.functions.invoke('send-push-notification', {
          body: {
            userId,
            title: 'New Workout Assigned',
            body: 'Your coach has assigned you a new workout.',
            data: { type: 'workout_plan', screen: 'Workout' },
          },
        })
      )
    );
    let pushFailures = 0;
    pushResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        pushFailures++;
        console.error(`Push network error for userId ${userIds[i]}:`, r.reason);
      } else if (r.value?.error) {
        pushFailures++;
        console.error(`Push function error for userId ${userIds[i]}:`, r.value.error);
      } else {
        console.log(`✅ Push sent for userId ${userIds[i]}`);
      }
    });

    // The plans are saved either way, so this is not a failure of the send — but the
    // coach should know their athletes weren't notified, which was previously only
    // ever visible in the console (§6.5).
    const notified = userIds.length - pushFailures;
    return {
      success: true,
      count: data?.length || 0,
      notificationsSent: notified,
      notificationsAttempted: userIds.length,
    };
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
      .select('id, player_id, coach_id, date, title, description, exercises, notes, is_completed, is_template, is_rehab, completed_at, session_id, created_at, updated_at')
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
          scheduledDates: [] as string[],
          recipients: [] as string[],
          seenPlayerIds: new Set<string>(),
          exercises: plan.exercises,
        });
      }
      const batch = batchMap.get(key);
      // Collect each unique scheduled date
      if (plan.date && !batch.scheduledDates.includes(plan.date)) {
        batch.scheduledDates.push(plan.date);
      }
      // Deduplicate recipients by player_id so multi-date sends don't repeat names
      const playerName = (plan as any).players?.full_name;
      if (playerName && !batch.seenPlayerIds.has(plan.player_id)) {
        batch.seenPlayerIds.add(plan.player_id);
        batch.recipients.push(playerName);
      }
    });

    return Array.from(batchMap.values()).map(({ seenPlayerIds, ...batch }) => batch);
  } catch (error) {
    console.error('Error fetching workout history:', error);
    return [];
  }
};