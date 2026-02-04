-- Paid Marketing Configuration and Performance Tracking
-- Admin-only configuration with DM daily performance logging

-- 1. Create marketing channels enum
CREATE TYPE marketing_channel AS ENUM (
    'meta',
    'google',
    'youtube',
    'tiktok',
    'linkedin',
    'twitter',
    'other'
);

-- 2. Create budget type enum
CREATE TYPE budget_type AS ENUM (
    'daily',
    'weekly',
    'monthly'
);

-- 3. Create paid marketing configuration table
CREATE TABLE public.paid_marketing_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
    
    -- Configuration
    enabled BOOLEAN DEFAULT FALSE,
    channels marketing_channel[] DEFAULT '{}',
    budget_type budget_type DEFAULT 'monthly',
    budget_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id)
);

-- 4. Create marketing performance logs table
CREATE TABLE public.marketing_performance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Date tracking (one entry per day per project)
    log_date DATE NOT NULL,
    
    -- Performance metrics
    amount_spent DECIMAL(10, 2) DEFAULT 0,
    leads_generated INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    
    -- Additional metrics
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    logged_by UUID REFERENCES public.profiles(id),
    
    -- Ensure one entry per day per project
    UNIQUE(project_id, log_date)
);

-- 5. Create indexes
CREATE INDEX idx_paid_marketing_config_project ON public.paid_marketing_config(project_id);
CREATE INDEX idx_paid_marketing_config_enabled ON public.paid_marketing_config(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_marketing_performance_project_date ON public.marketing_performance_logs(project_id, log_date DESC);
CREATE INDEX idx_marketing_performance_date ON public.marketing_performance_logs(log_date DESC);

-- 6. Enable RLS
ALTER TABLE public.paid_marketing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_performance_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for paid_marketing_config
-- Admins can do everything
CREATE POLICY "Admins can manage marketing config" ON public.paid_marketing_config
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- DMs can view config for their projects (read-only)
CREATE POLICY "DMs can view marketing config for their projects" ON public.paid_marketing_config
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_onboarding po
            WHERE po.project_id = paid_marketing_config.project_id
            AND po.dedicated_dm_id = auth.uid()
        )
    );

-- 8. RLS Policies for marketing_performance_logs
-- Admins can view all logs
CREATE POLICY "Admins can view all performance logs" ON public.marketing_performance_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- DMs can view logs for their projects
CREATE POLICY "DMs can view performance logs for their projects" ON public.marketing_performance_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_onboarding po
            WHERE po.project_id = marketing_performance_logs.project_id
            AND po.dedicated_dm_id = auth.uid()
        )
    );

-- DMs can insert logs for their projects
CREATE POLICY "DMs can log performance for their projects" ON public.marketing_performance_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_onboarding po
            WHERE po.project_id = marketing_performance_logs.project_id
            AND po.dedicated_dm_id = auth.uid()
        )
        AND logged_by = auth.uid()
    );

-- DMs can update their own logs (same day only)
CREATE POLICY "DMs can update their own logs" ON public.marketing_performance_logs
    FOR UPDATE USING (
        logged_by = auth.uid()
        AND log_date = CURRENT_DATE
    );

