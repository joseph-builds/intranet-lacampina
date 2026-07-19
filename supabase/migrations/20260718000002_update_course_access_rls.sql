-- ─── 1. Create helper functions for course access ───────────────────────────

-- Helper function to check if the current user is a teacher of a course
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
    
    -- Section-based teacher assignment
    SELECT 1 FROM public.section_courses sc
    JOIN public.base_courses bc ON bc.id = sc.base_course_id
    WHERE bc.course_id = is_teacher_of_course.course_id AND sc.teacher_id = public.get_auth_user_id()
  );
$$;

-- Helper function to check if the current user is a student of a course (Supports both modulo_id and course_id columns)
CREATE OR REPLACE FUNCTION public.is_student_of_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
DECLARE
  has_modulo_col BOOLEAN;
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

  -- Check if course_enrollments has modulo_id or course_id column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'course_enrollments' AND column_name = 'modulo_id'
  ) INTO has_modulo_col;

  IF has_modulo_col THEN
    EXECUTE '
      SELECT EXISTS (
        SELECT 1 FROM public.course_enrollments ce
        JOIN public.modulos m ON m.id = ce.modulo_id
        WHERE m.course_id = $1 AND ce.student_id = $2 AND ce.is_active = true
      )
    ' INTO student_exists USING is_student_of_course.course_id, public.get_auth_user_id();
  ELSE
    EXECUTE '
      SELECT EXISTS (
        SELECT 1 FROM public.course_enrollments ce
        WHERE ce.course_id = $1 AND ce.student_id = $2 AND ce.is_active = true
      )
    ' INTO student_exists USING is_student_of_course.course_id, public.get_auth_user_id();
  END IF;

  RETURN student_exists;
END;
$$;


-- ─── 2. Update RLS Policies for courses table ───────────────────────────────

-- Teachers
DROP POLICY IF EXISTS "Teachers can view their courses" ON public.courses;
CREATE POLICY "Teachers can view their courses" ON public.courses
  FOR SELECT USING (public.is_teacher_of_course(id));

DROP POLICY IF EXISTS "Teachers can manage their courses" ON public.courses;
CREATE POLICY "Teachers can manage their courses" ON public.courses
  FOR ALL USING (public.is_teacher_of_course(id));

-- Students
DROP POLICY IF EXISTS "Students can view enrolled courses" ON public.courses;
CREATE POLICY "Students can view enrolled courses" ON public.courses
  FOR SELECT USING (public.is_student_of_course(id));


-- ─── 3. Apply Dynamic RLS Policies based on table columns ────────────────────

DO $$
DECLARE
  has_modulo_weekly BOOLEAN;
  has_modulo_assignments BOOLEAN;
  has_modulo_exams BOOLEAN;
  has_modulo_attendance BOOLEAN;
