import { supabase } from '@/lib/supabase';
import { chunk } from '@/lib/utils';
import { VISIBLE_SESSION_FILTER } from '@/services/sessionsService';

/** Max ids per `.in(...)` call — same limit the other services use. */
const ID_CHUNK_SIZE = 200;

/**
 * A cheap fingerprint of "what has reached the database" for a set of athletes. Any change means a
 * workout arrived (newest/sessions), is still uploading (reps), finished linking to its plan
 * (completedPlans), or was deleted (counts going down). Matched on `player_id`, which is what the
 * coach read policies filter on.
 */
export interface ArrivalStamp {
  sessions: number;
  /** Newest `sessions.created_at` (when the row reached the database), ISO string. */
  newest: string | null;
  reps: number;
  completedPlans: number;
}

export const stampsEqual = (a: ArrivalStamp, b: ArrivalStamp) =>
  a.sessions === b.sessions && a.newest === b.newest && a.reps === b.reps && a.completedPlans === b.completedPlans;

export const getArrivalStamp = async (playerIds: string[]): Promise<ArrivalStamp> => {
  const stamp: ArrivalStamp = { sessions: 0, newest: null, reps: 0, completedPlans: 0 };
  if (playerIds.length === 0) return stamp;

  await Promise.all(
    chunk(playerIds, ID_CHUNK_SIZE).map(async (ids) => {
      const [sessions, reps, plans] = await Promise.all([
        supabase
          .from('sessions')
          .select('created_at', { count: 'exact' })
          .in('player_id', ids)
          .or(VISIBLE_SESSION_FILTER)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase.from('reps').select('id', { count: 'exact', head: true }).in('player_id', ids),
        supabase
          .from('workout_plans')
          .select('id', { count: 'exact', head: true })
          .in('player_id', ids)
          .eq('is_template', false)
          .eq('is_completed', true),
      ]);
      const error = sessions.error ?? reps.error ?? plans.error;
      if (error) throw error;

      stamp.sessions += sessions.count ?? 0;
      stamp.reps += reps.count ?? 0;
      stamp.completedPlans += plans.count ?? 0;
      const newest = (sessions.data?.[0] as { created_at: string } | undefined)?.created_at ?? null;
      if (newest && (!stamp.newest || newest > stamp.newest)) stamp.newest = newest;
    })
  );
  return stamp;
};
