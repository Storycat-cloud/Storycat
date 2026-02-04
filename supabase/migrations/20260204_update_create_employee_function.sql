-- Update create_employee RPC function to use role-specific capacity fields
-- This replaces the p_projects_per_day parameter with three capacity parameters

-- Drop ALL old function signatures to avoid conflicts
DROP FUNCTION IF EXISTS public.create_employee(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.create_employee(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.create_employee(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_star_rating INTEGER DEFAULT 3,
    p_daily_copy_capacity INTEGER DEFAULT 0,
    p_daily_design_capacity INTEGER DEFAULT 0,
    p_daily_qc_capacity INTEGER DEFAULT 0,
    p_weekly_capacity INTEGER DEFAULT 50
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Create auth user
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
        p_email,
        crypt(p_password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', p_full_name),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    )
    RETURNING id INTO v_user_id;

    -- Create profile with new capacity fields
    INSERT INTO public.profiles (
        id,
        full_name,
        role,
        star_rating,
        daily_copy_capacity,
        daily_design_capacity,
        daily_qc_capacity,
        weekly_capacity
    ) VALUES (
        v_user_id,
        p_full_name,
        p_role,
        p_star_rating,
        p_daily_copy_capacity,
        p_daily_design_capacity,
        p_daily_qc_capacity,
        p_weekly_capacity
    );

    RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION public.create_employee IS 'Creates a new employee user with role-specific daily capacity tracking';
