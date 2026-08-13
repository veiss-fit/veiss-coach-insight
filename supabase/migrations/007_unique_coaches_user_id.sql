-- Prevent duplicate coaches rows for the same auth user (AUDIT_FINDINGS.md §1.3).
--
-- AuthCallback checks for an existing coaches row and inserts if absent. That
-- check-then-act is not atomic, and migration 001 only added a NON-unique index on
-- coaches.user_id, so nothing at the DB level stops two concurrent runs from both
-- observing "no row" and both inserting. Two navigations to the confirmation link
-- close together are enough: a double click, the link opened in two tabs, or an
-- email security scanner prefetching the URL before the user clicks it.
--
-- The result is two coaches rows for one user_id. Whichever profiles.coach_id
-- update lands last wins arbitrarily, and the other row becomes an orphan that
-- getCoachId()'s .single() can then trip over.
--
-- ensureCoachSetup() narrows the window in application code, but only a unique
-- constraint closes it: the loser of the race now fails loudly instead of
-- silently corrupting state.

-- Guard: report duplicates rather than failing the migration with a bare
-- constraint violation, so they can be merged deliberately.
DO $$
DECLARE
  dupe_count integer;
BEGIN
  SELECT count(*) INTO dupe_count
  FROM (
    SELECT user_id
    FROM public.coaches
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) > 1
  ) d;

  IF dupe_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add unique constraint: % auth user(s) have multiple coaches rows. Resolve them first, e.g.: SELECT user_id, array_agg(id) FROM public.coaches WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1;',
      dupe_count;
  END IF;
END $$;

-- Partial unique index rather than a table constraint: user_id is nullable, and
-- NULLs must stay exempt (legacy coaches rows predating migration 001 may have no
-- linked auth user). Postgres treats NULLs as distinct in unique indexes anyway,
-- but the explicit WHERE documents the intent.
CREATE UNIQUE INDEX IF NOT EXISTS coaches_user_id_unique
  ON public.coaches (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON INDEX public.coaches_user_id_unique IS
  'One coaches row per auth user. Makes the check-then-insert in ensureCoachSetup race-safe (AUDIT_FINDINGS.md §1.3).';
