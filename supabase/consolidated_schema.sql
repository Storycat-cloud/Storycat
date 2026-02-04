-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABLES
-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'employee', 'digital_marketing_manager', 'copywriter', 'copy_qc', 'designer', 'designer_qc')),
  avatar_url TEXT,
  star_rating INTEGER DEFAULT 1,
  projects_per_day INTEGER DEFAULT 1,
  weekly_capacity INTEGER DEFAULT 50,
  specialties TEXT[] DEFAULT '{}',
  current_load_score INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Workflows
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'review', 'completed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  brief TEXT,
  total_contents INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  priority_stars INTEGER DEFAULT 3,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Project Onboarding (Dedicated Assignments)
CREATE TABLE IF NOT EXISTS public.project_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
    dedicated_dm_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    dedicated_copywriter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    dedicated_copy_qc_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    dedicated_designer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    dedicated_designer_qc_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Content Items
CREATE TABLE IF NOT EXISTS public.content_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  publish_date DATE NOT NULL,
  status TEXT DEFAULT 'pending_dm',
  content_type TEXT DEFAULT 'General',
  
  -- DM Fields
  dm_title TEXT,
  dm_description TEXT,
  dm_design_instructions TEXT,
  dm_notes TEXT,
  dm_submitted_at TIMESTAMP WITH TIME ZONE,
  dm_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dm_thread JSONB,

  -- Copy Fields
  copy_content TEXT,
  copy_writer_notes TEXT,
  copy_submitted_at TIMESTAMP WITH TIME ZONE,
  copy_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Copy QC Fields
  copy_qc_notes TEXT,
  copy_qc_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Design Fields
  design_asset_url TEXT,
  design_notes TEXT,
  design_submitted_at TIMESTAMP WITH TIME ZONE,
  design_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Design QC Fields
  design_qc_notes TEXT,
  design_qc_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Tracking & Logic
  rejection_reason TEXT,
  is_admin_verified BOOLEAN DEFAULT FALSE,
  admin_verified_at TIMESTAMP WITH TIME ZONE,
  complexity_weight INTEGER DEFAULT 1,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  assignment_attempts INTEGER DEFAULT 0,
  last_assignee_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure correct check constraint for content_items status
ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS content_items_status_check;
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

-- Time Logs
CREATE TABLE IF NOT EXISTS public.time_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Project Change Requests
CREATE TABLE IF NOT EXISTS public.project_change_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Buffer config
CREATE TABLE IF NOT EXISTS public.buffer_configs (
    role TEXT PRIMARY KEY,
    buffer_days INTEGER NOT NULL,
    priority_weight INTEGER DEFAULT 1
);

-- Seed Buffer Configs
INSERT INTO public.buffer_configs (role, buffer_days, priority_weight) VALUES
('copywriter', 7, 10),
('copy_qc', 6, 8),
('designer', 4, 6),
('designer_qc', 3, 4)
ON CONFLICT (role) DO UPDATE SET buffer_days = EXCLUDED.buffer_days, priority_weight = EXCLUDED.priority_weight;

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_dm ON public.project_onboarding(dedicated_dm_id);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_copywriter ON public.project_onboarding(dedicated_copywriter_id);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_copy_qc ON public.project_onboarding(dedicated_copy_qc_id);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_designer ON public.project_onboarding(dedicated_designer_id);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_designer_qc ON public.project_onboarding(dedicated_designer_qc_id);
CREATE INDEX IF NOT EXISTS idx_content_items_publish_date ON public.content_items(publish_date);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON public.content_items(status);

-- 4. RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_change_requests ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DO $$ BEGIN
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Standard role-based access for projects and content
DO $$ BEGIN
    CREATE POLICY "Everyone can view active projects" ON public.projects FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Everyone can view content items" ON public.content_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can do everything" ON public.projects FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. FUNCTIONS
-- Capture new user from auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, star_rating, projects_per_day, weekly_capacity)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'employee'),
    COALESCE((new.raw_user_meta_data->>'star_rating')::INTEGER, 1),
    COALESCE((new.raw_user_meta_data->>'projects_per_day')::INTEGER, 1),
    COALESCE((new.raw_user_meta_data->>'weekly_capacity')::INTEGER, 50)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    star_rating = EXCLUDED.star_rating,
    projects_per_day = EXCLUDED.projects_per_day,
    weekly_capacity = EXCLUDED.weekly_capacity;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate load based on CCUs (complexity_weight)
