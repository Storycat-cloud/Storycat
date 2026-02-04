-- Refined Trigger for Status Changes
CREATE OR REPLACE FUNCTION public.trigger_advanced_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. LOYALTY LOOP: If item is rejected, assign back to last_assignee_id
    IF NEW.status IN ('rejected_from_copy_qc', 'rejected_from_design_qc') THEN
        IF NEW.last_assignee_id IS NOT NULL THEN
            IF NEW.status = 'rejected_from_copy_qc' THEN
                NEW.copy_assignee := NEW.last_assignee_id;
                NEW.status := 'pending_copy'; -- Move back to active state
            ELSIF NEW.status = 'rejected_from_design_qc' THEN
                NEW.design_assignee := NEW.last_assignee_id;
                NEW.status := 'pending_design';
            END IF;
        END IF;
    -- 2. AUTO ASSIGNMENT: If status changes to a 'pending' state and assignee is null
    ELSIF NEW.status IN ('pending_copy', 'pending_copy_qc', 'pending_design', 'pending_design_qc') 
          AND (
            (NEW.status = 'pending_copy' AND NEW.copy_assignee IS NULL) OR
            (NEW.status = 'pending_copy_qc' AND NEW.copy_qc_assignee IS NULL) OR
            (NEW.status = 'pending_design' AND NEW.design_assignee IS NULL) OR
            (NEW.status = 'pending_design_qc' AND NEW.design_qc_assignee IS NULL)
          ) THEN
        -- Run the scoring engine
        -- Note: We do this AFTER the row is saved or in a background worker for best performance, 
        -- but for simplicity here we call the assignment logic.
        -- However, triggers can't easily perform updates on the same table without infinite loops.
        -- So we use a separate function called after the trigger completes or use PERFORM.
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trigger_advanced_assignment_after()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run auto-assignment if the item is unassigned and in a pending state
    IF NEW.status IN ('pending_copy', 'pending_copy_qc', 'pending_design', 'pending_design_qc') THEN
         PERFORM public.execute_auto_assignment(NEW.id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- We'll use an AFTER trigger to avoid the same-row update issue
DROP TRIGGER IF EXISTS on_content_item_status_change ON public.content_items;

CREATE TRIGGER on_content_item_status_change
    AFTER INSERT OR UPDATE OF status ON public.content_items
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_advanced_assignment_after();
