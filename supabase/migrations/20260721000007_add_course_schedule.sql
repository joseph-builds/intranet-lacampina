-- Add schedule column to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS schedule TEXT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
