-- Fix: scope the `players` RLS policies to the coach who actually owns them.
--
-- BACKGROUND (AUDIT_FINDINGS.md §3.1)
-- Migration 003 created three coach policies on `players` whose only condition was:
--     EXISTS (SELECT 1 FROM coaches c WHERE c.user_id = auth.uid())
-- i.e. "is the caller any coach at all" — with no ownership scoping whatsoever.
-- That granted EVERY authenticated coach SELECT / INSERT / UPDATE access to
-- EVERY other coach's players. This migration closes that cross-tenant hole.
--
-- SECOND, SEPARATE BUG FIXED HERE
-- 003's SELECT policy also had a first branch scoped as `c.team_id = players.team_id`,
-- i.e. a one-coach-owns-one-team model. The application does not use that model
-- anywhere: it resolves ownership as auth.uid() -> coaches.id -> groups.coach_id,
-- where a coach owns MANY groups (see getCoachId / getCoachTeamIds in
-- src/services/playersService.ts). `coaches.team_id` is not used for scoping in any
-- application code path, and is NULL for at least some live coach rows.
-- Fixing only the unscoped OR branch while leaving that first branch in place would
-- have closed the security hole but locked coaches out of all of their own assigned
-- players. Both branches are therefore rewritten against the real ownership model.
--
-- NOTE ON THE OR IN coach_owns_group()
-- `groups.coach_id` currently holds inconsistent values depending on which signup
-- path created the row: the immediate-session path (AuthContext.tsx) forces
-- coaches.id = auth uid so both agree, while the email-confirmation path
-- (AuthCallback.tsx) writes the auth uid into coach_id even though coaches.id is a
-- fresh generated UUID (AUDIT_FINDINGS.md §2.2). Until that bug is fixed and the
-- existing rows are backfilled, this function deliberately accepts either value so
-- the policy does not lock out coaches whose groups were created by the buggy path.
-- Once §2.2 is fixed AND historical rows are backfilled, the `OR g.coach_id = c.user_id`
-- clause below should be removed.

-- ---------------------------------------------------------------------------
-- Helper functions
--
-- These are SECURITY DEFINER so that referencing `groups` / `coaches` from inside a
-- policy on `players` does not re-enter those tables' own RLS policies, which is how
-- infinite-recursion RLS errors arise. search_path is pinned per Supabase guidance
-- for SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_coach() IS
  'True when the current auth user has a coaches row. Does NOT imply ownership of any particular group.';

CREATE OR REPLACE FUNCTION public.coach_owns_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    JOIN public.coaches c
      ON c.user_id = auth.uid()
     -- see "NOTE ON THE OR" above: tolerates both coach_id conventions
     AND (g.coach_id = c.id OR g.coach_id = c.user_id)
    WHERE g.id = p_group_id
  );
$$;

COMMENT ON FUNCTION public.coach_owns_group(uuid) IS
  'True when the current auth user is the coach who owns the given group (groups.coach_id -> coaches.id).';

-- ---------------------------------------------------------------------------
-- Players policies
-- ---------------------------------------------------------------------------

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Drop both the 003 names and this migration's names so re-running is safe.
DROP POLICY IF EXISTS "Coaches can view players in their team." ON public.players;
DROP POLICY IF EXISTS "Coaches can insert new players." ON public.players;
DROP POLICY IF EXISTS "Coaches can update players." ON public.players;
DROP POLICY IF EXISTS "Coaches can view players in their groups." ON public.players;
DROP POLICY IF EXISTS "Coaches can insert players into their groups." ON public.players;
DROP POLICY IF EXISTS "Coaches can update players in their groups." ON public.players;

-- SELECT: players in a group this coach owns, plus genuinely unassigned players
-- (team_id IS NULL belongs to no coach by definition — this is what 003's comment
-- intended before the missing NULL check made the branch unconditional).
CREATE POLICY "Coaches can view players in their groups." ON public.players
FOR SELECT USING (
  public.coach_owns_group(players.team_id)
  OR (players.team_id IS NULL AND public.is_coach())
);

-- INSERT: may only create a player directly into a group this coach owns
-- (or leave them unassigned).
CREATE POLICY "Coaches can insert players into their groups." ON public.players
FOR INSERT WITH CHECK (
  public.coach_owns_group(team_id)
  OR (team_id IS NULL AND public.is_coach())
);

-- UPDATE: USING gates which existing rows may be touched (the pre-update group),
-- WITH CHECK gates the post-update row. Both are required: USING alone would let a
-- coach move their own player into someone else's group, and WITH CHECK alone would
-- let them pull another coach's player out into their own.
CREATE POLICY "Coaches can update players in their groups." ON public.players
FOR UPDATE USING (
  public.coach_owns_group(players.team_id)
  OR (players.team_id IS NULL AND public.is_coach())
) WITH CHECK (
  public.coach_owns_group(team_id)
  OR (team_id IS NULL AND public.is_coach())
);

-- "Players can view their own data." (003) is intentionally left untouched.

-- ---------------------------------------------------------------------------
-- VERIFICATION (run manually as each coach, e.g. via Supabase SQL editor
-- impersonation or two browser sessions):
--
--   -- as coach A, with coach B's group id:
--   SELECT count(*) FROM players WHERE team_id = '<coach B group id>';
--   -- expected: 0 (was: coach B's full roster)
--
--   -- as coach A, attempting to steal one of coach B's players:
--   UPDATE players SET team_id = '<coach A group id>' WHERE id = '<coach B player id>';
--   -- expected: 0 rows updated (was: succeeded)
--
--   -- as coach A, sanity-check no regression on their OWN roster:
--   SELECT count(*) FROM players WHERE team_id = '<coach A group id>';
--   -- expected: unchanged from before this migration
-- ---------------------------------------------------------------------------
