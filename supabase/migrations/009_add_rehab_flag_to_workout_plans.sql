-- Adds a rehab/return-to-play flag to workout_plans, so a coach can mark a
-- specific assigned plan (not a template) as part of an injury/recovery
-- process. Drives the athlete-detail "RTP trend" view, which filters to only
-- the sessions matching a rehab-tagged plan's date.
--
-- Plan-level, not per-exercise or per-session: sessions themselves are
-- written by the mobile app/hardware, not this dashboard, so tagging lives on
-- the one table this app can actually write to that also has a coach-facing
-- creation/edit UI (SendProgramming.tsx). A tagged plan's date is matched to
-- the athlete's actual logged session the same way attendance/target matching
-- already works elsewhere in this app (same-day match) — no new relational
-- link is added between workout_plans and sessions.

BEGIN;

ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS is_rehab boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workout_plans.is_rehab IS
  'True when this assigned plan is part of a rehab/return-to-play process. Coach-set at plan creation/edit time. Not used for templates. A player''s RTP trend view filters to sessions whose date matches a plan with is_rehab = true.';

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
--
--   -- Column exists, defaults to false, existing rows unaffected:
--   SELECT is_rehab, count(*) FROM public.workout_plans GROUP BY is_rehab;
--
--   -- Mark one plan as rehab and confirm it round-trips:
--   UPDATE public.workout_plans SET is_rehab = true WHERE id = '<some plan id>';
--   SELECT id, is_rehab FROM public.workout_plans WHERE id = '<some plan id>';
-- ---------------------------------------------------------------------------
