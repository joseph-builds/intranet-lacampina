-- Migración para habilitar que el tutor pueda ver las notas de sus alumnos

-- 1. Crear función auxiliar segura (ignorando RLS temporalmente con SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_tutor_of_student(student_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_sections ss
    JOIN public.sections s ON s.id = ss.section_id
    WHERE ss.student_id = student_uuid
      AND s.tutor_id = public.get_auth_user_id()
  );
$$;

-- 2. Añadir políticas de RLS para el rol de Tutor en las tablas de notas

-- grade_records
DROP POLICY IF EXISTS "Tutors can view grade records" ON public.grade_records;
CREATE POLICY "Tutors can view grade records" ON public.grade_records
  FOR SELECT USING (public.is_tutor_of_student(student_id));

-- grade_consolidations
DROP POLICY IF EXISTS "Tutors can view consolidations" ON public.grade_consolidations;
CREATE POLICY "Tutors can view consolidations" ON public.grade_consolidations
  FOR SELECT USING (public.is_tutor_of_student(student_id));

-- assignment_submissions
DROP POLICY IF EXISTS "Tutors can view assignment submissions" ON public.assignment_submissions;
CREATE POLICY "Tutors can view assignment submissions" ON public.assignment_submissions
  FOR SELECT USING (public.is_tutor_of_student(student_id));

-- quiz_submissions
DROP POLICY IF EXISTS "Tutors can view quiz submissions" ON public.quiz_submissions;
CREATE POLICY "Tutors can view quiz submissions" ON public.quiz_submissions
  FOR SELECT USING (public.is_tutor_of_student(student_id));

-- Notificar a PostgREST que recargue el esquema para reflejar las nuevas funciones/políticas
NOTIFY pgrst, 'reload schema';
