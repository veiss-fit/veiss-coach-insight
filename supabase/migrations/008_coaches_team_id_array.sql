-- Convert coaches.team_id from a single legacy uuid into a uuid[] holding every
-- group the coach owns, kept in sync automatically whenever a group's coach_id
-- changes. This closes the gap where creating a group in "Manage Groups" never
-- touched coaches.team_id, and a coach could only ever be linked to one team.
--
-- ---------------------------------------------------------------------------
-- READ THIS BEFORE RUNNING
--
-- coaches.team_id is not tracked anywhere as a table definition in this
-- migrations folder (the base `coaches` table predates this repo's migration
-- history). A first run of this migration confirmed live objects depending on
-- it being a *scalar* uuid, now all accounted for below:
--
--   1. A foreign key (coaches_team_id_fkey) from coaches.team_id -> groups.id,
--      used by src/lib/supabase.ts's old `groups!coaches_team_id_fkey(*)`
--      embed (already removed from app code in this change).
--   2. get_my_coach_team_id() — a SECURITY DEFINER helper (confirmed live via
--      pg_proc): `SELECT team_id FROM public.coaches WHERE user_id = auth.uid()
--      LIMIT 1`, declared RETURNS uuid. Recreated below as RETURNS uuid[].
--   3. The RLS policy "Coaches can view own row and same-team coaches" on
--      `coaches` (confirmed live via pg_policies):
--        USING ((user_id = auth.uid()) OR (team_id = get_my_coach_team_id()))
--      i.e. a coach sees their own row, or any coach sharing their team.
--      Recreated below using array overlap (&&) instead of scalar equality.
--   4. "coaches_select_player" (tracked, migration 006): USING (team_id =
--      my_player_team_id()). Recreated below using ANY(team_id).
--   5. Six policies on three tables NOT tracked anywhere in this repo —
--      `reps`, `sessions`, `workouts` (none of these three appear in
--      CLAUDE.md or any migration; `workouts` in particular is not the same
--      table as `workout_plans`, which is the one this app's code uses) —
--      each named "Coaches can manage/read their players <table>", joining
--      `coaches c ON (c.team_id = p.team_id)`. Confirmed live via a full
--      `pg_policies` scan for '%team_id%' across every table.
--
--      IMPORTANT: this scalar join means a coach who owns MORE than one group
--      can currently only see reps/sessions/workouts for players in whichever
--      ONE group happens to match their legacy team_id — silently missing
--      data for players in their other groups. Recreated below using
--      public.my_coach_player_ids() (the same helper migration 006 already
--      uses for `players`/`profiles`), which naturally fixes this: once
--      team_id is an array there is no scalar value left to arbitrarily prefer.
--
-- Dropping get_my_coach_team_id() itself (step 1 below) is deliberately kept
-- in the sequence: if any OTHER live policy on any OTHER table also calls it
-- (invisible from this repo), Postgres will refuse the DROP FUNCTION and name
-- that policy, and this whole transaction rolls back cleanly rather than
-- leaving anything half-converted. Do not force past that error — find out
-- what it is first:
--   SELECT tablename, policyname, qual, with_check FROM pg_policies
--   WHERE qual ILIKE '%team_id%' OR with_check ILIKE '%team_id%';
-- ---------------------------------------------------------------------------

BEGIN;

-- 1. Drop everything that depends on team_id being scalar, in dependency
--    order: policies first (so the function and column are free), then the
--    function, then the FK.
DROP POLICY IF EXISTS "Coaches can view own row and same-team coaches" ON public.coaches;
DROP POLICY IF EXISTS "coaches_select_player" ON public.coaches;
DROP POLICY IF EXISTS "Coaches can manage their players reps" ON public.reps;
DROP POLICY IF EXISTS "Coaches can read their players reps" ON public.reps;
DROP POLICY IF EXISTS "Coaches can manage their players sessions" ON public.sessions;
DROP POLICY IF EXISTS "Coaches can read their players sessions" ON public.sessions;
DROP POLICY IF EXISTS "Coaches can manage their players workouts" ON public.workouts;
DROP POLICY IF EXISTS "Coaches can read their players workouts" ON public.workouts;
DROP FUNCTION IF EXISTS public.get_my_coach_team_id();
ALTER TABLE public.coaches DROP CONSTRAINT IF EXISTS coaches_team_id_fkey;

-- 2. Convert the column. Each existing scalar value becomes a single-element
--    array; NULL becomes an empty array rather than an array containing NULL.
ALTER TABLE public.coaches
  ALTER COLUMN team_id TYPE uuid[]
  USING (CASE WHEN team_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[team_id] END),
  ALTER COLUMN team_id SET DEFAULT '{}'::uuid[];

-- 3. Backfill: union each coach's (now-wrapped) old scalar value with every
--    group they actually own via groups.coach_id — the real source of truth.
--    This corrects any historical drift between the legacy scalar and actual
--    group ownership in the same pass.
UPDATE public.coaches c
SET team_id = COALESCE((
  SELECT array_agg(DISTINCT gid)
  FROM (
    SELECT unnest(c.team_id) AS gid
    UNION
    SELECT g.id FROM public.groups g WHERE g.coach_id = c.id
  ) unioned
), '{}'::uuid[]);

-- 4. Trigger: keep coaches.team_id in sync whenever a group is created,
--    reassigned to a different coach, or deleted. This is what makes
--    "Manage Groups -> Add Group" reflect in coaches.team_id automatically.
CREATE OR REPLACE FUNCTION public.sync_coach_team_ids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.coach_id IS NOT NULL THEN
    UPDATE public.coaches c
    SET team_id = COALESCE(
      (SELECT array_agg(DISTINCT g.id) FROM public.groups g WHERE g.coach_id = c.id),
      '{}'::uuid[]
    )
    WHERE c.id = NEW.coach_id;
  END IF;

  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.coach_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.coach_id IS DISTINCT FROM NEW.coach_id) THEN
    UPDATE public.coaches c
    SET team_id = COALESCE(
      (SELECT array_agg(DISTINCT g.id) FROM public.groups g WHERE g.coach_id = c.id),
      '{}'::uuid[]
    )
    WHERE c.id = OLD.coach_id;
  END IF;

  RETURN NULL; -- AFTER trigger: return value ignored
