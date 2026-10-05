import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { sendMessage } from '@/services/messagesService';
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
}

export interface WorkoutPlanData {
  workoutName: string;
  exercises: WorkoutExercise[];
  notes?: string;
}

/** Local date parts, avoiding the UTC shift toISOString() would introduce for UTC+ zones. */
const toDateStr = (d: Date): string =>
  [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');

const sameName = (a: string | null | undefined, b: string | null | undefined): boolean =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

const dayLabel = (dateStr: string): string => format(new Date(dateStr + 'T12:00:00'), 'MMM d');

/**
 * Plans this coach already sent to these athletes on these dates under the same name. A coach may not send
 * the same workout name to the same athlete on the same date twice (another coach may). Names compare
 * ignoring case and surrounding spaces. Returns a readable reason, or null when nothing clashes.
 */
const findSameNameConflict = async (
  playerIds: string[],
  coachId: string | null,
  dateStrs: string[],
  title: string,
  /** Plans being edited or removed in the same save: they never count as a clash. */
  excludeIds: string[] = [],
  /** Only these "player|date" pairs are checked (the rest of the athlete x date grid is not being written). */
  onlyKeys?: Set<string>
): Promise<string | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('workout_plans')
    .select('id, player_id, date, title, players(full_name)')
    .in('player_id', playerIds)
    .in('date', dateStrs)
    .eq('is_template', false);
  query = coachId ? query.eq('coach_id', coachId) : query.is('coach_id', null);
  const { data, error } = await query;
  if (error) throw error;
  const clashes = ((data ?? []) as Array<{ id: string; player_id: string; date: string; title: string | null; players: { full_name: string | null } | null }>)
    .filter((row) => !excludeIds.includes(row.id))
    .filter((row) => !onlyKeys || onlyKeys.has(`${row.player_id}|${row.date}`))
    .filter((row) => sameName(row.title, title));
  if (clashes.length === 0) return null;
  const shown = clashes.slice(0, 3).map((row) => `${row.players?.full_name ?? 'an athlete'} on ${dayLabel(row.date)}`);
  const more = clashes.length > 3 ? ` and ${clashes.length - 3} more` : '';
  return `"${title.trim()}" was already sent to ${shown.join(', ')}${more}. The same workout name can't go to the same athlete on the same date twice. Rename it or change the dates.`;
};

/**
 * The shape plans are stored in. The mobile app currently reads a flat sets/reps/targetVelocity per
 * exercise (confirmed via a mobile-repo audit) and doesn't yet understand per-set data. Keep those flat
 * fields mirroring the FIRST set so it keeps showing a sensible prescription unmodified, while `perSet`
 * carries the full breakdown for when the mobile app is updated to read it.
 */
const toStoredExercises = (exercises: WorkoutExercise[]) =>
  exercises.map(ex => {
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
    };
  });

/**
 * "New Workout Assigned" push, one per athlete. Resolves player_ids → auth user_ids via profiles, de-duped:
 * a player with more than one profiles row (bad data) would otherwise be pushed once per duplicate row.
 */
const pushNewWorkout = async (playerIds: string[]): Promise<{ sent: number; attempted: number }> => {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id')
    .in('player_id', playerIds);

  if (profilesError) console.error('Profiles lookup failed:', profilesError);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = Array.from(new Set((profiles || []).map((p: any) => p.id as string)));
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
    }
  });
  return { sent: userIds.length - pushFailures, attempted: userIds.length };
};

/**
 * Send a workout plan to one or more players, on one or more dates.
 * One insert covering every player x date row, and ONE push per athlete
 * regardless of how many dates were picked (previously one push per date —
 * a 4-date send pinged each athlete 4 times for the same workout).
 */
