-- Drop the specific policies causing the infinite recursion loop between modulos and course_enrollments
DROP POLICY IF EXISTS "Teachers can view enrollments" ON public.course_enrollments;
DROP POLICY IF EXISTS "Ver módulos de ediciones accesibles" ON public.modulos;

-- We already have the 'Public read' policies from earlier scripts, 
-- so data will still be accessible for reading.

-- Ensure the schema cache is updated
NOTIFY pgrst, 'reload schema';
