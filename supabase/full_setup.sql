-- 1. Base Schema (Profiles, Auth, Workflows)
-- From: supabase/schema.sql

-- Create a table for public profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'employee', 'digital_marketing_manager', 'copywriter', 'copy_qc', 'designer', 'designer_qc')),
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create a table for Workflows
CREATE TABLE public.workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'review', 'completed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- Policies for Workflows
CREATE POLICY "Admins can do everything on workflows" ON public.workflows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Employees can view assigned workflows" ON public.workflows
  FOR SELECT USING (
    assigned_to = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can update status of assigned workflows" ON public.workflows
  FOR UPDATE USING (
    assigned_to = auth.uid()
  ) WITH CHECK (
    assigned_to = auth.uid()
  );

-- Create a table for Tasks
CREATE TABLE public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policies for Tasks
CREATE POLICY "Admins can do everything on tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Employees can view tasks for their workflows" ON public.tasks
  FOR SELECT USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.workflows
      WHERE id = tasks.workflow_id AND assigned_to = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can update their tasks" ON public.tasks
  FOR UPDATE USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.workflows
      WHERE id = tasks.workflow_id AND assigned_to = auth.uid()
    )
  );

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'employee')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. StoryCat Schema (Projects, Content Items)
-- From: supabase/migrations/20240101_storycat_schema.sql

-- Create Projects Table
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  brief TEXT,
  total_contents INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on projects" ON public.projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can view active projects" ON public.projects
  FOR SELECT USING (true);


-- Create Content Items Table (The Calendar Nodes)
CREATE TABLE public.content_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  publish_date DATE NOT NULL,
  status TEXT DEFAULT 'pending_dm' CHECK (status IN (
    'pending_dm', 
    'pending_copy', 
    'pending_copy_qc', 
    'pending_design', 
    'pending_design_qc', 
    'completed'
  )),
  
  -- DM Fields
  dm_title TEXT,
  dm_description TEXT,
  dm_design_instructions TEXT,
  dm_notes TEXT,
  dm_submitted_at TIMESTAMP WITH TIME ZONE,
  dm_assignee UUID REFERENCES public.profiles(id),

  -- Copy Fields
  copy_content TEXT,
  copy_writer_notes TEXT,
  copy_submitted_at TIMESTAMP WITH TIME ZONE,
  copy_assignee UUID REFERENCES public.profiles(id),

  -- Copy QC Fields
  copy_qc_notes TEXT,
  copy_qc_assignee UUID REFERENCES public.profiles(id),

  -- Design Fields
  design_asset_url TEXT,
  design_notes TEXT,
  design_submitted_at TIMESTAMP WITH TIME ZONE,
  design_assignee UUID REFERENCES public.profiles(id),

  -- Design QC Fields
  design_qc_notes TEXT,
  design_qc_assignee UUID REFERENCES public.profiles(id),

  -- General
  rejection_reason TEXT, -- Stores reason if sent back
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Content Items
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view content items" ON public.content_items
  FOR SELECT USING (true);

CREATE POLICY "Employees can update assigned items or matching role stage" ON public.content_items
  FOR UPDATE USING (true); -- Simplified for now, will refine with logic


-- Create Time Logs Table
CREATE TABLE public.time_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  content_item_id UUID REFERENCES public.content_items(id),
  project_id UUID REFERENCES public.projects(id),
  
  start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER, 
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Time Logs
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own logs" ON public.time_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs" ON public.time_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- 3. Project Change Requests
-- From: supabase/migrations/20240101_project_change_requests.sql

-- Create Project Change Requests Table
CREATE TABLE public.project_change_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.project_change_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view and manage all change requests" ON public.project_change_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can create change requests" ON public.project_change_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employees can view change requests for their projects" ON public.project_change_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id) -- Simplified for now, assuming access to project implies access to requests
  );


-- 4. Updates
-- From: supabase/migrations/20260101_update_status_constraint.sql

-- Update the check constraint to include rejection statuses
ALTER TABLE public.content_items DROP CONSTRAINT content_items_status_check;

ALTER TABLE public.content_items ADD CONSTRAINT content_items_status_check CHECK (status IN (
    'pending_dm', 
    'pending_copy', 
    'pending_copy_qc', 
    'rejected_from_copy_qc',
    'pending_design', 
    'pending_design_qc', 
    'rejected_from_design_qc',
    'completed'
));

-- From: supabase/migrations/20260102_add_admin_verification.sql

-- Add admin verification fields to content_items
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS is_admin_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP WITH TIME ZONE;


-- 5. Storage
-- From: supabase/migrations/20260102_storage_bucket.sql

-- Create a new public bucket called 'project-assets'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-assets', 'project-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up access policies
CREATE POLICY "Authenticated users can upload project assets"
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'project-assets');

CREATE POLICY "Public access to project assets"
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'project-assets');


-- 6. Initial Seed Data
-- Create Admin User (admin11@storycat.com)

-- Create the pgcrypto extension if it doesn't exist (needed for password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert the admin user into auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin11@storycat.com',
  crypt('123456789', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Super Admin", "role": "admin"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- The 'on_auth_user_created' trigger (section 1) will handle profile creation.