export const sendWorkoutPlan = async (
  playerIds: string[],
  coachId: string | null,
  dates: Date[],
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
    const exercisesArray = toStoredExercises(planData.exercises);

    const conflict = await findSameNameConflict(playerIds, coachId, dates.map(toDateStr), planData.workoutName);
    if (conflict) return { success: false, count: 0, error: conflict };

    // Create one workout plan record per player x date.
    const workoutPlans = dates.flatMap((date) =>
      playerIds.map((playerId) => ({
        player_id: playerId,
        coach_id: coachId || null,
        date: toDateStr(date),
        title: planData.workoutName,
        description: planData.notes || null,
        exercises: exercisesArray,
        notes: planData.notes || null,
        is_completed: false,
        is_template: false,
      }))
    );

    const { data, error } = await supabase
      .from('workout_plans')
      // FIX: Cast to any to bypass strict type checking on insert
      .insert(workoutPlans as any)
      .select();

    if (error) {
      console.error('Error sending workout plans:', error);
      return { success: false, count: 0, error: error.message };
    }

    // The plans are saved either way, so a push failure is not a failure of the send — but the
    // coach should know their athletes weren't notified, which was previously only
    // ever visible in the console (§6.5).
    const push = await pushNewWorkout(playerIds);
    return {
      success: true,
      count: data?.length || 0,
      notificationsSent: push.sent,
      notificationsAttempted: push.attempted,
    };
  } catch (error: any) {
    console.error('Error in sendWorkoutPlan:', error);
    return { success: false, count: 0, error: error.message || 'Unknown error' };
  }
};

export interface CancelPlansResult {
  success: boolean;
  /** Plans actually removed. */
  cancelled: number;
  /** Plans left alone because they are done, already started, in the past, or not this coach's. */
  skipped: number;
  error?: string;
  /** Pushes delivered for the cancellation announcements. */
  notificationsSent?: number;
  notificationsAttempted?: number;
}

/**
 * Cancel workouts: delete the plan rows and tell each affected athlete (an announcement message plus a push).
 * Only plans that are still open can go: not completed, no linked session, scheduled today or later, and
 * sent by this coach. The delete repeats those conditions itself, so a workout the athlete finished in the
 * meantime survives, and what was really removed is what gets announced. The announcement is sent after the
 * delete; if it fails the workouts are still gone and the caller is told.
 */
