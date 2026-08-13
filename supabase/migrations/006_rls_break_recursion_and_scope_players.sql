-- Break the cross-table RLS recursion cycles, and properly scope `players`.
--
-- SUPERSEDES migration 005 (which was rolled back live). 005 replaced only three
-- of the nine policies on `players` and could not have worked: five more policies
-- existed that were created directly in the Supabase dashboard and were never in
-- source control, and because permissive policies are OR'd together, the leftover
-- unscoped ones kept granting every coach access to every other coach's players.
--
-- ---------------------------------------------------------------------------
-- WHY THE RECURSION HAPPENS (42P17: infinite recursion detected in policy)
--
-- The live policy set forms a cycle across four tables. Each arrow is a policy on
-- the left table whose USING/WITH CHECK expression sub-selects the right table,
-- which in turn causes that table's own policies to be expanded:
--
--     players  -> groups    ("Players can read their own record")
--     groups   -> players   ("Players can view their own group")
--     coaches  -> players   ("Players can view their team coach")
--     groups   -> coaches   ("Coaches can view own groups", "Coaches can manage own groups")
--     players  -> coaches   (several coach policies from migration 003)
--     profiles -> players    ("Coaches can view player profiles in their group",
--                             "Coaches can view team profiles")
--
-- Any SELECT on `players` can therefore reach `players` again through `groups` or
-- `coaches`, and Postgres aborts with 42P17.
--
-- THE FIX: no policy may sub-select another RLS-protected table directly. Every
-- cross-table lookup is moved into a SECURITY DEFINER function. Such a function
-- executes as its owner (postgres, which holds BYPASSRLS), so the tables it reads
-- inside do not have their policies expanded, and the cycle is cut structurally
-- rather than by hoping a particular query plan avoids it.
--
-- This is the same pattern already used elsewhere in this database by
-- get_my_coach_team_id().
--
-- ---------------------------------------------------------------------------
-- COMPATIBILITY NOTE — THE ATHLETE MOBILE APP READS THESE TABLES TOO
--
-- The player-side policies are rewritten to be *semantically identical* to what is
-- live today, only routed through helper functions. Specifically:
--   - a player still sees only their own `players` row,
--   - a player still sees only the group named by their own players.team_id,
--   - a player still sees only coaches whose coaches.team_id equals their team_id.
-- The last one is preserved deliberately even though coaches.team_id is the legacy
-- one-coach-one-team column and is NULL for several live coaches: "fixing" it here
-- would silently change what the mobile app can read. That belongs in its own
-- change, tested against the mobile app.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 1. Helper functions (all SECURITY DEFINER, pinned search_path)
-- ===========================================================================

-- Every group owned by the current coach.
-- The OR tolerates both conventions currently present in groups.coach_id: the
-- immediate-session signup path forces coaches.id = auth uid, while the
-- email-confirmation path writes the auth uid even though coaches.id is a fresh
-- UUID (AUDIT_FINDINGS.md §2.2). Drop the second branch once §2.2 is fixed AND the
-- historical rows are backfilled.
CREATE OR REPLACE FUNCTION public.my_coach_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id
  FROM groups g
  JOIN coaches c ON c.user_id = auth.uid()
  WHERE g.coach_id = c.id
     OR g.coach_id = c.user_id;
$$;

-- Every player belonging to one of the current coach's groups.
CREATE OR REPLACE FUNCTION public.my_coach_player_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM players p
  WHERE p.team_id IN (SELECT public.my_coach_group_ids());
$$;

-- The group id on the current user's own player row (NULL if they are not a player).
CREATE OR REPLACE FUNCTION public.my_player_team_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.team_id
  FROM players p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- The current user's coaches.id (NULL if they are not a coach).
CREATE OR REPLACE FUNCTION public.my_coach_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM public.coaches c WHERE c.user_id = auth.uid() LIMIT 1;
$$;

-- Does the current user have a coaches row at all? (No ownership implied.)
CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid());
$$;

-- Retained from 005 so any dependent object keeps resolving.
CREATE OR REPLACE FUNCTION public.coach_owns_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_group_id IN (SELECT public.my_coach_group_ids());
$$;


-- ===========================================================================
-- 2. players — replace ALL existing policies
--
-- Nine policies existed (three from migration 003, one from 005's rollback, five
-- created out-of-band in the dashboard). They are dropped wholesale and replaced
-- with a minimal set, because leaving any unscoped permissive policy in place
-- would OR the cross-tenant hole straight back open.
-- ===========================================================================

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches can insert new players." ON public.players;
DROP POLICY IF EXISTS "Coaches can update players." ON public.players;
DROP POLICY IF EXISTS "Coaches can view players in their team." ON public.players;
DROP POLICY IF EXISTS "Coaches can insert players in their team" ON public.players;
DROP POLICY IF EXISTS "Coaches can manage players in their team" ON public.players;
DROP POLICY IF EXISTS "Coaches can read all players in their team" ON public.players;
DROP POLICY IF EXISTS "Players can read their own record" ON public.players;
DROP POLICY IF EXISTS "Players can update their own record" ON public.players;
DROP POLICY IF EXISTS "Players can view their own data." ON public.players;
-- names introduced by 005
DROP POLICY IF EXISTS "Coaches can view players in their groups." ON public.players;
DROP POLICY IF EXISTS "Coaches can insert players into their groups." ON public.players;
DROP POLICY IF EXISTS "Coaches can update players in their groups." ON public.players;
-- names introduced by this migration (idempotent re-run)
DROP POLICY IF EXISTS "players_select_own" ON public.players;
DROP POLICY IF EXISTS "players_update_own" ON public.players;
DROP POLICY IF EXISTS "players_select_coach" ON public.players;
DROP POLICY IF EXISTS "players_insert_coach" ON public.players;
DROP POLICY IF EXISTS "players_update_coach" ON public.players;

