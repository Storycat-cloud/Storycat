-- Update create_employee RPC to support weekly_capacity
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
  -- Validate executing user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access Denied: Only admins can create employees';
  END IF;

  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
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
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object(
      'full_name', p_full_name, 
      'role', p_role,
      'star_rating', p_star_rating,
      'projects_per_day', p_projects_per_day,
      'weekly_capacity', p_weekly_capacity
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;

-- Update handle_new_user trigger function to capture weekly_capacity
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
