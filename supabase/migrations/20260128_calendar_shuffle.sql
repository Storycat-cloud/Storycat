-- 1. Ensure projects table has priority_stars
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS priority_stars INTEGER DEFAULT 3;

-- 2. Update the RPC function to shuffle content types
CREATE OR REPLACE FUNCTION public.create_project_with_types(
  p_title TEXT,
  p_brief TEXT,
  p_start_date DATE,
  p_duration_months INTEGER DEFAULT 12,
  p_priority_stars INTEGER DEFAULT 3,
  p_content_counts JSONB DEFAULT '{}'::jsonb,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_project_id UUID;
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
BEGIN
  -- 1. Create the Project
  INSERT INTO public.projects (
    title, brief, total_contents, start_date, end_date, created_by, status, priority_stars
  ) VALUES (
    p_title, p_brief, 0, p_start_date, p_start_date + (p_duration_months || ' months')::INTERVAL - INTERVAL '1 day', p_created_by, 'active', p_priority_stars
  ) RETURNING id INTO new_project_id;

  -- 2. Loop through each month
  FOR month_idx IN 0..(p_duration_months - 1) LOOP
    current_month_start := (p_start_date + (month_idx || ' months')::INTERVAL);
    current_month_end := (current_month_start + INTERVAL '1 month' - INTERVAL '1 day');
    
    -- a. Build the list of items for THIS month
    month_items := ARRAY[]::TEXT[];
    FOR type_key, type_qty IN SELECT * FROM jsonb_each_text(p_content_counts) LOOP
      FOR i IN 1..type_qty::INTEGER LOOP
        month_items := array_append(month_items, type_key);
      END LOOP;
    END LOOP;
    
    items_to_create_this_month := COALESCE(array_length(month_items, 1), 0);
    
    IF items_to_create_this_month > 0 THEN
      -- b. SHUFFLE the items for this month using ORDER BY random()
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
        -- Distribute items as evenly as possible using a stepping logic
        step_size := num_valid_days::FLOAT / items_to_create_this_month;
        FOR day_idx IN 1..items_to_create_this_month LOOP
          day_pos := ((day_idx - 1) * step_size) + 1;
          target_day := valid_days[floor(day_pos)::INTEGER];
          
          INSERT INTO public.content_items (
            project_id, publish_date, status, content_type, dm_title, dm_description
          ) VALUES (
            new_project_id, target_day, 'pending_dm', shuffled_items[day_idx], 
            shuffled_items[day_idx], 
            'Auto-generated ' || shuffled_items[day_idx]
          );
          total_items_created := total_items_created + 1;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  -- Update total count in project
  UPDATE public.projects SET total_contents = total_items_created WHERE id = new_project_id;

  RETURN jsonb_build_object(
    'project_id', new_project_id,
    'items_created', total_items_created
  );
END;
$$;
