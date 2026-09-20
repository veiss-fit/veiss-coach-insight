import { supabase } from '@/lib/supabase';

/**
 * Minimal coach_feedback service (Q4): free-text coach notes shown in the
 * athlete page's insight rail. Notes are coach_feedback rows with
 * feedback_type = 'note'.
 */

export interface CoachNote {
  id: string;
  message: string;
  createdAt: string;
}

const NOTE_TYPE = 'note';
const NOTE_TITLE = 'Coach note';

export const getPlayerCoachNotes = async (playerId: string, limit = 10): Promise<CoachNote[]> => {
  try {
    // Client generics collapse to `never` on filtered queries (pre-existing) — cast per codebase convention.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('coach_feedback')
      .select('id, message, created_at')
      .eq('player_id', playerId)
      .eq('feedback_type', NOTE_TYPE)
      .order('created_at', { ascending: false })
      .limit(limit) as { data: Array<{ id: string; message: string; created_at: string }> | null; error: unknown };

    if (error) {
      console.error('Error fetching coach notes:', error);
      return [];
    }
    return (data ?? []).map((row) => ({ id: row.id, message: row.message, createdAt: row.created_at }));
  } catch (error) {
    console.error('Error in getPlayerCoachNotes:', error);
    return [];
  }
};

/** Supabase's own explanation of a failure (message, code, details, hint), so the cause is visible instead of a generic "failed". */
const describeError = (error: unknown): string => {
  const e = error as { message?: string; code?: string; details?: string; hint?: string } | null;
  if (!e) return 'no data returned';
  return [e.message, e.code && `code ${e.code}`, e.details, e.hint].filter(Boolean).join(' · ') || 'unknown error';
};

/** Throws with the database's reason when the note cannot be saved. */
export const addCoachNote = async (
  playerId: string,
  coachId: string | null,
  message: string
): Promise<CoachNote> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('coach_feedback')
    .insert({
      player_id: playerId,
      coach_id: coachId,
      feedback_type: NOTE_TYPE,
      title: NOTE_TITLE,
      message,
    })
    .select('id, message, created_at')
    .single() as { data: { id: string; message: string; created_at: string } | null; error: unknown };

  if (error || !data) {
    console.error('Error adding coach note:', error);
    throw new Error(describeError(error));
  }
  return { id: data.id, message: data.message, createdAt: data.created_at };
};