BEGIN
  -- Check column names in tables
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'course_weekly_sections' AND column_name = 'modulo_id') INTO has_modulo_weekly;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'modulo_id') INTO has_modulo_assignments;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'modulo_id') INTO has_modulo_exams;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'modulo_id') INTO has_modulo_attendance;

  -- Create policies for assignments
  DROP POLICY IF EXISTS "Teachers can manage assignments in their courses" ON public.assignments;
  DROP POLICY IF EXISTS "Students can view assignments in their courses" ON public.assignments;
  IF has_modulo_assignments THEN
    CREATE POLICY "Teachers can manage assignments in their courses" ON public.assignments FOR ALL USING (public.is_teacher_of_course(modulo_id));
    CREATE POLICY "Students can view assignments in their courses" ON public.assignments FOR SELECT USING (public.is_student_of_course(modulo_id));
  ELSE
    CREATE POLICY "Teachers can manage assignments in their courses" ON public.assignments FOR ALL USING (public.is_teacher_of_course(course_id));
    CREATE POLICY "Students can view assignments in their courses" ON public.assignments FOR SELECT USING (public.is_student_of_course(course_id));
  END IF;

  -- Create policies for assignment_submissions
  DROP POLICY IF EXISTS "Teachers can view submissions in their courses" ON public.assignment_submissions;
  DROP POLICY IF EXISTS "Teachers can grade submissions in their courses" ON public.assignment_submissions;
  IF has_modulo_assignments THEN
    CREATE POLICY "Teachers can view submissions in their courses" ON public.assignment_submissions FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND public.is_teacher_of_course(a.modulo_id))
    );
    CREATE POLICY "Teachers can grade submissions in their courses" ON public.assignment_submissions FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND public.is_teacher_of_course(a.modulo_id))
    );
  ELSE
    CREATE POLICY "Teachers can view submissions in their courses" ON public.assignment_submissions FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND public.is_teacher_of_course(a.course_id))
    );
    CREATE POLICY "Teachers can grade submissions in their courses" ON public.assignment_submissions FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND public.is_teacher_of_course(a.course_id))
    );
  END IF;

  -- Create policies for exams
  DROP POLICY IF EXISTS "Teachers can manage exams in their courses" ON public.exams;
  DROP POLICY IF EXISTS "Students can view exams in their courses" ON public.exams;
  IF has_modulo_exams THEN
    CREATE POLICY "Teachers can manage exams in their courses" ON public.exams FOR ALL USING (public.is_teacher_of_course(modulo_id));
    CREATE POLICY "Students can view exams in their courses" ON public.exams FOR SELECT USING (is_published = true AND public.is_student_of_course(modulo_id));
  ELSE
    CREATE POLICY "Teachers can manage exams in their courses" ON public.exams FOR ALL USING (public.is_teacher_of_course(course_id));
    CREATE POLICY "Students can view exams in their courses" ON public.exams FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));
  END IF;

  -- Create policies for attendance
  DROP POLICY IF EXISTS "Teachers can view their attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Teachers can manage their attendance" ON public.attendance;
  IF has_modulo_attendance THEN
    CREATE POLICY "Teachers can view their attendance" ON public.attendance FOR SELECT USING (public.is_teacher_of_course(modulo_id));
    CREATE POLICY "Teachers can manage their attendance" ON public.attendance FOR ALL USING (public.is_teacher_of_course(modulo_id));
  ELSE
    CREATE POLICY "Teachers can view their attendance" ON public.attendance FOR SELECT USING (public.is_teacher_of_course(course_id));
    CREATE POLICY "Teachers can manage their attendance" ON public.attendance FOR ALL USING (public.is_teacher_of_course(course_id));
  END IF;

  -- Create policies for course_weekly_sections
  ALTER TABLE public.course_weekly_sections ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view published weekly sections" ON public.course_weekly_sections;
  DROP POLICY IF EXISTS "Teachers can manage weekly sections" ON public.course_weekly_sections;
  IF has_modulo_weekly THEN
    CREATE POLICY "Everyone can view published weekly sections" ON public.course_weekly_sections FOR SELECT TO authenticated USING (
      public.has_role('admin'::user_role) OR public.has_role('directivo'::user_role) OR public.is_teacher_of_course(modulo_id) OR (is_published = true AND public.is_student_of_course(modulo_id))
    );
    CREATE POLICY "Teachers can manage weekly sections" ON public.course_weekly_sections FOR ALL TO authenticated USING (
      public.has_role('admin'::user_role) OR public.is_teacher_of_course(modulo_id)
    );
  ELSE
    CREATE POLICY "Everyone can view published weekly sections" ON public.course_weekly_sections FOR SELECT TO authenticated USING (
      public.has_role('admin'::user_role) OR public.has_role('directivo'::user_role) OR public.is_teacher_of_course(course_id) OR (is_published = true AND public.is_student_of_course(course_id))
    );
    CREATE POLICY "Teachers can manage weekly sections" ON public.course_weekly_sections FOR ALL TO authenticated USING (
      public.has_role('admin'::user_role) OR public.is_teacher_of_course(course_id)
    );
  END IF;

  -- Create policies for course_weekly_resources
  ALTER TABLE public.course_weekly_resources ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Everyone can view published weekly resources" ON public.course_weekly_resources;
  DROP POLICY IF EXISTS "Teachers can manage weekly resources" ON public.course_weekly_resources;
  IF has_modulo_weekly THEN
    CREATE POLICY "Everyone can view published weekly resources" ON public.course_weekly_resources FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.course_weekly_sections s WHERE s.id = course_weekly_resources.section_id AND (public.has_role('admin'::user_role) OR public.has_role('directivo'::user_role) OR public.is_teacher_of_course(s.modulo_id) OR (s.is_published = true AND course_weekly_resources.is_published = true AND public.is_student_of_course(s.modulo_id))))
    );
    CREATE POLICY "Teachers can manage weekly resources" ON public.course_weekly_resources FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM public.course_weekly_sections s WHERE s.id = course_weekly_resources.section_id AND (public.has_role('admin'::user_role) OR public.is_teacher_of_course(s.modulo_id)))
    );
  ELSE
    CREATE POLICY "Everyone can view published weekly resources" ON public.course_weekly_resources FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.course_weekly_sections s WHERE s.id = course_weekly_resources.section_id AND (public.has_role('admin'::user_role) OR public.has_role('directivo'::user_role) OR public.is_teacher_of_course(s.course_id) OR (s.is_published = true AND course_weekly_resources.is_published = true AND public.is_student_of_course(s.course_id))))
    );
    CREATE POLICY "Teachers can manage weekly resources" ON public.course_weekly_resources FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM public.course_weekly_sections s WHERE s.id = course_weekly_resources.section_id AND (public.has_role('admin'::user_role) OR public.is_teacher_of_course(s.course_id)))
    );
  END IF;

END $$;
