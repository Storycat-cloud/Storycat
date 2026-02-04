-- Fix profile deletion error by updating foreign key constraints to ON DELETE SET NULL
-- This ensures that if an employee (profile) is deleted, the references in other tables are cleared instead of blocking the deletion.

-- 1. project_onboarding table
ALTER TABLE public.project_onboarding 
DROP CONSTRAINT IF EXISTS project_onboarding_dedicated_dm_id_fkey,
DROP CONSTRAINT IF EXISTS project_onboarding_dedicated_copywriter_id_fkey,
DROP CONSTRAINT IF EXISTS project_onboarding_dedicated_copy_qc_id_fkey,
DROP CONSTRAINT IF EXISTS project_onboarding_dedicated_designer_id_fkey,
DROP CONSTRAINT IF EXISTS project_onboarding_dedicated_designer_qc_id_fkey;

ALTER TABLE public.project_onboarding
ADD CONSTRAINT project_onboarding_dedicated_dm_id_fkey 
    FOREIGN KEY (dedicated_dm_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT project_onboarding_dedicated_copywriter_id_fkey 
    FOREIGN KEY (dedicated_copywriter_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT project_onboarding_dedicated_copy_qc_id_fkey 
    FOREIGN KEY (dedicated_copy_qc_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT project_onboarding_dedicated_designer_id_fkey 
    FOREIGN KEY (dedicated_designer_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT project_onboarding_dedicated_designer_qc_id_fkey 
    FOREIGN KEY (dedicated_designer_qc_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. content_items table
ALTER TABLE public.content_items
DROP CONSTRAINT IF EXISTS content_items_dm_assignee_fkey,
DROP CONSTRAINT IF EXISTS content_items_copy_assignee_fkey,
DROP CONSTRAINT IF EXISTS content_items_copy_qc_assignee_fkey,
DROP CONSTRAINT IF EXISTS content_items_design_assignee_fkey,
DROP CONSTRAINT IF EXISTS content_items_design_qc_assignee_fkey;

ALTER TABLE public.content_items
ADD CONSTRAINT content_items_dm_assignee_fkey 
    FOREIGN KEY (dm_assignee) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT content_items_copy_assignee_fkey 
    FOREIGN KEY (copy_assignee) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT content_items_copy_qc_assignee_fkey 
    FOREIGN KEY (copy_qc_assignee) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT content_items_design_assignee_fkey 
    FOREIGN KEY (design_assignee) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT content_items_design_qc_assignee_fkey 
    FOREIGN KEY (design_qc_assignee) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. projects table (created_by)
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_created_by_fkey;

ALTER TABLE public.projects
ADD CONSTRAINT projects_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. time_logs table (user_id)
ALTER TABLE public.time_logs
DROP CONSTRAINT IF EXISTS time_logs_user_id_fkey;

ALTER TABLE public.time_logs
ADD CONSTRAINT time_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
