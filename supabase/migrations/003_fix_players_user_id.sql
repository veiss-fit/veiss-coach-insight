-- Fix: Add user_id to players table and link existing players
-- This ensures both existing and future players work correctly

-- Step 1: Add user_id column to players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Step 2: Add foreign key constraint
ALTER TABLE public.players
ADD CONSTRAINT fk_player_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

-- Step 4: Link existing players to their user accounts via profiles
UPDATE players p
SET user_id = pr.id
FROM profiles pr
WHERE pr.player_id = p.id
  AND p.user_id IS NULL
  AND pr.role = 'player';

-- Step 5: Update profiles to ensure all players have a profile entry
-- This ensures future players will work correctly
INSERT INTO public.profiles (id, role, player_id, full_name)
SELECT
    p.user_id,
    'player',
    p.id,
    p.full_name
FROM
    public.players p
LEFT JOIN
    public.profiles pr ON p.user_id = pr.id
WHERE
    p.user_id IS NOT NULL 
    AND pr.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 6: Add trigger to auto-create profile when a new player is added with user_id
CREATE OR REPLACE FUNCTION create_profile_for_player()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO profiles (id, role, player_id, full_name)
    VALUES (NEW.user_id, 'player', NEW.id, NEW.full_name)
    ON CONFLICT (id) DO UPDATE
    SET player_id = NEW.id, full_name = NEW.full_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_profile_for_player ON players;
CREATE TRIGGER trigger_create_profile_for_player
AFTER INSERT OR UPDATE OF user_id ON players
FOR EACH ROW
EXECUTE FUNCTION create_profile_for_player();

-- Step 7: Update RLS policies for players table
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view their own data." ON public.players;
CREATE POLICY "Players can view their own data." ON public.players
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Coaches can view players in their team." ON public.players;
CREATE POLICY "Coaches can view players in their team." ON public.players
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.coaches c
    WHERE c.user_id = auth.uid() AND c.team_id = players.team_id
  )
  OR
  -- Also allow coaches to see unassigned players (team_id is NULL)
  EXISTS (
    SELECT 1
    FROM public.coaches c
    WHERE c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Coaches can insert new players." ON public.players;
CREATE POLICY "Coaches can insert new players." ON public.players
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.coaches c
    WHERE c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Coaches can update players." ON public.players;
CREATE POLICY "Coaches can update players." ON public.players
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.coaches c
    WHERE c.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.coaches c
    WHERE c.user_id = auth.uid()
  )
);

COMMENT ON COLUMN players.user_id IS 'Links player record to Supabase auth user';

