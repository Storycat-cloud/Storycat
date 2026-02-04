-- Automatic Time Tracking for Stage-Based Workflow
-- Tracks time spent by each role on each content item

-- 1. Enhance time_logs table with role and stage information
ALTER TABLE public.time_logs
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS content_stage content_stage,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add index for active time logs
CREATE INDEX IF NOT EXISTS idx_time_logs_active 
ON public.time_logs(user_id, content_item_id, is_active) 
WHERE is_active = TRUE;

-- Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_time_logs_role 
ON public.time_logs(role, project_id);

-- 2. Function to start time tracking
CREATE OR REPLACE FUNCTION public.start_time_tracking(
    p_content_item_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_time_log_id UUID;
    v_user_role TEXT;
    v_current_stage content_stage;
    v_project_id UUID;
BEGIN
    -- Get user role
    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE id = p_user_id;

    -- Don't track admin time
    IF v_user_role = 'admin' THEN
        RETURN NULL;
    END IF;

    -- Get content item details
    SELECT current_stage, project_id
    INTO v_current_stage, v_project_id
    FROM public.content_items
    WHERE id = p_content_item_id;

    -- Stop any existing active time logs for this user/content item
    UPDATE public.time_logs
    SET 
        end_time = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER,
        is_active = FALSE
    WHERE user_id = p_user_id
    AND content_item_id = p_content_item_id
    AND is_active = TRUE;

    -- Create new time log
    INSERT INTO public.time_logs (
        user_id,
        content_item_id,
        project_id,
        role,
        content_stage,
        start_time,
        is_active
    )
    VALUES (
        p_user_id,
        p_content_item_id,
        v_project_id,
        v_user_role,
        v_current_stage,
        NOW(),
        TRUE
    )
    RETURNING id INTO v_time_log_id;

    RETURN v_time_log_id;
END;
$$;

-- 3. Function to stop time tracking
CREATE OR REPLACE FUNCTION public.stop_time_tracking(
    p_content_item_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rows_updated INTEGER;
BEGIN
    -- Stop all active time logs for this user/content item
    UPDATE public.time_logs
    SET 
        end_time = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER,
        is_active = FALSE
    WHERE user_id = p_user_id
    AND content_item_id = p_content_item_id
    AND is_active = TRUE;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    RETURN v_rows_updated > 0;
END;
$$;

-- 4. Function to get active time log for a content item
CREATE OR REPLACE FUNCTION public.get_active_time_log(
    p_content_item_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
    id UUID,
    start_time TIMESTAMP WITH TIME ZONE,
    elapsed_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tl.id,
        tl.start_time,
        EXTRACT(EPOCH FROM (NOW() - tl.start_time))::INTEGER as elapsed_seconds
    FROM public.time_logs tl
    WHERE tl.user_id = p_user_id
    AND tl.content_item_id = p_content_item_id
    AND tl.is_active = TRUE
    LIMIT 1;
END;
$$;

-- 5. Function to get time spent by role on a content item
CREATE OR REPLACE FUNCTION public.get_time_by_role_for_content(
    p_content_item_id UUID
)
RETURNS TABLE (
    role TEXT,
    total_seconds INTEGER,
    total_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tl.role,
        SUM(COALESCE(tl.duration_seconds, 0))::INTEGER as total_seconds,
        ROUND(SUM(COALESCE(tl.duration_seconds, 0)) / 3600.0, 2) as total_hours
    FROM public.time_logs tl
    WHERE tl.content_item_id = p_content_item_id
    AND tl.role IS NOT NULL
    GROUP BY tl.role
    ORDER BY total_seconds DESC;
END;
$$;

-- 6. Function to get time spent by role on a project
CREATE OR REPLACE FUNCTION public.get_time_by_role_for_project(
    p_project_id UUID
)
RETURNS TABLE (
    role TEXT,
    total_seconds INTEGER,
    total_hours NUMERIC,
    content_items_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tl.role,
        SUM(COALESCE(tl.duration_seconds, 0))::INTEGER as total_seconds,
        ROUND(SUM(COALESCE(tl.duration_seconds, 0)) / 3600.0, 2) as total_hours,
        COUNT(DISTINCT tl.content_item_id) as content_items_count
    FROM public.time_logs tl
    WHERE tl.project_id = p_project_id
    AND tl.role IS NOT NULL
    GROUP BY tl.role
    ORDER BY total_seconds DESC;
END;
$$;

-- 7. Function to get total time spent by a user
CREATE OR REPLACE FUNCTION public.get_user_time_stats(
    p_user_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_seconds INTEGER,
    total_hours NUMERIC,
    content_items_count BIGINT,
    projects_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(COALESCE(tl.duration_seconds, 0))::INTEGER as total_seconds,
        ROUND(SUM(COALESCE(tl.duration_seconds, 0)) / 3600.0, 2) as total_hours,
        COUNT(DISTINCT tl.content_item_id) as content_items_count,
        COUNT(DISTINCT tl.project_id) as projects_count
    FROM public.time_logs tl
    WHERE tl.user_id = p_user_id
    AND (p_start_date IS NULL OR DATE(tl.start_time) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(tl.start_time) <= p_end_date);
END;
$$;

-- 8. Trigger to auto-stop time tracking when stage changes
CREATE OR REPLACE FUNCTION public.auto_stop_time_on_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If stage changed, stop all active time logs for this content item
    IF OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN
        UPDATE public.time_logs
        SET 
            end_time = NOW(),
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER,
            is_active = FALSE
        WHERE content_item_id = NEW.id
        AND is_active = TRUE;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_content_stage_change
    BEFORE UPDATE OF current_stage ON public.content_items
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_stop_time_on_stage_change();

-- 9. Update RLS policies for time_logs
CREATE POLICY "Users can view their own time logs" ON public.time_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own active logs" ON public.time_logs
    FOR UPDATE USING (auth.uid() = user_id AND is_active = TRUE);

-- 10. Grant permissions
GRANT EXECUTE ON FUNCTION public.start_time_tracking(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_time_tracking(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_time_log(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_time_by_role_for_content(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_time_by_role_for_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_time_stats(UUID, DATE, DATE) TO authenticated;

-- 11. Comments
COMMENT ON COLUMN public.time_logs.role IS 'User role at the time of tracking (excludes admin)';
COMMENT ON COLUMN public.time_logs.content_stage IS 'Content stage at the time of tracking';
COMMENT ON COLUMN public.time_logs.is_active IS 'TRUE if timer is currently running';
COMMENT ON FUNCTION public.start_time_tracking IS 'Starts time tracking for a content item. Auto-stops previous active logs. Returns time_log_id.';
COMMENT ON FUNCTION public.stop_time_tracking IS 'Stops active time tracking for a content item. Returns TRUE if logs were stopped.';
COMMENT ON FUNCTION public.get_active_time_log IS 'Gets currently active time log with elapsed time.';
COMMENT ON FUNCTION public.get_time_by_role_for_content IS 'Aggregates time spent by each role on a content item.';
COMMENT ON FUNCTION public.get_time_by_role_for_project IS 'Aggregates time spent by each role on a project.';
COMMENT ON FUNCTION public.get_user_time_stats IS 'Gets total time stats for a user within optional date range.';
