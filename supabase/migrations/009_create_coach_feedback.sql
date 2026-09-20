-- Create coach_feedback, the table behind the coach notes on the athlete page
-- (src/services/coachFeedbackService.ts). It was defined in src/types/database.ts but
-- never created in the live database (PGRST205: table not found in the schema cache).
--
-- Columns match the TypeScript types in src/types/database.ts. Notes are rows with
-- feedback_type = 'note'.
--
-- RLS follows migration 006: every cross-table lookup goes through a SECURITY DEFINER
-- helper (my_coach_player_ids, my_coach_id), so no policy here can recurse.
--   - a coach reads, writes and deletes feedback for players in groups they own;
--   - a player reads feedback addressed to their own player row (mobile app), and can
--     mark it read.
--
-- session_id has no foreign key on purpose: the type of sessions.id was not checked
-- against the live database. Add one later if it is uuid.

CREATE TABLE IF NOT EXISTS public.coach_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  coach_id     uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  session_id   uuid,
  feedback_type text NOT NULL,
  title        text NOT NULL,
  message      text NOT NULL,
  metrics      jsonb,
  action_items jsonb,
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_feedback_player_type_created_idx
  ON public.coach_feedback (player_id, feedback_type, created_at DESC);

ALTER TABLE public.coach_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_feedback_all_coach" ON public.coach_feedback;
DROP POLICY IF EXISTS "coach_feedback_select_player" ON public.coach_feedback;
DROP POLICY IF EXISTS "coach_feedback_update_player" ON public.coach_feedback;

-- Coach: full control over feedback for their own players. The check also stops a
-- coach from writing a note under another coach's id.
CREATE POLICY "coach_feedback_all_coach" ON public.coach_feedback
FOR ALL USING (
  player_id IN (SELECT public.my_coach_player_ids())
)
WITH CHECK (
  player_id IN (SELECT public.my_coach_player_ids())
  AND (coach_id IS NULL OR coach_id = public.my_coach_id())
);

-- Player: reads feedback on their own player row, and may update it (mark as read).
CREATE POLICY "coach_feedback_select_player" ON public.coach_feedback
FOR SELECT USING (
  player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid())
);

CREATE POLICY "coach_feedback_update_player" ON public.coach_feedback
FOR UPDATE USING (
  player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid())
)
WITH CHECK (
  player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid())
);

-- Make PostgREST pick the new table up without waiting for its schema cache to expire.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- VERIFICATION (replace the sub with a real coach user id; expect 1 row, then 0)
--   BEGIN;
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"<COACH auth user id>","role":"authenticated"}';
--     INSERT INTO coach_feedback (player_id, coach_id, feedback_type, title, message)
--       VALUES ('<a player id in that coach''s group>', public.my_coach_id(), 'note', 'Coach note', 'test');
--     SELECT count(*) FROM coach_feedback;
--   ROLLBACK;
-- ---------------------------------------------------------------------------
