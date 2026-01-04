-- This script helps link existing players to their user accounts
-- Run this in Supabase SQL Editor

-- 1. First, check which players don't have user_id assigned
SELECT 
  p.id as player_id,
  p.full_name as player_name,
  p.user_id,
  pr.id as profile_user_id,
  pr.full_name as profile_name
FROM players p
LEFT JOIN profiles pr ON pr.player_id = p.id
WHERE p.user_id IS NULL
ORDER BY p.full_name;

-- 2. Link players to their user accounts (if profiles.player_id is set)
-- This updates players.user_id based on profiles.player_id relationship
UPDATE players p
SET user_id = pr.id
FROM profiles pr
WHERE pr.player_id = p.id
  AND p.user_id IS NULL
  AND pr.role = 'player';

-- 3. Verify the update
SELECT 
  p.id as player_id,
  p.full_name as player_name,
  p.user_id,
  p.team_id
FROM players p
ORDER BY p.full_name;

-- 4. If you have players without linked profiles, you can manually link them:
-- UPDATE players SET user_id = '[user-id-from-auth]' WHERE id = '[player-id]';

