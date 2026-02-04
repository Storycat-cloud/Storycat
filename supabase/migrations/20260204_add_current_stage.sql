-- Migration: Add current_stage field and stage-based workflow system
-- This implements strict pipeline control where only the current stage role can edit

-- 1. Create stage enum type safely
DO $$ BEGIN
    CREATE TYPE content_stage AS ENUM (
        'admin',
        'digital_marketer',
        'copywriter',
        'copy_qc',
        'designer',
        'design_qc',
        'digital_marketer_posting',
        'completed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to content_items
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS current_stage content_stage DEFAULT 'digital_marketer',
ADD COLUMN IF NOT EXISTS current_stage_started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Add stage lock timestamps for audit trail
ALTER TABLE public.content_items
ADD COLUMN IF NOT EXISTS dm_stage_locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS copy_stage_locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS copy_qc_stage_locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS design_stage_locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS design_qc_stage_locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS posting_stage_locked_at TIMESTAMP WITH TIME ZONE;

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_content_items_current_stage ON public.content_items(current_stage);

-- 5. Migrate existing data: map old status to current_stage
UPDATE public.content_items
SET current_stage = CASE status
    WHEN 'pending_dm' THEN 'digital_marketer'::content_stage
    WHEN 'pending_copy' THEN 'copywriter'::content_stage
    WHEN 'pending_copy_qc' THEN 'copy_qc'::content_stage
    WHEN 'pending_design' THEN 'designer'::content_stage
    WHEN 'pending_design_qc' THEN 'design_qc'::content_stage
    WHEN 'completed' THEN 'completed'::content_stage
    ELSE 'digital_marketer'::content_stage
END
WHERE current_stage IS NULL OR current_stage = 'digital_marketer';

-- 6. Drop old policies
DROP POLICY IF EXISTS "Employees can update assigned items or matching role stage" ON public.content_items;
DROP POLICY IF EXISTS "Users can only edit content at their current stage" ON public.content_items;

-- 7. Create strict stage-based UPDATE policy
CREATE POLICY "Users can only edit content at their current stage"
ON public.content_items
FOR UPDATE
USING (
    -- Admins can always edit
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- Digital Marketer can edit when stage is digital_marketer or digital_marketer_posting
    (
        current_stage IN ('digital_marketer', 'digital_marketer_posting')
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'digital_marketing_manager'
        )
        AND (
            dm_assignee = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.project_onboarding po
                WHERE po.project_id = content_items.project_id
                AND po.dedicated_dm_id = auth.uid()
            )
        )
    )
    OR
    -- Copywriter can edit when stage is copywriter
    (
        current_stage = 'copywriter'
        AND copy_assignee = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'copywriter'
        )
    )
    OR
    -- Copy QC can edit when stage is copy_qc
    (
        current_stage = 'copy_qc'
        AND copy_qc_assignee = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'copy_qc'
        )
    )
    OR
    -- Designer can edit when stage is designer
    (
        current_stage = 'designer'
        AND design_assignee = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'designer'
        )
    )
    OR
    -- Design QC can edit when stage is design_qc
    (
        current_stage = 'design_qc'
        AND design_qc_assignee = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'designer_qc'
        )
    )
);

-- 8. Create stage advancement function
CREATE OR REPLACE FUNCTION public.advance_content_stage(
    p_content_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_stage content_stage;
    v_next_stage content_stage;
    v_project_id UUID;
    v_result JSONB;
BEGIN
    -- Get current stage and project
    SELECT current_stage, project_id 
    INTO v_current_stage, v_project_id
    FROM public.content_items
    WHERE id = p_content_item_id;

    IF v_current_stage IS NULL THEN
        RAISE EXCEPTION 'Content item not found';
    END IF;

    -- Determine next stage
    v_next_stage := CASE v_current_stage
        WHEN 'admin' THEN 'digital_marketer'::content_stage
        WHEN 'digital_marketer' THEN 'copywriter'::content_stage
        WHEN 'copywriter' THEN 'copy_qc'::content_stage
        WHEN 'copy_qc' THEN 'designer'::content_stage
        WHEN 'designer' THEN 'design_qc'::content_stage
        WHEN 'design_qc' THEN 'digital_marketer_posting'::content_stage
        WHEN 'digital_marketer_posting' THEN 'completed'::content_stage
        ELSE 'completed'::content_stage
    END;

    -- Lock current stage and advance
    UPDATE public.content_items
    SET 
        current_stage = v_next_stage,
        current_stage_started_at = NOW(),
        dm_stage_locked_at = CASE WHEN v_current_stage = 'digital_marketer' THEN NOW() ELSE dm_stage_locked_at END,
        copy_stage_locked_at = CASE WHEN v_current_stage = 'copywriter' THEN NOW() ELSE copy_stage_locked_at END,
        copy_qc_stage_locked_at = CASE WHEN v_current_stage = 'copy_qc' THEN NOW() ELSE copy_qc_stage_locked_at END,
        design_stage_locked_at = CASE WHEN v_current_stage = 'designer' THEN NOW() ELSE design_stage_locked_at END,
        design_qc_stage_locked_at = CASE WHEN v_current_stage = 'design_qc' THEN NOW() ELSE design_qc_stage_locked_at END,
        posting_stage_locked_at = CASE WHEN v_current_stage = 'digital_marketer_posting' THEN NOW() ELSE posting_stage_locked_at END,
        -- Update old status field for backward compatibility
        status = CASE v_next_stage
            WHEN 'digital_marketer'::content_stage THEN 'pending_dm'
            WHEN 'copywriter'::content_stage THEN 'pending_copy'
            WHEN 'copy_qc'::content_stage THEN 'pending_copy_qc'
            WHEN 'designer'::content_stage THEN 'pending_design'
            WHEN 'design_qc'::content_stage THEN 'pending_design_qc'
            WHEN 'digital_marketer_posting'::content_stage THEN 'pending_dm'
            WHEN 'completed'::content_stage THEN 'completed'
            ELSE status
        END
    WHERE id = p_content_item_id;

    -- Trigger auto-assignment for next stage if function exists
    BEGIN
        PERFORM public.assign_content_item(p_content_item_id);
    EXCEPTION
        WHEN undefined_function THEN
            -- Function doesn't exist yet, skip auto-assignment
            NULL;
    END;

    v_result := jsonb_build_object(
        'success', true,
        'previous_stage', v_current_stage,
        'new_stage', v_next_stage,
        'content_item_id', p_content_item_id
    );

    RETURN v_result;
END;
$$;

-- 9. Grant execute permission
GRANT EXECUTE ON FUNCTION public.advance_content_stage(UUID) TO authenticated;

-- 10. Add helpful comment
COMMENT ON COLUMN public.content_items.current_stage IS 'Current pipeline stage - only users with matching role can edit';
COMMENT ON FUNCTION public.advance_content_stage(UUID) IS 'Advances content to next stage, locks previous stage, and triggers auto-assignment';
