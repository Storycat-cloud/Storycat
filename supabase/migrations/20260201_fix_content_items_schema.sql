-- Ensure all required columns for the advanced assignment system exist
-- This fixes the "complexity_weight column missing" error

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS weekly_capacity INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS current_load_score INTEGER DEFAULT 0;

ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS complexity_weight INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assignment_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_assignee_id UUID;

-- Refresh PostgREST schema cache
-- Note: This might require superuser privileges in some environments, 
-- but it's the standard way to reload schema in Supabase.
NOTIFY pgrst, 'reload schema';
