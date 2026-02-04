-- Add dm_thread to content_items
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS dm_thread TEXT;
