-- Optimizing for dashboard and project fetching performance

-- content_items table
CREATE INDEX IF NOT EXISTS idx_content_items_project_id ON public.content_items(project_id);
CREATE INDEX IF NOT EXISTS idx_content_items_publish_date ON public.content_items(publish_date);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON public.content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_is_admin_verified ON public.content_items(is_admin_verified);

-- time_logs table (for AnalyticsView)
CREATE INDEX IF NOT EXISTS idx_time_logs_project_id ON public.time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON public.time_logs(user_id);

-- projects table
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);

-- project_onboarding table
CREATE INDEX IF NOT EXISTS idx_project_onboarding_project_id ON public.project_onboarding(project_id);

-- project_change_requests table
CREATE INDEX IF NOT EXISTS idx_project_change_requests_project_id ON public.project_change_requests(project_id);
