-- Add user_id column to coaches table to link with Supabase auth users
ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON coaches(user_id);

-- Add comment
COMMENT ON COLUMN coaches.user_id IS 'Links coach record to Supabase auth user';

