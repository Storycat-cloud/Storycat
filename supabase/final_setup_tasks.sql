-- 1. Update/Create Admin with your custom credentials
-- First, ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Upsert the specific admin user
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
BEGIN
    -- Only insert if the email doesn't exist to avoid duplicates
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'storycatcreative@gmail.com') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', 
            new_user_id, 
            'authenticated', 
            'authenticated', 
            'storycatcreative@gmail.com', 
            crypt('Hostingerforstorycat@7697', gen_salt('bf')), 
            now(), 
            '{"provider": "email", "providers": ["email"]}', 
            '{"full_name": "Super Admin", "role": "admin"}', 
            now(), 
            now()
        );
        
        -- The trigger on_auth_user_created will handle the profile creation automatically.
    ELSE
        -- If user exists, just update the password and metadata to be sure
        UPDATE auth.users 
        SET encrypted_password = crypt('Hostingerforstorycat@7697', gen_salt('bf')),
            raw_user_meta_data = '{"full_name": "Super Admin", "role": "admin"}'
        WHERE email = 'storycatcreative@gmail.com';
        
        -- Also ensure profile is admin
        UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'storycatcreative@gmail.com');
    END IF;
END $$;

-- 2. Apply Strict Dedicated Assignment Logic
-- This is the latest logic: tasks only auto-assign if a dedicated member is set in Project Onboarding.
CREATE OR REPLACE FUNCTION public.get_best_assignee(p_item_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
    v_role_needed TEXT;
    v_best_user_id UUID;
    v_project_id UUID;
    v_dedicated_user_id UUID;
BEGIN
    -- Get task info
    SELECT ci.status, ci.project_id
    INTO v_status, v_project_id
    FROM public.content_items ci
    WHERE ci.id = p_item_id;

    -- Map status to role
    CASE v_status
        WHEN 'pending_dm' THEN v_role_needed := 'digital_marketing_manager';
        WHEN 'pending_copy' THEN v_role_needed := 'copywriter';
        WHEN 'pending_copy_qc' THEN v_role_needed := 'copy_qc';
        WHEN 'pending_design' THEN v_role_needed := 'designer';
        WHEN 'pending_design_qc' THEN v_role_needed := 'designer_qc';
        ELSE RETURN NULL;
    END CASE;

    -- GET DEDICATED ASSIGNEE
    SELECT 
        CASE v_status
            WHEN 'pending_dm' THEN dedicated_dm_id
            WHEN 'pending_copy' THEN dedicated_copywriter_id
            WHEN 'pending_copy_qc' THEN dedicated_copy_qc_id
            WHEN 'pending_design' THEN dedicated_designer_id
            WHEN 'pending_design_qc' THEN dedicated_designer_qc_id
            ELSE NULL
        END
    INTO v_dedicated_user_id
    FROM public.project_onboarding
    WHERE project_id = v_project_id;

    -- If there's a dedicated person, return them immediately if they exist and match the role
    IF v_dedicated_user_id IS NOT NULL THEN
        SELECT prof.id INTO v_best_user_id
        FROM public.profiles prof
        WHERE prof.id = v_dedicated_user_id
        AND prof.role = v_role_needed;
        
        IF v_best_user_id IS NOT NULL THEN
            RETURN v_best_user_id;
        END IF;
    END IF;

    -- RETURN NULL if no dedicated assignment is found (Manual assignment fallback)
    RETURN NULL;
END;
$$;

-- 3. Ensure all performance indexes are present
CREATE INDEX IF NOT EXISTS idx_content_items_is_admin_verified ON public.content_items(is_admin_verified);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_project_id ON public.project_onboarding(project_id);
CREATE INDEX IF NOT EXISTS idx_project_change_requests_project_id ON public.project_change_requests(project_id);

-- 4. Refresh Cache
NOTIFY pgrst, 'reload schema';
