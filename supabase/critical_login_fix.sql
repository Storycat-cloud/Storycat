-- CRITICAL FIX: Initialize Auth Tokens & Reset Admin
-- This fixes the "Database error querying schema" error on login

-- 1. Ensure Extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Clean up previous attempt for this email to avoid token issues
DELETE FROM auth.users WHERE email = 'storycatcreative@gmail.com';

-- 3. Insert Admin with EXPLICIT empty tokens (Required by many Supabase versions)
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
  recovery_token,
  is_super_admin,
  phone_confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000000', 
  gen_random_uuid(), 
  'authenticated', 
  'authenticated', 
  'storycatcreative@gmail.com', 
  crypt('Hostingerforstorycat@7697', gen_salt('bf')), 
  now(), 
  now(), 
  now(), 
  '{"provider": "email", "providers": ["email"]}', 
  '{"full_name": "Super Admin", "role": "admin"}', 
  now(), 
  now(),
  '', -- confirmation_token
  '', -- email_change
  '', -- email_change_token_new
  '', -- recovery_token
  false,
  now()
);

-- 4. Manual Profile check (Fallback in case trigger was shaky)
-- Note: Trigger SHOULD run, but we ensure the profile is admin here too.
DO $$
DECLARE
    target_id UUID;
BEGIN
    SELECT id INTO target_id FROM auth.users WHERE email = 'storycatcreative@gmail.com';
    
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (target_id, 'Super Admin', 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
END $$;

-- 5. Final Schema Refresh
NOTIFY pgrst, 'reload schema';
