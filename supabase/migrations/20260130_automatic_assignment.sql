-- Function to find and assign the best employee for a content item
CREATE OR REPLACE FUNCTION public.assign_content_item_optimally(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_project_stars INTEGER;
  v_status TEXT;
  v_role_needed TEXT;
  v_assignee_id UUID;
  v_publish_date DATE;
BEGIN
  -- 1. Get item details
  SELECT ci.status, ci.publish_date, p.priority_stars
  INTO v_status, v_publish_date, v_project_stars
  FROM public.content_items ci
  JOIN public.projects p ON ci.project_id = p.id
  WHERE ci.id = p_item_id;

  -- 2. Determine role needed based on status
  CASE v_status
    WHEN 'pending_dm' THEN v_role_needed := 'digital_marketing_manager';
    WHEN 'pending_copy' THEN v_role_needed := 'copywriter';
    WHEN 'pending_copy_qc' THEN v_role_needed := 'copy_qc';
    WHEN 'pending_design' THEN v_role_needed := 'designer';
    WHEN 'pending_design_qc' THEN v_role_needed := 'designer_qc';
    ELSE RETURN; -- No assignment needed for other statuses
  END CASE;

  -- 3. Find optimal employee
  -- Rule: Employee star_rating >= project_stars
  -- Rule: Has capacity (active tasks for that day < projects_per_day)
  -- Rank by star_rating DESC (fill top talent first)
  SELECT prof.id INTO v_assignee_id
  FROM public.profiles prof
  WHERE prof.role = v_role_needed
    AND prof.star_rating >= v_project_stars -- Primary rule
    AND (
      -- Check capacity: count items assigned to them on that publish_date
      SELECT count(*)
      FROM public.content_items
      WHERE (
        dm_assignee = prof.id OR 
        copy_assignee = prof.id OR 
        design_assignee = prof.id OR 
        copy_qc_assignee = prof.id OR 
        design_qc_assignee = prof.id
      )
      AND publish_date = v_publish_date
    ) < prof.projects_per_day
  ORDER BY prof.star_rating DESC, random() -- Random for tie-breaking
  LIMIT 1;

  -- 4. Fallback: If no high-star employee has capacity, check for lower-star employees 
  -- but ONLY if project_stars is lower or equal to their rating (as per user: "cant work on 5 star client unless manuals")
  -- Actually, the above query already handles it. If project is 5 star, prof.star_rating >= 5 only matches 5 stars.
  -- If project is 4 star, 5 star employees can also take it (prof.star_rating >= 4 matches 4 AND 5 stars).

  -- 5. Update the item with the assignee
  IF v_assignee_id IS NOT NULL THEN
    CASE v_status
      WHEN 'pending_dm' THEN UPDATE public.content_items SET dm_assignee = v_assignee_id WHERE id = p_item_id;
      WHEN 'pending_copy' THEN UPDATE public.content_items SET copy_assignee = v_assignee_id WHERE id = p_item_id;
      WHEN 'pending_copy_qc' THEN UPDATE public.content_items SET copy_qc_assignee = v_assignee_id WHERE id = p_item_id;
      WHEN 'pending_design' THEN UPDATE public.content_items SET design_assignee = v_assignee_id WHERE id = p_item_id;
      WHEN 'pending_design_qc' THEN UPDATE public.content_items SET design_qc_assignee = v_assignee_id WHERE id = p_item_id;
    END CASE;
  END IF;
END;
$$;

-- Trigger to automatically assign on status change or creation
CREATE OR REPLACE FUNCTION public.trigger_assign_content_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Run assignment logic
  PERFORM public.assign_content_item_optimally(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_content_item_status_change
  AFTER INSERT OR UPDATE OF status ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_assign_content_item();
