-- Enable pgcrypto for password hashing if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop previous versions to allow parameter renaming
DROP FUNCTION IF EXISTS public.create_employee(text, text, text, text);
DROP FUNCTION IF EXISTS public.delete_employee(uuid);

-- 1. Create Employee Function
CREATE OR REPLACE FUNCTION public.create_employee(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Allows this function to bypass RLS and write to auth.users
SET search_path = public, auth, extensions -- Secure search path
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Validate executing user is an admin (Optional but recommended)
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
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- The trigger public.on_auth_user_created (defined in schema.sql) 
  -- will automatically create the public.profile entry using the raw_user_meta_data.

  RETURN new_user_id;
END;
$$;


-- 2. Delete Employee Function
CREATE OR REPLACE FUNCTION public.delete_employee(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Validate executing user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access Denied: Only admins can delete employees';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
