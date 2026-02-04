-- Agency Leaderboard and Settings

-- 1. Agency Settings Table
CREATE TABLE IF NOT EXISTS public.agency_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initialize default settings
INSERT INTO public.agency_settings (key, value)
VALUES ('performance_leaderboard', '{"enabled": true, "min_tasks_required": 3}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Master Performance Leaderboard Function
CREATE OR REPLACE FUNCTION public.get_agency_leaderboard(
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT (now() - interval '30 days'),
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    role TEXT,
    tasks_completed BIGINT,
    avg_speed_seconds NUMERIC,
    avg_engagement_score NUMERIC,
    performance_score NUMERIC, -- Calculated 0-100
    rank_position BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH raw_stats AS (
        -- Get tasks completed and avg speed
        SELECT 
            tl.user_id,
            p.full_name,
            p.role,
            COUNT(DISTINCT tl.content_item_id) as tasks,
            AVG(tl.duration_seconds) as avg_speed
        FROM public.time_logs tl
        JOIN public.profiles p ON tl.user_id = p.id
        WHERE tl.start_time BETWEEN p_start_date AND p_end_date
        GROUP BY tl.user_id, p.full_name, p.role
    ),
    engagement_stats AS (
        -- Get engagement metrics for those who produce content (copy/design)
        SELECT 
            CASE 
                WHEN ci.copy_assignee IS NOT NULL THEN ci.copy_assignee
                WHEN ci.design_assignee IS NOT NULL THEN ci.design_assignee
                ELSE NULL
            END as user_id,
            AVG(m.engagement_score) as avg_eng
        FROM public.content_items ci
        JOIN public.marketing_performance_logs m ON ci.id = m.content_item_id
        WHERE m.log_date BETWEEN p_start_date AND p_end_date
        GROUP BY 1
    ),
    normalized_stats AS (
        SELECT 
            rs.user_id,
            rs.full_name,
            rs.role,
            rs.tasks,
            rs.avg_speed,
            COALESCE(es.avg_eng, 0) as avg_eng,
            -- Scoring logic:
            -- 1. Volume Score (Logarithmic to reward consistent output but diminish extreme outliers) 0-40
            (LEAST(rs.tasks::NUMERIC / 10.0, 1.0) * 40.0) as volume_score,
            -- 2. Speed Score (Inverse of avg speed, 0-40. Based on target of 1 hour = 100% speed)
            (LEAST(3600.0 / NULLIF(rs.avg_speed, 0), 1.0) * 40.0) as speed_score,
            -- 3. Quality Score (Engagement, 0-20)
            (LEAST(COALESCE(es.avg_eng, 0) / 10.0, 1.0) * 20.0) as quality_score
        FROM raw_stats rs
        LEFT JOIN engagement_stats es ON rs.user_id = es.user_id
    )
    SELECT 
        ns.user_id,
        ns.full_name,
        ns.role,
        ns.tasks as tasks_completed,
        ns.avg_speed::NUMERIC as avg_speed_seconds,
        ns.avg_eng::NUMERIC as avg_engagement_score,
        (ns.volume_score + ns.speed_score + ns.quality_score)::NUMERIC as performance_score,
        RANK() OVER (ORDER BY (ns.volume_score + ns.speed_score + ns.quality_score) DESC) as rank_position
    FROM normalized_stats ns
    ORDER BY performance_score DESC;
END;
$$;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.agency_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_leaderboard TO authenticated;