CREATE OR REPLACE FUNCTION public.calculate_user_load(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_load INTEGER;
BEGIN
    SELECT COALESCE(SUM(complexity_weight), 0)
    INTO v_load
    FROM public.content_items
    WHERE (
        dm_assignee = p_user_id OR 
        copy_assignee = p_user_id OR 
        design_assignee = p_user_id OR 
        copy_qc_assignee = p_user_id OR 
        design_qc_assignee = p_user_id
    )
    AND (status NOT IN ('completed', 'archived'));
    
    RETURN v_load;
END;
$$;

-- Suitability Scoring Engine
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
    v_dedicated_user_id UUID;
BEGIN
    SELECT ci.status, ci.publish_date, p.priority_stars, ci.complexity_weight, ci.project_id
    INTO v_status, v_publish_date, v_project_stars, v_complexity, v_project_id
    FROM public.content_items ci
    JOIN public.projects p ON ci.project_id = p.id
    WHERE ci.id = p_item_id;

    CASE v_status
        WHEN 'pending_dm' THEN v_role_needed := 'digital_marketing_manager';
        WHEN 'pending_copy' THEN v_role_needed := 'copywriter';
        WHEN 'pending_copy_qc' THEN v_role_needed := 'copy_qc';
        WHEN 'pending_design' THEN v_role_needed := 'designer';
        WHEN 'pending_design_qc' THEN v_role_needed := 'designer_qc';
        ELSE RETURN NULL;
    END CASE;

    -- DEDICATED ASSIGNMENT CHECK
    SELECT 
        CASE v_status
            WHEN 'pending_dm' THEN dedicated_dm_id
            WHEN 'pending_copy' THEN dedicated_copywriter_id
            WHEN 'pending_copy_qc' THEN dedicated_copy_qc_id
            WHEN 'pending_design' THEN dedicated_designer_id
            WHEN 'pending_design_qc' THEN dedicated_designer_qc_id
            ELSE NULL
        END
    INTO v_dedicated_user_id
    FROM public.project_onboarding
    WHERE project_id = v_project_id;

    IF v_dedicated_user_id IS NOT NULL THEN
        SELECT prof.id INTO v_best_user_id
        FROM public.profiles prof
        WHERE prof.id = v_dedicated_user_id
        AND prof.role = v_role_needed;
        
        IF v_best_user_id IS NOT NULL THEN
            RETURN v_best_user_id;
        END IF;
    END IF;

    -- ALGORITHM: Calculate suitability score
    SELECT prof.id INTO v_best_user_id
    FROM public.profiles prof
    WHERE prof.role = v_role_needed
    AND prof.star_rating >= v_project_stars
    AND (prof.weekly_capacity - public.calculate_user_load(prof.id)) >= v_complexity
    ORDER BY 
        (CASE WHEN EXISTS (
            SELECT 1 FROM public.content_items 
            WHERE project_id = v_project_id 
            AND (copy_assignee = prof.id OR design_assignee = prof.id OR dm_assignee = prof.id)
        ) THEN 50 ELSE 0 END) +
        ((prof.star_rating - v_project_stars) * 10) +
        ((prof.weekly_capacity - public.calculate_user_load(prof.id)) / 10) DESC,
        random()
    LIMIT 1;

    RETURN v_best_user_id;
END;
$$;

-- Assignment Handler
CREATE OR REPLACE FUNCTION public.execute_auto_assignment(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignee_id UUID;
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM public.content_items WHERE id = p_item_id;
    v_assignee_id := public.get_best_assignee(p_item_id);

    IF v_assignee_id IS NOT NULL THEN
        CASE v_status
            WHEN 'pending_copy' THEN UPDATE public.content_items SET copy_assignee = v_assignee_id, last_assignee_id = v_assignee_id WHERE id = p_item_id;
            WHEN 'pending_copy_qc' THEN UPDATE public.content_items SET copy_qc_assignee = v_assignee_id WHERE id = p_item_id;
            WHEN 'pending_design' THEN UPDATE public.content_items SET design_assignee = v_assignee_id, last_assignee_id = v_assignee_id WHERE id = p_item_id;
            WHEN 'pending_design_qc' THEN UPDATE public.content_items SET design_qc_assignee = v_assignee_id WHERE id = p_item_id;
        END CASE;
    ELSE
        UPDATE public.content_items SET assignment_attempts = assignment_attempts + 1 WHERE id = p_item_id;
    END IF;
END;
$$;

-- Trigger Function for status changes
CREATE OR REPLACE FUNCTION public.trigger_advanced_assignment_after()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('pending_copy', 'pending_copy_qc', 'pending_design', 'pending_design_qc') THEN
         PERFORM public.execute_auto_assignment(NEW.id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Admin RPCs
CREATE OR REPLACE FUNCTION public.create_employee(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_star_rating INTEGER DEFAULT 1,
  p_projects_per_day INTEGER DEFAULT 1,
  p_weekly_capacity INTEGER DEFAULT 50
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access Denied: Only admins can create employees';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token, phone_confirmed_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
    p_email, crypt(p_password, gen_salt('bf')), now(), 
    '{"provider": "email", "providers": ["email"]}', 
    jsonb_build_object('full_name', p_full_name, 'role', p_role, 'star_rating', p_star_rating, 'projects_per_day', p_projects_per_day, 'weekly_capacity', p_weekly_capacity),
    now(), now(),
    '', '', '', '', now()
  ) RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_employee(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access Denied: Only admins can delete employees';
  END IF;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Calendar Logic
CREATE OR REPLACE FUNCTION public.create_project_with_types(
  p_title TEXT, p_brief TEXT, p_start_date DATE, p_duration_months INTEGER DEFAULT 12, p_priority_stars INTEGER DEFAULT 3, p_content_counts JSONB DEFAULT '{}'::jsonb, p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_project_id UUID;
  total_items_created INTEGER := 0;
  current_month_start DATE;
  current_month_end DATE;
  month_idx INTEGER;
  type_key TEXT;
  type_qty INTEGER;
  month_items TEXT[];
  shuffled_items TEXT[];
  valid_days DATE[];
  target_day DATE;
  day_idx INTEGER;
  num_valid_days INTEGER;
  items_to_create_this_month INTEGER;
  step_size FLOAT;
  day_pos FLOAT;
  is_second_sat BOOLEAN;
BEGIN
  INSERT INTO public.projects (
    title, brief, total_contents, start_date, end_date, created_by, status, priority_stars
  ) VALUES (
    p_title, p_brief, 0, p_start_date, p_start_date + (p_duration_months || ' months')::INTERVAL - INTERVAL '1 day', p_created_by, 'active', p_priority_stars
  ) RETURNING id INTO new_project_id;

  FOR month_idx IN 0..(p_duration_months - 1) LOOP
    current_month_start := (p_start_date + (month_idx || ' months')::INTERVAL);
    current_month_end := (current_month_start + INTERVAL '1 month' - INTERVAL '1 day');
    month_items := ARRAY[]::TEXT[];
    FOR type_key, type_qty IN SELECT * FROM jsonb_each_text(p_content_counts) LOOP
      FOR i IN 1..type_qty::INTEGER LOOP month_items := array_append(month_items, type_key); END LOOP;
    END LOOP;
    items_to_create_this_month := COALESCE(array_length(month_items, 1), 0);
    IF items_to_create_this_month > 0 THEN
      SELECT array_agg(val ORDER BY random()) INTO shuffled_items FROM unnest(month_items) AS val;
      valid_days := ARRAY[]::DATE[];
      target_day := current_month_start;
      WHILE target_day <= current_month_end LOOP
        IF extract(dow from target_day) != 0 THEN
          is_second_sat := FALSE;
          IF extract(dow from target_day) = 6 AND extract(day from target_day) BETWEEN 8 AND 14 THEN is_second_sat := TRUE; END IF;
          IF NOT is_second_sat THEN valid_days := array_append(valid_days, target_day); END IF;
        END IF;
        target_day := target_day + INTERVAL '1 day';
      END LOOP;
      num_valid_days := COALESCE(array_length(valid_days, 1), 0);
      IF num_valid_days > 0 THEN
        step_size := num_valid_days::FLOAT / items_to_create_this_month;
        FOR day_idx IN 1..items_to_create_this_month LOOP
          day_pos := ((day_idx - 1) * step_size) + 1;
          target_day := valid_days[floor(day_pos)::INTEGER];
          INSERT INTO public.content_items (project_id, publish_date, status, content_type, dm_title, dm_description)
          VALUES (new_project_id, target_day, 'pending_dm', shuffled_items[day_idx], shuffled_items[day_idx], 'Auto-generated ' || shuffled_items[day_idx]);
          total_items_created := total_items_created + 1;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
  UPDATE public.projects SET total_contents = total_items_created WHERE id = new_project_id;
  RETURN jsonb_build_object('project_id', new_project_id, 'items_created', total_items_created);
END;
$$;

-- 6. TRIGGERS
-- New user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-assignment trigger
DROP TRIGGER IF EXISTS on_content_item_status_change ON public.content_items;
CREATE TRIGGER on_content_item_status_change
    AFTER INSERT OR UPDATE OF status ON public.content_items
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_advanced_assignment_after();

-- 7. STORAGE
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-assets', 'project-assets', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can upload project assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Public access to project assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'project-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. SEED DATA (Default Admin)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
  'storycatcreative@gmail.com', crypt('Hostingerforstorycat@7697', gen_salt('bf')), now(), now(), now(), 
  '{"provider": "email", "providers": ["email"]}', '{"full_name": "Super Admin", "role": "admin"}', now(), now()
) ON CONFLICT (id) DO NOTHING;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
