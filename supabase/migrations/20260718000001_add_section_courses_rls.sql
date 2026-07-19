-- ─── 1. Enable RLS and add policies for section_courses table ─────────────────────

ALTER TABLE public.section_courses ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can do everything on section_courses" ON public.section_courses;
CREATE POLICY "Admins can do everything on section_courses" ON public.section_courses
  FOR ALL TO authenticated USING (public.has_role('admin'::user_role));

-- Directivos can view all
DROP POLICY IF EXISTS "Directivos can view all section_courses" ON public.section_courses;
CREATE POLICY "Directivos can view all section_courses" ON public.section_courses
  FOR SELECT TO authenticated USING (public.has_role('directivo'::user_role));

-- Teachers can view their assigned section_courses
DROP POLICY IF EXISTS "Teachers can view their section_courses" ON public.section_courses;
CREATE POLICY "Teachers can view their section_courses" ON public.section_courses
  FOR SELECT TO authenticated USING (
    teacher_id = public.get_auth_user_id()
  );

-- Students can view section_courses in their assigned sections
DROP POLICY IF EXISTS "Students can view their section_courses" ON public.section_courses;
CREATE POLICY "Students can view their section_courses" ON public.section_courses
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.student_sections ss
      WHERE ss.section_id = section_courses.section_id 
        AND ss.student_id = public.get_auth_user_id()
    )
  );

-- Tutors can view section_courses in their assigned sections
DROP POLICY IF EXISTS "Tutors can view their section_courses" ON public.section_courses;
CREATE POLICY "Tutors can view their section_courses" ON public.section_courses
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.id = section_courses.section_id 
        AND s.tutor_id = public.get_auth_user_id()
    )
  );


-- ─── 2. Enable RLS and add policies for base_courses table ─────────────────────────

ALTER TABLE public.base_courses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view base_courses (since it is a catalog of courses)
DROP POLICY IF EXISTS "Authenticated users can view base_courses" ON public.base_courses;
CREATE POLICY "Authenticated users can view base_courses" ON public.base_courses
  FOR SELECT TO authenticated USING (true);

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage base_courses" ON public.base_courses;
CREATE POLICY "Admins can manage base_courses" ON public.base_courses
  FOR ALL TO authenticated USING (public.has_role('admin'::user_role));
