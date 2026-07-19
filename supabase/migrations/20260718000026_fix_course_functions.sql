-- Revert and fix course security functions to use public.get_auth_user_id() which points to profiles.id

CREATE OR REPLACE FUNCTION public.is_teacher_of_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    -- Primary teacher of the course
    SELECT 1 FROM public.courses c
    WHERE c.id = is_teacher_of_course.course_id AND c.teacher_principal_id = public.get_auth_user_id()
    
    UNION
    
    -- Additional teacher
    SELECT 1 FROM public.course_teachers ct
    WHERE ct.course_id = is_teacher_of_course.course_id AND ct.teacher_id = public.get_auth_user_id()
    
    UNION
    
    -- Teacher assigned via section_courses (Aulas Virtuales)
    SELECT 1 FROM public.section_courses sc 
    JOIN public.base_courses bc ON bc.id = sc.base_course_id
    WHERE bc.course_id = is_teacher_of_course.course_id AND sc.teacher_id = public.get_auth_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student_of_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    -- Direct enrollment
    SELECT 1 FROM public.course_enrollments ce
    WHERE ce.course_id = is_student_of_course.course_id AND ce.student_id = public.get_auth_user_id()
    
    UNION
    
    -- Enrolled via student_sections (Aulas Virtuales)
    SELECT 1 FROM public.student_sections ss
    JOIN public.section_courses sc ON sc.section_id = ss.section_id
    JOIN public.base_courses bc ON bc.id = sc.base_course_id
    WHERE bc.course_id = is_student_of_course.course_id AND ss.student_id = public.get_auth_user_id()
  );
$$;

NOTIFY pgrst, 'reload schema';
