-- Migration: Add Calendar Extension Function
-- This function extends a project's content calendar by generating additional years of content items

CREATE OR REPLACE FUNCTION public.extend_project_calendar(
  p_project_id UUID,
  p_years_to_add INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  project_record RECORD;
  content_type_counts JSONB;
  new_start_date DATE;
  new_end_date DATE;
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
  duration_months INTEGER;
BEGIN
  -- 1. Fetch project details
  SELECT * INTO project_record FROM public.projects WHERE id = p_project_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  
  -- 2. Calculate content type distribution from existing items
  -- Get the average count per month for each content type
  SELECT jsonb_object_agg(content_type, CEIL(avg_count))
  INTO content_type_counts
  FROM (
    SELECT 
      content_type,
      COUNT(*)::FLOAT / GREATEST(
        EXTRACT(YEAR FROM AGE(project_record.end_date, project_record.start_date)) * 12 +
        EXTRACT(MONTH FROM AGE(project_record.end_date, project_record.start_date)) + 1,
        1
      ) as avg_count
    FROM public.content_items
    WHERE project_id = p_project_id AND content_type IS NOT NULL
    GROUP BY content_type
  ) subq;
  
  -- If no content types found, return error
  IF content_type_counts IS NULL OR content_type_counts = '{}'::jsonb THEN
    RAISE EXCEPTION 'No content items found to determine distribution pattern';
  END IF;
  
  -- 3. Calculate new dates
  new_start_date := project_record.end_date + INTERVAL '1 day';
  duration_months := 12 * p_years_to_add;
  new_end_date := new_start_date + (duration_months || ' months')::INTERVAL - INTERVAL '1 day';
  
  -- 4. Generate content items using the same shuffle logic
  FOR month_idx IN 0..(duration_months - 1) LOOP
    current_month_start := (new_start_date + (month_idx || ' months')::INTERVAL);
    current_month_end := (current_month_start + INTERVAL '1 month' - INTERVAL '1 day');
    
    -- a. Build the list of items for THIS month
    month_items := ARRAY[]::TEXT[];
    FOR type_key, type_qty IN SELECT * FROM jsonb_each_text(content_type_counts) LOOP
      FOR i IN 1..type_qty::INTEGER LOOP
        month_items := array_append(month_items, type_key);
      END LOOP;
    END LOOP;
    
    items_to_create_this_month := COALESCE(array_length(month_items, 1), 0);
    
    IF items_to_create_this_month > 0 THEN
      -- b. SHUFFLE the items for this month
      SELECT array_agg(val ORDER BY random()) INTO shuffled_items FROM unnest(month_items) AS val;
      
      -- c. Find all valid days in this month (Skip Sundays and 2nd Saturdays)
      valid_days := ARRAY[]::DATE[];
      target_day := current_month_start;
      WHILE target_day <= current_month_end LOOP
        -- Check if Sunday (0)
        IF extract(dow from target_day) != 0 THEN
          -- Check if 2nd Saturday
          is_second_sat := FALSE;
          IF extract(dow from target_day) = 6 THEN
             -- It's a Saturday, check if it's the second one (day 8 to 14)
             IF extract(day from target_day) BETWEEN 8 AND 14 THEN
                is_second_sat := TRUE;
             END IF;
          END IF;
          
          IF NOT is_second_sat THEN
            valid_days := array_append(valid_days, target_day);
          END IF;
        END IF;
        target_day := target_day + INTERVAL '1 day';
      END LOOP;
      
      num_valid_days := COALESCE(array_length(valid_days, 1), 0);
      
      -- d. Distribute shuffled items over valid days
      IF num_valid_days > 0 THEN
        step_size := num_valid_days::FLOAT / items_to_create_this_month;
        FOR day_idx IN 1..items_to_create_this_month LOOP
          day_pos := ((day_idx - 1) * step_size) + 1;
          target_day := valid_days[floor(day_pos)::INTEGER];
          
          INSERT INTO public.content_items (
            project_id, publish_date, status, content_type, dm_title, dm_description
          ) VALUES (
            p_project_id, target_day, 'pending_dm', shuffled_items[day_idx], 
            shuffled_items[day_idx], 
            'Auto-generated ' || shuffled_items[day_idx]
          );
          total_items_created := total_items_created + 1;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
  
  -- 5. Update project end_date and total_contents
  UPDATE public.projects 
  SET 
    end_date = new_end_date,
    total_contents = total_contents + total_items_created
  WHERE id = p_project_id;
  
  RETURN jsonb_build_object(
    'items_created', total_items_created,
    'new_end_date', new_end_date,
    'content_type_distribution', content_type_counts
  );
END;
$$;
