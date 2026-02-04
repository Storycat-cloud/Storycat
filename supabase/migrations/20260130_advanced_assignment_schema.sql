-- 1. Extend Profiles for Capacity and Specialties
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_capacity INTEGER DEFAULT 50; -- Using CCUs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}';

-- 2. Extend Content Items for Complexity and Tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_load_score INTEGER DEFAULT 0; -- Real-time CCU load
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS complexity_weight INTEGER DEFAULT 1; -- CCUs (1-5)
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS assignment_attempts INTEGER DEFAULT 0;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS last_assignee_id UUID; -- For Loyalty Loop

-- 3. Buffer Configuration Table
CREATE TABLE IF NOT EXISTS public.buffer_configs (
    role TEXT PRIMARY KEY,
    buffer_days INTEGER NOT NULL,
    priority_weight INTEGER DEFAULT 1
);

-- Seed Buffer Configs
INSERT INTO public.buffer_configs (role, buffer_days, priority_weight) VALUES
('copywriter', 7, 10),
('copy_qc', 6, 8),
('designer', 4, 6),
('designer_qc', 3, 4)
ON CONFLICT (role) DO UPDATE SET buffer_days = EXCLUDED.buffer_days;

-- 4. Function to Calculate Current Load Score (Real-time CCUs)
CREATE OR REPLACE FUNCTION public.calculate_user_load(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_load INTEGER;
BEGIN
    SELECT COALESCE(SUM(complexity_weight), 0)
    INTO v_load
    FROM public.content_items
    WHERE (
        dm_assignee = p_user_id OR 
        copy_assignee = p_user_id OR 
        design_assignee = p_user_id OR 
        copy_qc_assignee = p_user_id OR 
        design_qc_assignee = p_user_id
    )
    AND (status NOT IN ('completed', 'archived'));
    
    RETURN v_load;
END;
$$;
