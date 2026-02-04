-- 1. THE UNLOCKER: Identify items that are within buffer window
CREATE OR REPLACE FUNCTION public.unlock_pending_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Unlock items based on role buffers
    -- A task is 'unlocked' if current status is 'Waiting' and date is within buffer
    
    -- Example for Copywriter Stage
    UPDATE public.content_items ci
    SET unlocked_at = now()
    FROM public.buffer_configs bc
    WHERE ci.status = 'pending_dm_complete' -- DM finished thread, now waiting for Copy window
    AND bc.role = 'copywriter'
    AND ci.unlocked_at IS NULL
    AND ci.publish_date <= (CURRENT_DATE + bc.buffer_days);

    -- This can be expanded for other stages if they have 'Waiting' statuses.
    -- For this workflow, status transitions usually happen immediately after previous stage.
    -- However, we can use unlocked_at as a gate for the auto-assignment trigger.
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- 2. SUITABILITY SCORING ENGINE
CREATE OR REPLACE FUNCTION public.get_best_assignee(p_item_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_project_stars INTEGER;
    v_publish_date DATE;
    v_status TEXT;
    v_role_needed TEXT;
    v_best_user_id UUID;
    v_complexity INTEGER;
    v_project_id UUID;
BEGIN
    -- Get task info
    SELECT ci.status, ci.publish_date, p.priority_stars, ci.complexity_weight, ci.project_id
    INTO v_status, v_publish_date, v_project_stars, v_complexity, v_project_id
    FROM public.content_items ci
    JOIN public.projects p ON ci.project_id = p.id
    WHERE ci.id = p_item_id;

    -- Map status to role
    CASE v_status
        WHEN 'pending_copy' THEN v_role_needed := 'copywriter';
        WHEN 'pending_copy_qc' THEN v_role_needed := 'copy_qc';
        WHEN 'pending_design' THEN v_role_needed := 'designer';
        WHEN 'pending_design_qc' THEN v_role_needed := 'designer_qc';
        ELSE RETURN NULL;
    END CASE;

    -- ALGORITHM: Calculate suitability score for each eligible employee
    -- Star Match: Must be >= client stars
    -- Capacity: Weekly capacity - current load >= complexity
    SELECT prof.id INTO v_best_user_id
    FROM public.profiles prof
    WHERE prof.role = v_role_needed
    AND prof.star_rating >= v_project_stars -- Quality Gate
    AND (prof.weekly_capacity - public.calculate_user_load(prof.id)) >= v_complexity -- Capacity Gate
    ORDER BY 
        -- SCORING LOGIC
        -- 1. Loyalty Loop: Preference if they worked on this project before (+50)
        (CASE WHEN EXISTS (
            SELECT 1 FROM public.content_items 
            WHERE project_id = v_project_id 
            AND (copy_assignee = prof.id OR design_assignee = prof.id)
        ) THEN 50 ELSE 0 END) +
        -- 2. Star Match Score: (Employee Stars - Client Stars) * 10
        ((prof.star_rating - v_project_stars) * 10) +
        -- 3. Load Score: (Weekly Capacity - Current Load) / 10
        ((prof.weekly_capacity - public.calculate_user_load(prof.id)) / 10) DESC,
        -- Tie breaker: random
        random()
    LIMIT 1;

    RETURN v_best_user_id;
END;
$$;

-- 3. INTEGRATED ASSIGNMENT HANDLER
CREATE OR REPLACE FUNCTION public.execute_auto_assignment(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignee_id UUID;
    v_status TEXT;
BEGIN
    -- Get status
    SELECT status INTO v_status FROM public.content_items WHERE id = p_item_id;

    -- Find best match
    v_assignee_id := public.get_best_assignee(p_item_id);

    IF v_assignee_id IS NOT NULL THEN
        -- Assign
        CASE v_status
            WHEN 'pending_copy' THEN UPDATE public.content_items SET copy_assignee = v_assignee_id, last_assignee_id = v_assignee_id WHERE id = p_item_id;
            WHEN 'pending_copy_qc' THEN UPDATE public.content_items SET copy_qc_assignee = v_assignee_id WHERE id = p_item_id;
            WHEN 'pending_design' THEN UPDATE public.content_items SET design_assignee = v_assignee_id, last_assignee_id = v_assignee_id WHERE id = p_item_id;
            WHEN 'pending_design_qc' THEN UPDATE public.content_items SET design_qc_assignee = v_assignee_id WHERE id = p_item_id;
        END CASE;
    ELSE
        -- Failsafe: Increment attempts and mark as blocked if needed
        UPDATE public.content_items 
        SET assignment_attempts = assignment_attempts + 1
        WHERE id = p_item_id;
        
        -- Admin notification logic could go here (e.g., insertion into a notifications table)
    END IF;
END;
$$;
