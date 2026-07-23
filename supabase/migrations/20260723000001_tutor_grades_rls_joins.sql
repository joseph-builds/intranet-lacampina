-- Migración para añadir soporte de lectura a tutores en las tablas relacionadas (JOINs)

-- 1. Crear función auxiliar segura para verificar si el tutor tiene un alumno en un curso específico
CREATE OR REPLACE FUNCTION public.is_tutor_of_course_student(course_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    JOIN public.student_sections ss ON ss.student_id = ce.student_id
    JOIN public.sections s ON s.id = ss.section_id
    WHERE ce.course_id = course_uuid
      AND s.tutor_id = public.get_auth_user_id()
      AND ce.is_active = true
  );
$$;

-- 2. Añadir políticas de RLS para el rol de Tutor en las tablas relacionadas

-- grade_weight_configurations (Configuración de pesos por bimestre)
DROP POLICY IF EXISTS "Tutors can view weight configs" ON public.grade_weight_configurations;
CREATE POLICY "Tutors can view weight configs" ON public.grade_weight_configurations
  FOR SELECT USING (public.is_tutor_of_course_student(course_id));

-- courses
DROP POLICY IF EXISTS "Tutors can view courses of their students" ON public.courses;
CREATE POLICY "Tutors can view courses of their students" ON public.courses
  FOR SELECT USING (public.is_tutor_of_course_student(id));

-- quizzes (Usa course_id)
DROP POLICY IF EXISTS "Tutors can view quizzes of their students" ON public.quizzes;
CREATE POLICY "Tutors can view quizzes of their students" ON public.quizzes
  FOR SELECT USING (public.is_tutor_of_course_student(course_id));

-- assignments (Usa course_id)
DROP POLICY IF EXISTS "Tutors can view assignments of their students" ON public.assignments;
CREATE POLICY "Tutors can view assignments of their students" ON public.assignments
  FOR SELECT USING (public.is_tutor_of_course_student(course_id));

-- exams (Usa course_id)
DROP POLICY IF EXISTS "Tutors can view exams of their students" ON public.exams;
CREATE POLICY "Tutors can view exams of their students" ON public.exams
  FOR SELECT USING (public.is_tutor_of_course_student(course_id));

-- Notificar a PostgREST que recargue el esquema para reflejar las nuevas funciones/políticas
NOTIFY pgrst, 'reload schema';
