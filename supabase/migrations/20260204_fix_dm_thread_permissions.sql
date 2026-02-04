-- 1. Ensure the column exists
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS dm_thread TEXT;

-- 2. Ensure the Digital Marketer update policy covers this column
-- (Standardizing the policy to allow DMs to update their assigned items)

-- First, drop existing restrictive policy if it exists (optional, safer to just create a new one if needed, but let's update the generic one)
DROP POLICY IF EXISTS "Digital Marketers can update their own content items" ON public.content_items;

CREATE POLICY "Digital Marketers can update their own content items"
ON public.content_items
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.project_onboarding po
        WHERE po.project_id = content_items.project_id
        AND po.dedicated_dm_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- 3. Grant permissions just in case
GRANT UPDATE (dm_thread) ON public.content_items TO authenticated;
GRANT SELECT ON public.content_items TO authenticated;

-- 4. Verify Schema (Optional check returns)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_items' AND column_name = 'dm_thread';
