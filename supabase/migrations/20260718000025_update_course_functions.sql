-- Update is_teacher_of_course to check section_courses
CREATE OR REPLACE FUNCTION public.is_teacher_of_course(course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM courses c WHERE c.id = is_teacher_of_course.course_id AND c.teacher_principal_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM course_teachers ct WHERE ct.course_id = is_teacher_of_course.course_id AND ct.teacher_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM section_courses sc 
    JOIN base_courses bc ON bc.id = sc.base_course_id
    WHERE bc.course_id = is_teacher_of_course.course_id AND sc.teacher_id = auth.uid()
  );
END;
$$;

-- Update is_student_of_course to check student_sections
CREATE OR REPLACE FUNCTION public.is_student_of_course(course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM course_enrollments ce WHERE ce.course_id = is_student_of_course.course_id AND ce.student_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM student_sections ss
    JOIN section_courses sc ON sc.section_id = ss.section_id
    JOIN base_courses bc ON bc.id = sc.base_course_id
    WHERE bc.course_id = is_student_of_course.course_id AND ss.student_id = auth.uid()
  );
END;
$$;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