-- 9. Function to log or update daily performance
CREATE OR REPLACE FUNCTION public.log_marketing_performance(
    p_project_id UUID,
    p_log_date DATE,
    p_amount_spent DECIMAL,
    p_leads_generated INTEGER,
    p_reach INTEGER,
    p_impressions INTEGER,
    p_likes INTEGER,
    p_views INTEGER,
    p_clicks INTEGER DEFAULT 0,
    p_conversions INTEGER DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    -- Insert or update performance log
    INSERT INTO public.marketing_performance_logs (
        project_id,
        log_date,
        amount_spent,
        leads_generated,
        reach,
        impressions,
        likes,
        views,
        clicks,
        conversions,
        notes,
        logged_by
    )
    VALUES (
        p_project_id,
        p_log_date,
        p_amount_spent,
        p_leads_generated,
        p_reach,
        p_impressions,
        p_likes,
        p_views,
        p_clicks,
        p_conversions,
        p_notes,
        auth.uid()
    )
    ON CONFLICT (project_id, log_date)
    DO UPDATE SET
        amount_spent = EXCLUDED.amount_spent,
        leads_generated = EXCLUDED.leads_generated,
        reach = EXCLUDED.reach,
        impressions = EXCLUDED.impressions,
        likes = EXCLUDED.likes,
        views = EXCLUDED.views,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- 10. Function to get performance summary for a project
CREATE OR REPLACE FUNCTION public.get_marketing_performance_summary(
    p_project_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_spent DECIMAL,
    total_leads INTEGER,
    total_reach BIGINT,
    total_impressions BIGINT,
    total_likes BIGINT,
    total_views BIGINT,
    total_clicks BIGINT,
    total_conversions BIGINT,
    avg_cost_per_lead DECIMAL,
    days_logged INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(amount_spent), 0) as total_spent,
        COALESCE(SUM(leads_generated), 0)::INTEGER as total_leads,
        COALESCE(SUM(reach), 0) as total_reach,
        COALESCE(SUM(impressions), 0) as total_impressions,
        COALESCE(SUM(likes), 0) as total_likes,
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(clicks), 0) as total_clicks,
        COALESCE(SUM(conversions), 0) as total_conversions,
        CASE 
            WHEN SUM(leads_generated) > 0 THEN ROUND(SUM(amount_spent) / SUM(leads_generated), 2)
            ELSE 0
        END as avg_cost_per_lead,
        COUNT(*)::INTEGER as days_logged
    FROM public.marketing_performance_logs
    WHERE project_id = p_project_id
    AND (p_start_date IS NULL OR log_date >= p_start_date)
    AND (p_end_date IS NULL OR log_date <= p_end_date);
END;
$$;

-- 11. Function to get daily performance trend
CREATE OR REPLACE FUNCTION public.get_marketing_performance_trend(
    p_project_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    log_date DATE,
    amount_spent DECIMAL,
    leads_generated INTEGER,
    reach INTEGER,
    impressions INTEGER,
    cost_per_lead DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mpl.log_date,
        mpl.amount_spent,
        mpl.leads_generated,
        mpl.reach,
        mpl.impressions,
        CASE 
            WHEN mpl.leads_generated > 0 THEN ROUND(mpl.amount_spent / mpl.leads_generated, 2)
            ELSE 0
        END as cost_per_lead
    FROM public.marketing_performance_logs mpl
    WHERE mpl.project_id = p_project_id
    AND mpl.log_date >= CURRENT_DATE - p_days
    ORDER BY mpl.log_date DESC;
END;
$$;

-- 12. Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_marketing_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_marketing_config_update
    BEFORE UPDATE ON public.paid_marketing_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_marketing_config_timestamp();

-- 13. Grant permissions
GRANT EXECUTE ON FUNCTION public.log_marketing_performance TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketing_performance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketing_performance_trend TO authenticated;

-- 14. Comments
COMMENT ON TABLE public.paid_marketing_config IS 'Admin-only paid marketing configuration per project';
COMMENT ON TABLE public.marketing_performance_logs IS 'Daily performance metrics logged by digital marketers';
COMMENT ON COLUMN public.marketing_performance_logs.log_date IS 'Date of performance (one entry per day per project)';
COMMENT ON FUNCTION public.log_marketing_performance IS 'Upserts daily marketing performance. DMs can only log for their assigned projects.';
COMMENT ON FUNCTION public.get_marketing_performance_summary IS 'Aggregates marketing performance metrics for a project within date range.';
COMMENT ON FUNCTION public.get_marketing_performance_trend IS 'Returns daily performance trend for the last N days.';
