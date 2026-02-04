-- Add dedicated role columns to project_onboarding
ALTER TABLE public.project_onboarding 
ADD COLUMN IF NOT EXISTS dedicated_dm_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS dedicated_copywriter_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS dedicated_copy_qc_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS dedicated_designer_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS dedicated_designer_qc_id UUID REFERENCES public.profiles(id);

-- Add index for performance on these new columns
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_dm ON public.project_onboarding(dedicated_dm_id);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_copywriter ON public.project_onboarding(dedicated_copywriter_id);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_copy_qc ON public.project_onboarding(dedicated_copy_qc_id);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_designer ON public.project_onboarding(dedicated_designer_id);
CREATE INDEX IF NOT EXISTS idx_project_onboarding_dedicated_designer_qc ON public.project_onboarding(dedicated_designer_qc_id);

-- Update the auto-assignment logic to respect dedicated team members
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
    -- Get task info
    SELECT ci.status, ci.publish_date, p.priority_stars, ci.complexity_weight, ci.project_id
    INTO v_status, v_publish_date, v_project_stars, v_complexity, v_project_id
    FROM public.content_items ci
    JOIN public.projects p ON ci.project_id = p.id
    WHERE ci.id = p_item_id;

    -- Map status to role
    CASE v_status
        WHEN 'pending_dm' THEN v_role_needed := 'digital_marketing_manager';
        WHEN 'pending_copy' THEN v_role_needed := 'copywriter';
        WHEN 'pending_copy_qc' THEN v_role_needed := 'copy_qc';
        WHEN 'pending_design' THEN v_role_needed := 'designer';
        WHEN 'pending_design_qc' THEN v_role_needed := 'designer_qc';
        ELSE RETURN NULL;
    END CASE;

    -- CHECK FOR DEDICATED ASSIGNMENT FIRST
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

    -- If there's a dedicated person, check if they have capacity/rating
    -- Note: We might want dedicated assignment to BYPASS star rating, 
    -- but let's keep it safe for now: if admin explicitly sets them, they are preferred.
    IF v_dedicated_user_id IS NOT NULL THEN
        -- Verify dedicated person exists and has same role (and maybe capacity?)
        -- For now, if dedicated is set, we PREFER them above all else.
        SELECT prof.id INTO v_best_user_id
        FROM public.profiles prof
        WHERE prof.id = v_dedicated_user_id
        AND prof.role = v_role_needed;
        
        IF v_best_user_id IS NOT NULL THEN
            RETURN v_best_user_id;
        END IF;
    END IF;

    -- FALLBACK: STANDARD ALGORITHM
    SELECT prof.id INTO v_best_user_id
    FROM public.profiles prof
    WHERE prof.role = v_role_needed
    AND prof.star_rating >= v_project_stars -- Quality Gate
    AND (prof.weekly_capacity - public.calculate_user_load(prof.id)) >= v_complexity -- Capacity Gate
    ORDER BY 
        -- SCORING LOGIC
        -- 1. Loyalty Loop: Preference if they worked on this project before (+50)
        (CASE WHEN EXISTS (
            SELECT 1 FROM public.content_items 
            WHERE project_id = v_project_id 
            AND (copy_assignee = prof.id OR design_assignee = prof.id OR dm_assignee = prof.id)
        ) THEN 50 ELSE 0 END) +
        -- 2. Star Match Score: (Employee Stars - Client Stars) * 10
        ((prof.star_rating - v_project_stars) * 10) +
        -- 3. Load Score: (Weekly Capacity - Current Load) / 10
        ((prof.weekly_capacity - public.calculate_user_load(prof.id)) / 10) DESC,
        -- Tie breaker: random
        random()
    LIMIT 1;

    RETURN v_best_user_id;
END;
$$;
