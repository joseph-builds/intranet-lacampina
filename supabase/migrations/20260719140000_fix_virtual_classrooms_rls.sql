-- Enable RLS (if not already enabled) and create a public read policy
ALTER TABLE public.virtual_classrooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read virtual_classrooms" ON public.virtual_classrooms;
CREATE POLICY "Public read virtual_classrooms" ON public.virtual_classrooms FOR SELECT USING (true);
