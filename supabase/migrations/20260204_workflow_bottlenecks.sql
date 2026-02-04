-- Bottleneck Detection and Insights System

-- 0. Add current_stage_started_at to content_items if missing
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS current_stage_started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Update existing items to have a starting point if null
UPDATE public.content_items 
SET current_stage_started_at = created_at 
WHERE current_stage_started_at IS NULL;

-- 1. Workflow Benchmarks
CREATE TABLE IF NOT EXISTS public.workflow_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage public.content_stage UNIQUE NOT NULL,
    target_duration_hours INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed default benchmarks
INSERT INTO public.workflow_benchmarks (stage, target_duration_hours) VALUES
('admin', 2),
('digital_marketer', 4),
('copywriter', 12),
('copy_qc', 4),
('designer', 24),
('design_qc', 4),
('digital_marketer_posting', 4),
('completed', 0)
ON CONFLICT (stage) DO UPDATE SET target_duration_hours = EXCLUDED.target_duration_hours;

-- 2. Function to Get Active Bottlenecks
CREATE OR REPLACE FUNCTION public.get_workflow_bottlenecks()
RETURNS TABLE (
    content_item_id UUID,
    project_name TEXT,
    stage_name TEXT,
    hours_in_stage NUMERIC,
    benchmark_hours INTEGER,
    delay_hours NUMERIC,
    assignee_name TEXT,
    urgency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id,
        ci.dm_title as project_name,
        ci.current_stage::TEXT as stage_name,
        EXTRACT(EPOCH FROM (now() - COALESCE(ci.current_stage_started_at, ci.created_at))) / 3600.0 as hours_in_stage,
        wb.target_duration_hours,
        (EXTRACT(EPOCH FROM (now() - COALESCE(ci.current_stage_started_at, ci.created_at))) / 3600.0) - wb.target_duration_hours as delay_hours,
        p.full_name as assignee_name,
        CASE 
            WHEN (EXTRACT(EPOCH FROM (now() - COALESCE(ci.current_stage_started_at, ci.created_at))) / 3600.0) > wb.target_duration_hours * 2 THEN 'CRITICAL'
            WHEN (EXTRACT(EPOCH FROM (now() - COALESCE(ci.current_stage_started_at, ci.created_at))) / 3600.0) > wb.target_duration_hours THEN 'DELAYED'
            ELSE 'ON_TRACK'
        END as urgency
    FROM public.content_items ci
    JOIN public.workflow_benchmarks wb ON ci.current_stage = wb.stage
    LEFT JOIN public.profiles p ON (
        CASE 
            WHEN ci.current_stage = 'copywriter' THEN ci.copy_assignee
            WHEN ci.current_stage = 'designer' THEN ci.design_assignee
            WHEN ci.current_stage = 'copy_qc' THEN ci.copy_qc_assignee
            WHEN ci.current_stage = 'design_qc' THEN ci.design_qc_assignee
            WHEN ci.current_stage = 'digital_marketer' THEN ci.dm_assignee
            ELSE NULL
        END = p.id
    )
    WHERE ci.current_stage != 'completed'
    AND (EXTRACT(EPOCH FROM (now() - COALESCE(ci.current_stage_started_at, ci.created_at))) / 3600.0) > wb.target_duration_hours
    ORDER BY delay_hours DESC;
END;
$$;

-- 3. Function to Generate Actionable Insights
CREATE OR REPLACE FUNCTION public.get_actionable_insights()
RETURNS TABLE (
    priority INTEGER,
    insight_text TEXT,
    insight_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stuck_stage TEXT;
    v_overloaded_user TEXT;
    v_delayed_count INTEGER;
BEGIN
    -- Insight 1: Most Stuck Stage
    SELECT b.stage_name INTO v_stuck_stage 
    FROM public.get_workflow_bottlenecks() b
    GROUP BY b.stage_name 
    ORDER BY COUNT(*) DESC LIMIT 1;
    
    IF v_stuck_stage IS NOT NULL THEN
        priority := 1;
        insight_text := 'The ' || v_stuck_stage || ' stage is the primary agency bottleneck with ' || 
                      (SELECT COUNT(*) FROM public.get_workflow_bottlenecks() WHERE stage_name = v_stuck_stage) || 
                      ' items delayed.';
        insight_type := 'bottleneck';
        RETURN NEXT;
    END IF;

    -- Insight 2: Overloaded Users
    FOR v_overloaded_user IN 
        SELECT w.employee_name 
        FROM public.get_agency_workload_distribution() w
        WHERE w.utilization_rate > 90 
        LIMIT 2
    LOOP
        priority := 2;
        insight_text := v_overloaded_user || ' is critically overloaded (>90% utilization). Consider reassigning tasks.';
        insight_type := 'overload';
        RETURN NEXT;
    END LOOP;

    -- Insight 3: Global Delay Summary
    SELECT COUNT(*) INTO v_delayed_count FROM public.get_workflow_bottlenecks();
    IF v_delayed_count > 5 THEN
        priority := 3;
        insight_text := 'Total of ' || v_delayed_count || ' items are currently past their stage deadlines across the agency.';
        insight_type := 'delay';
        RETURN NEXT;
    END IF;
    
    RETURN;
END;
$$;

-- Grants
GRANT SELECT ON public.workflow_benchmarks TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workflow_bottlenecks TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_actionable_insights TO authenticated;