-- Player reads/updates their own row (mobile app).
CREATE POLICY "players_select_own" ON public.players
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "players_update_own" ON public.players
FOR UPDATE USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Coach reads players in groups they own, plus unassigned players (team_id IS NULL
-- belongs to no coach by definition — this is what migration 003's comment intended
-- before a missing NULL check made that branch unconditional).
CREATE POLICY "players_select_coach" ON public.players
FOR SELECT USING (
  team_id IN (SELECT public.my_coach_group_ids())
  OR (team_id IS NULL AND public.is_coach())
);

CREATE POLICY "players_insert_coach" ON public.players
FOR INSERT WITH CHECK (
  team_id IN (SELECT public.my_coach_group_ids())
  OR (team_id IS NULL AND public.is_coach())
);

-- USING gates which existing rows may be touched (pre-update group); WITH CHECK
-- gates the resulting row. Both are needed: USING alone would let a coach push
-- their own player into someone else's group, WITH CHECK alone would let them pull
-- another coach's player into theirs.
CREATE POLICY "players_update_coach" ON public.players
FOR UPDATE USING (
  team_id IN (SELECT public.my_coach_group_ids())
  OR (team_id IS NULL AND public.is_coach())
)
WITH CHECK (
  team_id IN (SELECT public.my_coach_group_ids())
  OR (team_id IS NULL AND public.is_coach())
);


-- ===========================================================================
-- 3. groups — same policy intent, routed through helpers so no cycle remains
-- ===========================================================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches can manage own groups" ON public.groups;
DROP POLICY IF EXISTS "Coaches can view own groups" ON public.groups;
DROP POLICY IF EXISTS "Players can view their own group" ON public.groups;
DROP POLICY IF EXISTS "groups_all_coach" ON public.groups;
DROP POLICY IF EXISTS "groups_select_player" ON public.groups;

-- Coach full control over groups they own. Note this is FOR ALL, so its WITH CHECK
-- also governs INSERT: a coach may only create a group owned by themselves, which
-- the previous version likewise allowed via coach_id = auth.uid().
CREATE POLICY "groups_all_coach" ON public.groups
FOR ALL USING (
  id IN (SELECT public.my_coach_group_ids())
)
WITH CHECK (
  coach_id = auth.uid()
  OR coach_id = public.my_coach_id()
);

-- Player sees only their own group (semantics preserved exactly).
CREATE POLICY "groups_select_player" ON public.groups
FOR SELECT USING (id = public.my_player_team_id());


-- ===========================================================================
-- 4. coaches — only the one recursive policy is rewritten
--
-- "Coaches can insert their own row", "Coaches can update their own row",
-- "Coaches can view own row and same-team coaches" and the admin policy are all
-- left untouched: they reference only auth.uid() or the pre-existing
-- get_my_coach_team_id() helper, so none of them can recurse.
-- ===========================================================================

DROP POLICY IF EXISTS "Players can view their team coach" ON public.coaches;
DROP POLICY IF EXISTS "coaches_select_player" ON public.coaches;

-- Semantics preserved exactly: a player sees coaches whose legacy coaches.team_id
-- matches their own team_id. See the compatibility note at the top of this file.
CREATE POLICY "coaches_select_player" ON public.coaches
FOR SELECT USING (team_id = public.my_player_team_id());


-- ===========================================================================
-- 5. profiles — the two coach policies sub-select players; route via helper
-- ===========================================================================

DROP POLICY IF EXISTS "Coaches can view player profiles in their group" ON public.profiles;
DROP POLICY IF EXISTS "Coaches can view team profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_coach_players" ON public.profiles;

-- Union of what the two dropped policies granted: a coach may read the profile rows
-- of players in groups they own.
CREATE POLICY "profiles_select_coach_players" ON public.profiles
FOR SELECT USING (
  player_id IN (SELECT public.my_coach_player_ids())
);

-- "Users can view/insert/update their own profile" and "Service role full access"
-- are left untouched; they reference only auth.uid()/auth.role().


-- ===========================================================================
-- VERIFICATION
--
--   -- 1. no recursion, and no lockout: Coach Veiss should still see 4 (+unassigned)
--   BEGIN;
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"35a56bbc-3894-488f-b54a-f72e312652cc","role":"authenticated"}';
--     SELECT count(*) FROM players;
--   ROLLBACK;
--
--   -- 2. hole closed: Jim Huxel must NOT see Coach Veiss's players
--   BEGIN;
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"8b76d0da-38c5-4550-9e63-8a890f4a289c","role":"authenticated"}';
--     SELECT count(*) FROM players;
--   ROLLBACK;
--
--   -- 3. groups still readable by their owner (dashboard group list)
--   BEGIN;
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"35a56bbc-3894-488f-b54a-f72e312652cc","role":"authenticated"}';
--     SELECT count(*) FROM groups;
--   ROLLBACK;
--
--   -- 4. MOBILE APP regression check — impersonate a real player user_id and confirm
--   --    they still see their own row, their group, and their coach:
--   BEGIN;
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"<A REAL PLAYER user_id>","role":"authenticated"}';
--     SELECT count(*) AS own_player_row FROM players;   -- expect 1
--     SELECT count(*) AS own_group       FROM groups;    -- expect 1 (0 if unassigned)
--     SELECT count(*) AS my_coach        FROM coaches;   -- expect same as before this migration
--   ROLLBACK;
-- ===========================================================================
