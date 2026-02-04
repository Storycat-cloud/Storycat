-- Update the auto-assignment logic to be strictly based on dedicated team assignments
-- If no dedicated team member is assigned, it will return NULL, requiring manual assignment
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

    -- REMOVED COMPLEX SCORING ALGORITHM
    -- Instead, we simply return NULL if no dedicated assignment is found.
    -- This forces the system to wait for manual assignment or 
    -- we can pick the first available person with the role as a LAST RESORT if needed.
    -- For now, returning NULL as requested by "strictly" assigned flow.
    
    RETURN NULL;
END;
$$;
