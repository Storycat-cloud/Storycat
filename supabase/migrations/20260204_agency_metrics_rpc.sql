-- Agency Metrics Aggregation Functions
-- Specialized for internal performance tracking

-- 1. Agency Production & Scale Stats
CREATE OR REPLACE FUNCTION public.get_agency_production_stats(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    active_clients BIGINT,
    active_projects BIGINT,
    total_content_items BIGINT,
    completed_content_items BIGINT,
    avg_items_per_project NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.clients) as active_clients,
        (SELECT COUNT(*) FROM public.projects WHERE status = 'active') as active_projects,
        COUNT(ci.id) as total_content_items,
        COUNT(ci.id) FILTER (WHERE ci.current_stage = 'completed') as completed_content_items,
        ROUND(AVG(item_counts.cnt), 2) as avg_items_per_project
    FROM public.content_items ci
    CROSS JOIN (
        SELECT project_id, COUNT(*) as cnt 
        FROM public.content_items 
        GROUP BY project_id
    ) item_counts
    WHERE ci.created_at BETWEEN p_start_date AND p_end_date;
END;
$$;

-- 2. Time Efficiency (Avg time per Project, Item, Role)
CREATE OR REPLACE FUNCTION public.get_agency_time_efficiency(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    avg_seconds_per_content_item NUMERIC,
    role_name TEXT,
    avg_role_seconds_per_item NUMERIC,
    total_role_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH overall_avg AS (
        SELECT AVG(duration_seconds) as global_avg
        FROM public.time_logs
        WHERE start_time BETWEEN p_start_date AND p_end_date
    )
    SELECT 
        (SELECT global_avg FROM overall_avg) as avg_seconds_per_content_item,
        tl.role as role_name,
        AVG(tl.duration_seconds)::NUMERIC as avg_role_seconds_per_item,
        SUM(tl.duration_seconds)::NUMERIC / 3600.0 as total_role_hours
    FROM public.time_logs tl
    WHERE tl.start_time BETWEEN p_start_date AND p_end_date
    AND tl.role IS NOT NULL
    GROUP BY tl.role;
END;
$$;

-- 3. Team Performance Ranking
CREATE OR REPLACE FUNCTION public.get_team_efficiency_ranking(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_role_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    employee_role TEXT,
    avg_seconds_per_task NUMERIC,
    total_tasks_completed BIGINT,
    is_top_performer BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            tl.user_id,
            p.full_name,
            p.role,
            AVG(tl.duration_seconds)::NUMERIC as avg_time,
            COUNT(DISTINCT tl.content_item_id) as task_count
        FROM public.time_logs tl
        JOIN public.profiles p ON tl.user_id = p.id
        WHERE tl.start_time BETWEEN p_start_date AND p_end_date
        AND (p_role_filter IS NULL OR p.role = p_role_filter)
        GROUP BY tl.user_id, p.full_name, p.role
        HAVING COUNT(DISTINCT tl.content_item_id) > 2 -- Minimum tasks to be ranked
    )
    SELECT 
        user_id,
        full_name,
        role,
        avg_time,
        task_count,
        avg_time <= (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY avg_time) FROM stats) as is_top_performer
    FROM stats
    ORDER BY avg_time ASC; -- Lower is typically "faster" but quality is QC'd
END;
$$;

-- 4. Creative Leaderboard (High Reach/Eng)
CREATE OR REPLACE FUNCTION public.get_creative_leaderboard(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    content_item_id UUID,
    title TEXT,
    company_name TEXT,
    total_reach BIGINT,
    total_impressions BIGINT,
    total_likes BIGINT,
    engagement_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id,
        ci.dm_title as title,
        po.company_name,
        SUM(mpl.reach)::BIGINT as total_reach,
        SUM(mpl.impressions)::BIGINT as total_impressions,
        SUM(mpl.likes)::BIGINT as total_likes,
        (SUM(mpl.likes) * 100.0 / NULLIF(SUM(mpl.impressions), 0))::NUMERIC as engagement_score
    FROM public.content_items ci
    JOIN public.marketing_performance_logs mpl ON ci.project_id = mpl.project_id
    JOIN public.project_onboarding po ON ci.project_id = po.project_id
    WHERE mpl.log_date BETWEEN p_start_date AND p_end_date
    -- We assume the creative's performance is tied to the project metrics recorded during its publication window
    -- For simplicity, we aggregate metrics for items whose publish_date matches log_date
    AND ci.publish_date = mpl.log_date
    GROUP BY ci.id, ci.dm_title, po.company_name
    ORDER BY total_reach DESC
    LIMIT 10;
END;
$$;

-- 5. Production Volume Over Time
CREATE OR REPLACE FUNCTION public.get_agency_production_volume(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    production_date DATE,
    items_completed BIGINT,
    items_planned BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.date::DATE as production_date,
        COUNT(ci.id) FILTER (WHERE ci.current_stage = 'completed') as items_completed,
        COUNT(ci.id) as items_planned
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(date)
    LEFT JOIN public.content_items ci ON ci.publish_date = d.date::DATE
    GROUP BY d.date
    ORDER BY d.date ASC;
END;
$$;

-- 6. Workload Distribution
CREATE OR REPLACE FUNCTION public.get_agency_workload_distribution()
RETURNS TABLE (
    employee_name TEXT,
    employee_role TEXT,
    current_load INTEGER,
    weekly_capacity INTEGER,
    utilization_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.full_name,
        p.role,
        public.calculate_user_load(p.id) as current_load,
        COALESCE(p.weekly_capacity, 40) as weekly_capacity,
        (public.calculate_user_load(p.id) * 100.0 / NULLIF(COALESCE(p.weekly_capacity, 40), 0))::NUMERIC as utilization_rate
    FROM public.profiles p
    WHERE p.role != 'admin'
    ORDER BY utilization_rate DESC;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_agency_production_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_time_efficiency TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_efficiency_ranking TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_creative_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_production_volume TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_workload_distribution TO authenticated;
