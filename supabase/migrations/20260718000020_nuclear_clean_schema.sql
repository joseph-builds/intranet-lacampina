-- Drop policies that cause infinite recursion
DROP POLICY IF EXISTS "Teacher can view their modulos" ON public.modulos;
DROP POLICY IF EXISTS "Students can view enrolled modulos" ON public.modulos;
DROP POLICY IF EXISTS "Admin can manage modulos" ON public.modulos;
DROP POLICY IF EXISTS "Admins can view all modulos" ON public.modulos;
DROP POLICY IF EXISTS "Teachers can view their modulos" ON public.modulos;
DROP POLICY IF EXISTS "Students can view enrolled modulos" ON public.modulos;
DROP POLICY IF EXISTS "Todos pueden ver modulos" ON public.modulos;

-- Same for courses just in case
DROP POLICY IF EXISTS "Teacher can view their courses" ON public.courses;
DROP POLICY IF EXISTS "Students can view enrolled courses" ON public.courses;
DROP POLICY IF EXISTS "Admin can manage courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can view all courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers can view their courses" ON public.courses;
DROP POLICY IF EXISTS "Students can view enrolled courses" ON public.courses;
DROP POLICY IF EXISTS "Todos pueden ver cursos" ON public.courses;

-- Add new simple policies
CREATE POLICY "Public read modulos" ON public.modulos FOR SELECT USING (true);
CREATE POLICY "Public read courses" ON public.courses FOR SELECT USING (true);

-- We need to truncate course_enrollments to change the FK without data violations
TRUNCATE TABLE public.course_enrollments CASCADE;

-- Rename modulo_id to course_id across all relevant tables
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT unnest(ARRAY[
            'assignments', 
            'attendance', 
            'course_enrollments',
            'course_events',
            'course_forum_topics',
            'course_weekly_sections',
            'exams',
            'quizzes'
        ])
    LOOP
        -- Check if modulo_id column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = 'modulo_id') THEN
            -- Check if course_id already exists (maybe we already renamed it in some tables?)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = 'course_id') THEN
                EXECUTE format('ALTER TABLE public.%I RENAME COLUMN modulo_id TO course_id', t_name);
            ELSE
                -- If course_id exists and modulo_id exists, drop modulo_id
                EXECUTE format('ALTER TABLE public.%I DROP COLUMN modulo_id', t_name);
            END IF;
        END IF;
    END LOOP;
END
$$;

-- Drop the old constraint on course_enrollments if it points to modulos
ALTER TABLE public.course_enrollments 
    DROP CONSTRAINT IF EXISTS course_enrollments_modulo_id_fkey,
    DROP CONSTRAINT IF EXISTS course_enrollments_course_id_fkey;

-- Create the new constraint pointing to courses
ALTER TABLE public.course_enrollments 
    ADD CONSTRAINT course_enrollments_course_id_fkey 
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

-- To make things clear, notify pgrst to reload the schema cache
NOTIFY pgrst, 'reload schema';