END;
$$;

DROP TRIGGER IF EXISTS groups_sync_coach_team_ids ON public.groups;
CREATE TRIGGER groups_sync_coach_team_ids
AFTER INSERT OR UPDATE OF coach_id OR DELETE ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.sync_coach_team_ids();

-- 5. Recreate get_my_coach_team_id(), now returning every team the caller
--    coaches instead of a single one. Body is unchanged — it already reads
--    team_id, which is an array as of step 2.
CREATE FUNCTION public.get_my_coach_team_id()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.coaches WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 6. Recreate the two policies dropped in step 1, both now array-aware.
--    "coaches_select_player" (migration 006): a player still sees only
--    coaches whose team_id includes the player's own group.
CREATE POLICY "coaches_select_player" ON public.coaches
FOR SELECT USING (public.my_player_team_id() = ANY(team_id));

--    "Coaches can view own row and same-team coaches": semantics preserved —
--    a coach sees their own row, or any coach who shares at least one team
--    with them (scalar equality -> array overlap).
CREATE POLICY "Coaches can view own row and same-team coaches" ON public.coaches
FOR SELECT USING (
  (user_id = auth.uid()) OR (team_id && public.get_my_coach_team_id())
);

-- 7. Recreate the six reps/sessions/workouts policies dropped in step 1,
--    routed through my_coach_player_ids() instead of a direct coaches join —
--    this also fixes the "only sees one group's data" bug described above,
--    since a coach's full player set is now considered, not one legacy team.
CREATE POLICY "Coaches can manage their players reps" ON public.reps
FOR ALL USING (player_id IN (SELECT public.my_coach_player_ids()));

CREATE POLICY "Coaches can read their players reps" ON public.reps
FOR SELECT USING (player_id IN (SELECT public.my_coach_player_ids()));

CREATE POLICY "Coaches can manage their players sessions" ON public.sessions
FOR ALL USING (player_id IN (SELECT public.my_coach_player_ids()));

CREATE POLICY "Coaches can read their players sessions" ON public.sessions
FOR SELECT USING (player_id IN (SELECT public.my_coach_player_ids()));

CREATE POLICY "Coaches can manage their players workouts" ON public.workouts
FOR ALL USING (player_id IN (SELECT public.my_coach_player_ids()));

CREATE POLICY "Coaches can read their players workouts" ON public.workouts
FOR SELECT USING (player_id IN (SELECT public.my_coach_player_ids()));

COMMENT ON COLUMN public.coaches.team_id IS
  'All group ids owned by this coach (groups.coach_id). Kept in sync automatically by trigger groups_sync_coach_team_ids — do not write to this column directly from application code.';

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
--
--   -- Every coach's team_id should now exactly match their groups.coach_id set:
--   SELECT c.id, c.full_name, c.team_id,
--          (SELECT array_agg(g.id) FROM public.groups g WHERE g.coach_id = c.id) AS actual_groups
--   FROM public.coaches c;
--
--   -- Trigger fires on new group creation:
--   INSERT INTO public.groups (name, coach_id) VALUES ('Trigger test', '<a coach id>');
--   SELECT team_id FROM public.coaches WHERE id = '<that coach id>'; -- should include the new group's id
--   DELETE FROM public.groups WHERE name = 'Trigger test';
--
--   -- MOBILE APP regression check — a real player should still see their coach:
--   BEGIN;
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"<A REAL PLAYER user_id>","role":"authenticated"}';
--     SELECT count(*) FROM coaches; -- expect same as before this migration
--   ROLLBACK;
--
--   -- A multi-group coach should now see reps/sessions/workouts for players in
--   -- ALL of their groups, not just the one their legacy team_id happened to be:
--   BEGIN;
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"<A COACH user_id WITH >1 GROUP>","role":"authenticated"}';
--     SELECT count(*) FROM reps;     -- compare against a manual count via players.team_id
--     SELECT count(*) FROM sessions;
--     SELECT count(*) FROM workouts;
--   ROLLBACK;
-- ---------------------------------------------------------------------------
