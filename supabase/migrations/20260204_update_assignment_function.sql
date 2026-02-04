-- Update get_best_assignee function to remove dedicated team logic
-- and implement role-specific capacity checking

CREATE OR REPLACE FUNCTION public.get_best_assignee(p_item_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_client_stars INTEGER;
    v_publish_date DATE;
    v_status TEXT;
    v_role_needed TEXT;
    v_best_user_id UUID;
    v_complexity INTEGER;
    v_project_id UUID;
BEGIN
    -- Get task info including client star rating from project_onboarding
    SELECT 
        ci.status, 
        ci.publish_date, 
        ci.complexity_weight, 
        ci.project_id,
        COALESCE(po.client_star_rating, 3) -- Default to 3 stars if not set
    INTO v_status, v_publish_date, v_complexity, v_project_id, v_client_stars
    FROM public.content_items ci
    JOIN public.projects p ON ci.project_id = p.id
    LEFT JOIN public.project_onboarding po ON po.project_id = p.id
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

    -- DYNAMIC ASSIGNMENT ALGORITHM
    -- Find best employee based on:
    -- 1. Star rating match (employee.star_rating >= client_star_rating)
    -- 2. Role-specific capacity availability
    -- 3. Current workload balance
    -- 4. Loyalty loop (previous work on same project)
    
    SELECT prof.id INTO v_best_user_id
    FROM public.profiles prof
    WHERE prof.role = v_role_needed
    AND COALESCE(prof.star_rating, 3) >= v_client_stars -- Quality Gate: employee stars must meet/exceed client stars
    AND (
        -- Capacity Gate: Check role-specific capacity
        CASE 
            WHEN v_role_needed IN ('copywriter', 'copy_qc') THEN 
                COALESCE(prof.daily_copy_capacity, 0) > 0 
                AND (COALESCE(prof.daily_copy_capacity, 0) * 5 - public.calculate_user_load(prof.id)) >= v_complexity
            WHEN v_role_needed IN ('designer', 'designer_qc') THEN 
                COALESCE(prof.daily_design_capacity, 0) > 0
                AND (COALESCE(prof.daily_design_capacity, 0) * 5 - public.calculate_user_load(prof.id)) >= v_complexity
            WHEN v_role_needed = 'digital_marketing_manager' THEN 
                -- DM uses weekly_capacity if available, otherwise assume they have capacity
                (COALESCE(prof.weekly_capacity, 50) - public.calculate_user_load(prof.id)) >= v_complexity
            ELSE FALSE
        END
    )
    ORDER BY 
        -- SCORING LOGIC for even distribution
        -- 1. Loyalty Loop: Strong preference if they worked on this project before (+100)
        (CASE WHEN EXISTS (
            SELECT 1 FROM public.content_items 
            WHERE project_id = v_project_id 
            AND (copy_assignee = prof.id OR design_assignee = prof.id OR dm_assignee = prof.id)
        ) THEN 100 ELSE 0 END) +
        -- 2. Star Match Score: Prefer exact matches over over-qualified (+20 for exact match)
        (CASE WHEN prof.star_rating = v_client_stars THEN 20 ELSE 0 END) +
        -- 3. Load Balance Score: Prefer employees with lighter workload
        -- Higher score = more available capacity
        (CASE 
            WHEN v_role_needed IN ('copywriter', 'copy_qc') THEN 
                ((COALESCE(prof.daily_copy_capacity, 0) * 5) - public.calculate_user_load(prof.id))
            WHEN v_role_needed IN ('designer', 'designer_qc') THEN 
                ((COALESCE(prof.daily_design_capacity, 0) * 5) - public.calculate_user_load(prof.id))
            ELSE 
                (COALESCE(prof.weekly_capacity, 50) - public.calculate_user_load(prof.id))
        END) DESC,
        -- 4. Tie breaker: random for even distribution among equals
        random()
    LIMIT 1;

    RETURN v_best_user_id;
END;
$$;

COMMENT ON FUNCTION public.get_best_assignee IS 'Assigns content items to employees based on star rating match, role-specific capacity, workload balance, and loyalty loop. Removed dedicated team preference.';
