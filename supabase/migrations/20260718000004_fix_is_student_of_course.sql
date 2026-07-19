-- Fix is_student_of_course to correctly handle modulo_id/course_id fallback without information_schema issues
CREATE OR REPLACE FUNCTION public.is_student_of_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
DECLARE
  student_exists BOOLEAN := FALSE;
BEGIN
  -- Check if student_sections section assignment exists
  SELECT EXISTS (
    SELECT 1 FROM public.student_sections ss
    JOIN public.section_courses sc ON sc.section_id = ss.section_id
    JOIN public.base_courses bc ON bc.id = sc.base_course_id
    WHERE bc.course_id = is_student_of_course.course_id AND ss.student_id = public.get_auth_user_id()
  ) INTO student_exists;

  IF student_exists THEN
    RETURN TRUE;
  END IF;

  -- Try to query using modulo_id first (fallback for older DB structure)
  BEGIN
    EXECUTE '
      SELECT EXISTS (
        SELECT 1 FROM public.course_enrollments ce
        JOIN public.modulos m ON m.id = ce.modulo_id
        WHERE m.course_id = $1 AND ce.student_id = $2 AND ce.is_active = true
      )
    ' INTO student_exists USING is_student_of_course.course_id, public.get_auth_user_id();
  EXCEPTION WHEN undefined_column THEN
    -- If modulo_id does not exist, try course_id
    EXECUTE '
      SELECT EXISTS (
        SELECT 1 FROM public.course_enrollments ce
        WHERE ce.course_id = $1 AND ce.student_id = $2 AND ce.is_active = true
      )
    ' INTO student_exists USING is_student_of_course.course_id, public.get_auth_user_id();
  END;

  RETURN student_exists;
END;
$$;
