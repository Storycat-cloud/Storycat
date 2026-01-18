-- 1. Add content_type column to content_items
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'General';

-- 2. Create RPC function to create project with specific content types
CREATE OR REPLACE FUNCTION public.create_project_with_types(
  p_title TEXT,
  p_brief TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_content_counts JSONB, -- Example: {"Posters": 5, "Reels": 3}
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_project_id UUID;
  total_count INTEGER := 0;
  key TEXT;
  value INTEGER;
  i INTEGER;
  item_date DATE;
  day_interval INTEGER;
  current_type_index INTEGER := 0;
  type_list TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 1. Calculate total items and build a flat list of types to distribute
  -- Iterate nicely through JSONB keys
  FOR key, value IN SELECT * FROM jsonb_each_text(p_content_counts)
  LOOP
    total_count := total_count + value::INTEGER;
    -- Add this type 'value' number of times to the list
    FOR i IN 1..value::INTEGER LOOP
        type_list := array_append(type_list, key);
    END LOOP;
  END LOOP;

  -- 2. Create the Project
  INSERT INTO public.projects (
    title, brief, total_contents, start_date, end_date, created_by, status
  ) VALUES (
    p_title, p_brief, total_count, p_start_date, p_end_date, p_created_by, 'active'
  ) RETURNING id INTO new_project_id;

  -- 3. Generate Content Items
  IF total_count > 0 THEN
    -- precise distribution
    day_interval := (p_end_date - p_start_date) / GREATEST(total_count, 1);
    
    FOR i IN 1..total_count LOOP
      -- Calculate date: start + (i * interval) - somewhat roughly distributed
      item_date := p_start_date + (day_interval * (i - 1));
      
      -- Ensure we don't go past end date (basic safety)
      IF item_date > p_end_date THEN item_date := p_end_date; END IF;

      INSERT INTO public.content_items (
        project_id,
        publish_date,
        status,
        content_type,
        dm_title, -- Auto-generate a title
        dm_description
      ) VALUES (
        new_project_id,
        item_date,
        'pending_dm',
        type_list[i], -- Pick from our flattened list
        type_list[i] || ' #' || i, -- Temporary title e.g., "Reels #1"
        'Auto-generated ' || type_list[i]
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'project_id', new_project_id,
    'items_created', total_count
  );
END;
$$;
