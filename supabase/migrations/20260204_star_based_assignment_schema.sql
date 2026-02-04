-- Phase 1: Add Star Ratings and Role-Specific Capacity to Profiles
-- This migration adds the foundation for star-based dynamic assignment

-- 1. Add star rating and role-specific capacity columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS star_rating INTEGER DEFAULT 3 CHECK (star_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS daily_copy_capacity INTEGER DEFAULT 0 CHECK (daily_copy_capacity >= 0),
ADD COLUMN IF NOT EXISTS daily_design_capacity INTEGER DEFAULT 0 CHECK (daily_design_capacity >= 0),
ADD COLUMN IF NOT EXISTS daily_qc_capacity INTEGER DEFAULT 0 CHECK (daily_qc_capacity >= 0);

-- 2. Add client star rating to project_onboarding
ALTER TABLE public.project_onboarding
ADD COLUMN IF NOT EXISTS client_star_rating INTEGER DEFAULT 3 CHECK (client_star_rating BETWEEN 1 AND 5);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_star_rating ON public.profiles(star_rating);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_client_star_rating ON public.project_onboarding(client_star_rating);

-- 4. Add helpful comments
COMMENT ON COLUMN public.profiles.star_rating IS 'Employee quality/skill rating (1-5 stars). Employees can only work on projects with client_star_rating <= their star_rating';
COMMENT ON COLUMN public.profiles.daily_copy_capacity IS 'Number of copywriting items this employee can handle per day';
COMMENT ON COLUMN public.profiles.daily_design_capacity IS 'Number of design items this employee can handle per day';
COMMENT ON COLUMN public.profiles.daily_qc_capacity IS 'Number of QC items this employee can handle per day';
COMMENT ON COLUMN public.project_onboarding.client_star_rating IS 'Client quality tier (1-5 stars). Determines minimum employee star_rating required';
