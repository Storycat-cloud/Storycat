-- Enhanced auto-assignment for stage-based workflow
-- This replaces the old status-based assignment with current_stage logic

-- 1. Add assignment_pending flag to content_items
ALTER TABLE public.content_items
ADD COLUMN IF NOT EXISTS assignment_pending BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_content_items_assignment_pending 
ON public.content_items(assignment_pending) WHERE assignment_pending = TRUE;

-- 2. Create function to map stage to role
CREATE OR REPLACE FUNCTION public.get_role_for_stage(p_stage content_stage)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_stage
        WHEN 'admin' THEN 'admin'
        WHEN 'digital_marketer' THEN 'digital_marketing_manager'
        WHEN 'copywriter' THEN 'copywriter'
        WHEN 'copy_qc' THEN 'copy_qc'
        WHEN 'designer' THEN 'designer'
        WHEN 'design_qc' THEN 'designer_qc'
        WHEN 'digital_marketer_posting' THEN 'digital_marketing_manager'
        ELSE NULL
    END;
$$;

-- 3. Enhanced auto-assignment function
CREATE OR REPLACE FUNCTION public.assign_content_item(p_content_item_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_stage content_stage;
    v_role_needed TEXT;
    v_client_stars INTEGER;
    v_complexity INTEGER;
    v_project_id UUID;
    v_publish_date DATE;
    v_assignee_id UUID;
    v_previous_item_id UUID;
    v_previous_assignee UUID;
BEGIN
    -- Get content item details
    SELECT 
        ci.current_stage,
        ci.complexity_weight,
        ci.project_id,
        ci.publish_date,
        COALESCE(po.client_star_rating, 3)
    INTO 
        v_current_stage,
        v_complexity,
        v_project_id,
        v_publish_date,
        v_client_stars
    FROM public.content_items ci
    LEFT JOIN public.project_onboarding po ON po.project_id = ci.project_id
    WHERE ci.id = p_content_item_id;

    -- Skip if completed or no stage
    IF v_current_stage IS NULL OR v_current_stage = 'completed' THEN
        RETURN NULL;
    END IF;

    -- Get required role for this stage
    v_role_needed := public.get_role_for_stage(v_current_stage);
    
    IF v_role_needed IS NULL THEN
        RETURN NULL;
    END IF;

    -- Check for dedicated assignment (DM only)
    IF v_current_stage IN ('digital_marketer', 'digital_marketer_posting') THEN
        SELECT dedicated_dm_id INTO v_assignee_id
        FROM public.project_onboarding
        WHERE project_id = v_project_id
        AND dedicated_dm_id IS NOT NULL;
        
        IF v_assignee_id IS NOT NULL THEN
            -- Update the assignee field
            UPDATE public.content_items
            SET dm_assignee = v_assignee_id,
                assignment_pending = FALSE
            WHERE id = p_content_item_id;
            
            RETURN v_assignee_id;
        END IF;
    END IF;

    -- Find the immediately previous content item for this project
    -- (to avoid assigning the same person consecutively)
    SELECT id INTO v_previous_item_id
    FROM public.content_items
    WHERE project_id = v_project_id
    AND id != p_content_item_id
    AND publish_date < v_publish_date
    ORDER BY publish_date DESC
    LIMIT 1;

    -- Get who worked on the previous item at this stage
    IF v_previous_item_id IS NOT NULL THEN
        SELECT CASE v_current_stage
            WHEN 'digital_marketer' THEN dm_assignee
            WHEN 'copywriter' THEN copy_assignee
            WHEN 'copy_qc' THEN copy_qc_assignee
            WHEN 'designer' THEN design_assignee
            WHEN 'design_qc' THEN design_qc_assignee
            WHEN 'digital_marketer_posting' THEN dm_assignee
            ELSE NULL
        END INTO v_previous_assignee
        FROM public.content_items
        WHERE id = v_previous_item_id;
    END IF;

    -- ENHANCED ASSIGNMENT ALGORITHM
    -- Find best employee based on:
    -- 1. Role match
    -- 2. Star rating >= client star rating
    -- 3. Has available capacity
    -- 4. NOT the previous assignee (rotation)
    -- 5. Lowest current workload (even distribution)
    
    SELECT prof.id INTO v_assignee_id
    FROM public.profiles prof
    WHERE prof.role = v_role_needed
    AND COALESCE(prof.star_rating, 3) >= v_client_stars -- Star rating gate
    AND prof.id != COALESCE(v_previous_assignee, '00000000-0000-0000-0000-000000000000'::UUID) -- Avoid previous assignee
    AND (
        -- Capacity check based on role
        CASE 
            WHEN v_role_needed IN ('copywriter', 'copy_qc') THEN 
                COALESCE(prof.daily_copy_capacity, 0) > 0 
                AND (COALESCE(prof.daily_copy_capacity, 0) * 5 - public.calculate_user_load(prof.id)) >= v_complexity
            WHEN v_role_needed IN ('designer', 'designer_qc') THEN 
                COALESCE(prof.daily_design_capacity, 0) > 0
                AND (COALESCE(prof.daily_design_capacity, 0) * 5 - public.calculate_user_load(prof.id)) >= v_complexity
            WHEN v_role_needed = 'digital_marketing_manager' THEN 
                (COALESCE(prof.weekly_capacity, 50) - public.calculate_user_load(prof.id)) >= v_complexity
            ELSE TRUE -- Admin or other roles
        END
    )
    ORDER BY 
        -- 1. Prefer exact star match over over-qualified
        (CASE WHEN prof.star_rating = v_client_stars THEN 20 ELSE 0 END) +
        -- 2. Prefer employees with more available capacity (even distribution)
        (CASE 
            WHEN v_role_needed IN ('copywriter', 'copy_qc') THEN 
                ((COALESCE(prof.daily_copy_capacity, 0) * 5) - public.calculate_user_load(prof.id))
            WHEN v_role_needed IN ('designer', 'designer_qc') THEN 
                ((COALESCE(prof.daily_design_capacity, 0) * 5) - public.calculate_user_load(prof.id))
            ELSE 
                (COALESCE(prof.weekly_capacity, 50) - public.calculate_user_load(prof.id))
        END) DESC,
        -- 3. Random for rotation among equals
        random()
    LIMIT 1;

    -- If no assignee found, try again WITHOUT the previous-assignee restriction
    IF v_assignee_id IS NULL THEN
        SELECT prof.id INTO v_assignee_id
        FROM public.profiles prof
        WHERE prof.role = v_role_needed
        AND COALESCE(prof.star_rating, 3) >= v_client_stars
        AND (
            CASE 
                WHEN v_role_needed IN ('copywriter', 'copy_qc') THEN 
                    COALESCE(prof.daily_copy_capacity, 0) > 0 
                    AND (COALESCE(prof.daily_copy_capacity, 0) * 5 - public.calculate_user_load(prof.id)) >= v_complexity
                WHEN v_role_needed IN ('designer', 'designer_qc') THEN 
                    COALESCE(prof.daily_design_capacity, 0) > 0
                    AND (COALESCE(prof.daily_design_capacity, 0) * 5 - public.calculate_user_load(prof.id)) >= v_complexity
                WHEN v_role_needed = 'digital_marketing_manager' THEN 
                    (COALESCE(prof.weekly_capacity, 50) - public.calculate_user_load(prof.id)) >= v_complexity
                ELSE TRUE
            END
        )
        ORDER BY 
            (CASE WHEN prof.star_rating = v_client_stars THEN 20 ELSE 0 END) +
            (CASE 
                WHEN v_role_needed IN ('copywriter', 'copy_qc') THEN 
                    ((COALESCE(prof.daily_copy_capacity, 0) * 5) - public.calculate_user_load(prof.id))
                WHEN v_role_needed IN ('designer', 'designer_qc') THEN 
                    ((COALESCE(prof.daily_design_capacity, 0) * 5) - public.calculate_user_load(prof.id))
                ELSE 
                    (COALESCE(prof.weekly_capacity, 50) - public.calculate_user_load(prof.id))
            END) DESC,
            random()
        LIMIT 1;
    END IF;

    -- Update the content item with assignee or mark as pending
    IF v_assignee_id IS NOT NULL THEN
        -- Successful assignment
        UPDATE public.content_items
        SET 
            dm_assignee = CASE WHEN v_current_stage IN ('digital_marketer', 'digital_marketer_posting') THEN v_assignee_id ELSE dm_assignee END,
            copy_assignee = CASE WHEN v_current_stage = 'copywriter' THEN v_assignee_id ELSE copy_assignee END,
            copy_qc_assignee = CASE WHEN v_current_stage = 'copy_qc' THEN v_assignee_id ELSE copy_qc_assignee END,
            design_assignee = CASE WHEN v_current_stage = 'designer' THEN v_assignee_id ELSE design_assignee END,
            design_qc_assignee = CASE WHEN v_current_stage = 'design_qc' THEN v_assignee_id ELSE design_qc_assignee END,
            assignment_pending = FALSE
        WHERE id = p_content_item_id;
    ELSE
        -- No eligible user found - mark for manual assignment
        UPDATE public.content_items
        SET assignment_pending = TRUE
        WHERE id = p_content_item_id;
    END IF;

    RETURN v_assignee_id;
END;
$$;

-- 4. Update advance_content_stage to use the new assignment function
-- (This is already done in the previous migration, but we ensure it's correct)

COMMENT ON FUNCTION public.assign_content_item(UUID) IS 'Stage-aware auto-assignment with star matching, capacity checking, anti-repetition, workload balancing, and rotation. Marks as assignment_pending if no eligible user found.';
COMMENT ON COLUMN public.content_items.assignment_pending IS 'TRUE when no eligible user could be auto-assigned. Requires manual admin intervention.';