export const cancelWorkoutPlans = async (
  planIds: string[],
  coachId: string | null,
  senderUserId: string
): Promise<CancelPlansResult> => {
  const ids = Array.from(new Set(planIds));
  if (ids.length === 0) return { success: true, cancelled: 0, skipped: 0 };
  try {
    const today = toDateStr(new Date());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let del = (supabase as any)
      .from('workout_plans')
      .delete()
      .in('id', ids)
      .eq('is_template', false)
      .eq('is_completed', false)
      .is('session_id', null)
      .gte('date', today);
    del = coachId ? del.eq('coach_id', coachId) : del.is('coach_id', null);
    const { data, error } = await del.select('id, player_id, title, date');
    if (error) {
      console.error('Error cancelling workout plans:', error);
      return { success: false, cancelled: 0, skipped: ids.length, error: error.message };
    }
    const removed = (data ?? []) as Array<{ id: string; player_id: string; title: string | null; date: string }>;
    if (removed.length === 0) {
      return {
        success: false,
        cancelled: 0,
        skipped: ids.length,
        error: 'Nothing was cancelled. The workout may already be done, in the past, or you may not have permission to remove it.',
      };
    }

    const byPlayer = new Map<string, typeof removed>();
    for (const row of removed) byPlayer.set(row.player_id, [...(byPlayer.get(row.player_id) ?? []), row]);

    const outcomes = await Promise.allSettled(
      [...byPlayer.entries()].map(([playerId, rows]) => {
        const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
        const label = (r: (typeof rows)[number]) => `"${r.title ?? 'Workout'}" (${format(new Date(r.date + 'T12:00:00'), 'EEE, MMM d')})`;
        const body =
          sorted.length === 1
            ? `Your coach cancelled ${label(sorted[0])}.`
            : `Your coach cancelled ${sorted.length} workouts: ${sorted.slice(0, 5).map(label).join(', ')}${
                sorted.length > 5 ? ` and ${sorted.length - 5} more` : ''
              }.`;
        return sendMessage(senderUserId, [playerId], 'Workout cancelled', body, 'announcement', 'normal');
      })
    );
    let sent = 0;
    let attempted = 0;
    let announceFailed = false;
    for (const o of outcomes) {
      if (o.status === 'rejected' || !o.value.success) {
        announceFailed = true;
        continue;
      }
      sent += o.value.notificationsSent ?? 0;
      attempted += o.value.notificationsAttempted ?? 0;
    }
    return {
      success: true,
      cancelled: removed.length,
      skipped: ids.length - removed.length,
      notificationsSent: announceFailed ? 0 : sent,
      notificationsAttempted: announceFailed ? Math.max(attempted, 1) : attempted,
      ...(announceFailed ? { error: 'The workouts were cancelled, but some athletes could not be notified.' } : {}),
    };
  } catch (error) {
    console.error('Error in cancelWorkoutPlans:', error);
    return { success: false, cancelled: 0, skipped: ids.length, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export interface EditablePlan {
  id: string;
  player_id: string;
  date: string;
  title: string | null;
  exercises: unknown;
  is_completed: boolean | null;
  session_id: string | null;
  playerName: string | null;
}

/** The coach's own plans by id, with the athlete's name, for the modify editor. */
export const getPlansByIds = async (ids: string[], coachId: string | null): Promise<EditablePlan[]> => {
  if (ids.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('workout_plans')
    .select('id, player_id, date, title, exercises, is_completed, session_id, players(full_name)')
    .in('id', ids)
    .eq('is_template', false);
  query = coachId ? query.eq('coach_id', coachId) : query.is('coach_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Array<EditablePlan & { players: { full_name: string | null } | null }>).map(
    ({ players, ...plan }) => ({ ...plan, playerName: players?.full_name ?? null })
  );
};

/** JSON with sorted keys, so two prescriptions compare equal whatever order their fields were written in. */
const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );

export interface ModifyPlansInput {
  /** The plans being edited: a whole batch, or the one plan of 'single'. */
  planIds: string[];
  mode: 'batch' | 'single';
  coachId: string | null;
  senderUserId: string;
  /** What the edited builder now holds. */
  playerIds: string[];
  dates: Date[];
  planData: WorkoutPlanData;
  /** What the editor showed when it opened. Only fields that differ from it are written to existing plans. */
  baseline: WorkoutPlanData;
}

export interface ModifyPlansResult {
  success: boolean;
  updated: number;
  added: number;
  removed: number;
  error?: string;
  /** The save went through, but something needs the coach's eye (a plan finished meanwhile, a failed notice). */
  warning?: string;
  notificationsSent?: number;
  notificationsAttempted?: number;
}

const blockedMessage = (plans: EditablePlan[]): string => {
  const who = Array.from(new Set(plans.map((p) => p.playerName ?? 'an athlete')));
  const shown = who.slice(0, 3).join(', ') + (who.length > 3 ? ` and ${who.length - 3} more` : '');
  return `Can't modify: ${shown} already did ${plans.length === 1 ? 'this workout' : 'part of it'}. A workout an athlete has done can't be changed.`;
};

/**
 * Change workouts that were already sent. Plans are updated in place (never deleted and re-created: the
 * phone links a finished session to its plan by id), athletes taken out of the batch or dates taken out
 * have their plan cancelled, and athletes or dates added get a new plan. Only open plans scheduled today
 * or later are ever touched, and the whole save is refused when any of them is already done. Each update
 * repeats "not done" in its own WHERE, so a workout finished mid-save is left alone and reported.
 * Updated athletes get an announcement and a push, removed ones the cancel notice, added ones the usual
 * "New Workout Assigned" push.
 */
export const modifyWorkoutPlans = async (input: ModifyPlansInput): Promise<ModifyPlansResult> => {
  const empty = { updated: 0, added: 0, removed: 0 };
  const fail = (error: string): ModifyPlansResult => ({ success: false, ...empty, error });
  try {
    const { coachId, senderUserId, planData } = input;
    const today = toDateStr(new Date());
    const originals = await getPlansByIds(input.planIds, coachId);
    const upcoming = originals.filter((p) => p.date >= today);
    if (upcoming.length === 0) return fail('None of these workouts can be changed any more: they are in the past or no longer exist.');
    const blocking = upcoming.filter((p) => p.is_completed || p.session_id);
    if (blocking.length > 0) return fail(blockedMessage(blocking));

    const dateStrs = Array.from(new Set(input.dates.map(toDateStr))).sort();
    if (dateStrs.length === 0) return fail('Select at least one date');
    if (dateStrs.some((d) => d < today)) return fail('A workout can only be scheduled for today or later.');
    if (input.playerIds.length === 0) return fail('Select at least one athlete');

    const title = planData.workoutName;
    const exercises = toStoredExercises(planData.exercises);
    const exercisesJson = stableJson(exercises);
    // What the coach changed in the editor, against what it showed when opened. Only these fields are written,
    // so renaming a batch leaves every plan's exercises alone and an exercise edit leaves the names alone.
    const titleChanged = input.baseline.workoutName !== title;
    const exercisesTouched = stableJson(toStoredExercises(input.baseline.exercises)) !== exercisesJson;

    type Update = { plan: EditablePlan; newDate: string };
    let updates: Update[] = [];
    const removes: EditablePlan[] = [];
    const adds: Array<{ playerId: string; date: string }> = [];

    if (input.mode === 'single') {
      if (upcoming.length !== 1 || dateStrs.length !== 1) return fail('Pick exactly one date for this workout.');
      const plan = upcoming[0];
      if (titleChanged || exercisesTouched || plan.date !== dateStrs[0]) updates = [{ plan, newDate: dateStrs[0] }];
    } else {
      const desired = new Set(input.playerIds.flatMap((playerId) => dateStrs.map((d) => `${playerId}|${d}`)));
      const byKey = new Map(upcoming.map((p) => [`${p.player_id}|${p.date}`, p]));
      for (const [key, plan] of byKey) {
        if (!desired.has(key)) removes.push(plan);
        else if (titleChanged || exercisesTouched) updates.push({ plan, newDate: plan.date });
      }
      for (const key of desired) {
        if (byKey.has(key)) continue;
        const [playerId, date] = key.split('|');
        adds.push({ playerId, date });
      }
    }

    // The same-name rule, for what this save writes under a name: renamed plans, moved plans and new plans.
    const checked = new Set<string>([
      ...updates.filter((u) => titleChanged || u.newDate !== u.plan.date).map((u) => `${u.plan.player_id}|${u.newDate}`),
      ...adds.map((a) => `${a.playerId}|${a.date}`),
    ]);
    if (checked.size > 0) {
      const conflict = await findSameNameConflict(
        input.playerIds.length > 0 ? input.playerIds : [...new Set([...checked].map((k) => k.split('|')[0]))],
        coachId,
        dateStrs,
        title,
        originals.map((p) => p.id),
        checked
      );
      if (conflict) return fail(conflict);
    }

    if (updates.length === 0 && removes.length === 0 && adds.length === 0) return { success: true, ...empty };

    const warnings: string[] = [];
    let sent = 0;
    let attempted = 0;

    // 1. Updates, in place.
    const updateOutcomes = await Promise.all(
      updates.map(async ({ plan, newDate }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('workout_plans')
          .update({
            ...(titleChanged ? { title } : {}),
            ...(exercisesTouched ? { exercises } : {}),
            ...(newDate !== plan.date ? { date: newDate } : {}),
          })
          .eq('id', plan.id)
          .eq('is_completed', false)
          .is('session_id', null)
          .select('id');
        return { plan, newDate, ok: !error && (data ?? []).length === 1, error: error?.message as string | undefined };
      })
    );
    const done = updateOutcomes.filter((o) => o.ok);
    const notDone = updateOutcomes.filter((o) => !o.ok);
    if (notDone.length > 0) {
      const names = Array.from(new Set(notDone.map((o) => o.plan.playerName ?? 'an athlete'))).join(', ');
      warnings.push(`Not changed for ${names}: they finished it meanwhile, or it could not be saved.`);
    }

    // 2. Announce the updates, one message per athlete.
    const byPlayer = new Map<string, typeof done>();
    for (const o of done) byPlayer.set(o.plan.player_id, [...(byPlayer.get(o.plan.player_id) ?? []), o]);
    const announceOutcomes = await Promise.allSettled(
      [...byPlayer.entries()].map(([playerId, rows]) => {
        const lines = [...rows]
          .sort((a, b) => a.newDate.localeCompare(b.newDate))
          .slice(0, 5)
          .map((o) => {
            const what = [
              titleChanged ? `renamed from "${o.plan.title ?? 'Workout'}"` : null,
              o.newDate !== o.plan.date ? `moved from ${format(new Date(o.plan.date + 'T12:00:00'), 'EEE, MMM d')}` : null,
              exercisesTouched ? 'exercises changed' : null,
            ].filter(Boolean).join(', ');
            return `"${titleChanged ? title : (o.plan.title ?? 'Workout')}" (${format(new Date(o.newDate + 'T12:00:00'), 'EEE, MMM d')}): ${what}`;
          });
        const more = rows.length > 5 ? ` and ${rows.length - 5} more` : '';
        const body = `Your coach updated ${rows.length === 1 ? 'a workout' : `${rows.length} workouts`}. ${lines.join('; ')}${more}.`;
        return sendMessage(senderUserId, [playerId], 'Workout updated', body, 'announcement', 'normal');
      })
    );
    let announceFailed = false;
    for (const o of announceOutcomes) {
      if (o.status === 'rejected' || !o.value.success) { announceFailed = true; continue; }
      sent += o.value.notificationsSent ?? 0;
      attempted += o.value.notificationsAttempted ?? 0;
    }
    if (announceFailed) warnings.push('Some athletes could not be notified of the update.');

    // 3. Additions.
    let added = 0;
    if (adds.length > 0) {
      const rows = adds.map((a) => ({
        player_id: a.playerId,
        coach_id: coachId || null,
        date: a.date,
        title,
        description: planData.notes || null,
        exercises,
        notes: planData.notes || null,
        is_completed: false,
        is_template: false,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from('workout_plans').insert(rows).select('id');
      if (error) {
        warnings.push(`New athletes or dates could not be added: ${error.message}`);
      } else {
        added = (data ?? []).length;
        const push = await pushNewWorkout([...new Set(adds.map((a) => a.playerId))]);
        sent += push.sent;
        attempted += push.attempted;
      }
    }

    // 4. Removals: the same path as a cancel, notice included.
    let removed = 0;
    if (removes.length > 0) {
      const cancel = await cancelWorkoutPlans(removes.map((p) => p.id), coachId, senderUserId);
      removed = cancel.cancelled;
      sent += cancel.notificationsSent ?? 0;
      attempted += cancel.notificationsAttempted ?? 0;
      if (!cancel.success) warnings.push(`Athletes or dates could not be removed: ${cancel.error ?? 'unknown error'}`);
      else if (cancel.error) warnings.push(cancel.error);
    }

    return {
      success: true,
      updated: done.length,
      added,
      removed,
      notificationsSent: sent,
      notificationsAttempted: attempted,
      ...(warnings.length > 0 ? { warning: warnings.join(' ') } : {}),
    };
  } catch (error) {
    console.error('Error in modifyWorkoutPlans:', error);
    return fail(error instanceof Error ? error.message : 'Unknown error');
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
      .select('id, player_id, coach_id, date, title, description, exercises, notes, is_completed, is_template, completed_at, session_id, created_at, updated_at')
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
 * Get aggregated workout history for the History page, scoped to the authenticated coach.
 * Takes coaches.id (from profile.coach_id) directly — the caller already has it via
 * AuthContext, no need to re-resolve it from the auth user ID here.
 */
export const getCoachWorkoutHistory = async (coachId: string) => {
  try {
    const { data: plans, error } = await supabase
      .from('workout_plans')
      .select('*, players(full_name)')
      .eq('coach_id', coachId as any)
      .eq('is_template', false as any)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!plans) return [];

    // Group by workout name + calendar date sent + prescription (batches sent same day are one row). The
    // prescription is part of the key so a plan edited for one athlete leaves the batch and shows as its own
    // row; every row is then uniform, which is what editing a batch relies on.
    const batchMap = new Map<string, any>();
    (plans as any[]).forEach((plan) => {
      const key = `${plan.title}-${plan.created_at?.slice(0, 10)}-${stableJson(plan.exercises)}`;
      if (!batchMap.has(key)) {
        batchMap.set(key, {
          id: plan.id,
          workoutName: plan.title,
          sentAt: plan.created_at,
          scheduledDates: [] as string[],
          recipients: [] as string[],
          seenPlayerIds: new Set<string>(),
          exercises: plan.exercises,
          // Plans of this batch that can still be cancelled: open and scheduled today or later.
          cancellablePlanIds: [] as string[],
          cancellablePlayerIds: new Set<string>(),
          /** Every plan of the batch, and how many are scheduled today or later (what Modify can still change). */
          planIds: [] as string[],
          upcomingPlanCount: 0,
        });
      }
      const batch = batchMap.get(key);
      batch.planIds.push(plan.id);
      if (plan.date >= toDateStr(new Date())) batch.upcomingPlanCount++;
      if (!plan.is_completed && !plan.session_id && plan.date >= toDateStr(new Date())) {
        batch.cancellablePlanIds.push(plan.id);
        batch.cancellablePlayerIds.add(plan.player_id);
      }
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

    return Array.from(batchMap.values()).map(({ seenPlayerIds, cancellablePlayerIds, ...batch }) => ({
      ...batch,
      cancellableAthleteCount: cancellablePlayerIds.size as number,
    }));
  } catch (error) {
    console.error('Error fetching workout history:', error);
    throw error;
  }
};