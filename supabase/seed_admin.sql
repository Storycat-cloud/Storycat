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

-- Note: The trigger public.on_auth_user_created defined in your schema 
-- will automatically create the corresponding public.profile entry 
-- using the 'role': 'admin' from raw_user_meta_data.
