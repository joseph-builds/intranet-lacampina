-- ─── 1. Create helper function for section-based classmates ───────────────────

-- Check if a student shares at least one section (classroom) with the current authenticated user
CREATE OR REPLACE FUNCTION public.share_section_with_student(other_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_sections ss1
    JOIN public.student_sections ss2 ON ss2.section_id = ss1.section_id
    WHERE ss1.student_id = public.get_auth_user_id() 
      AND ss2.student_id = other_student_id
      AND ss1.academic_year = ss2.academic_year
  );
$$;


-- ─── 2. Update RLS Policies for Classmates (profiles table) ─────────────────────────

-- Allow students to view profiles of their course classmates AND section classmates
DROP POLICY IF EXISTS "Students can view classmates' profiles" ON public.profiles;
CREATE POLICY "Students can view classmates' profiles" ON public.profiles
  FOR SELECT USING (
    public.share_course_with_student(id) OR public.share_section_with_student(id)
  );


-- ─── 3. Enable RLS and add policies for student_sections table ─────────────────────

ALTER TABLE public.student_sections ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can do everything on student_sections" ON public.student_sections;
CREATE POLICY "Admins can do everything on student_sections" ON public.student_sections
  FOR ALL TO authenticated USING (public.has_role('admin'::user_role));

-- Directivos can view all
DROP POLICY IF EXISTS "Directivos can view all student_sections" ON public.student_sections;
CREATE POLICY "Directivos can view all student_sections" ON public.student_sections
  FOR SELECT TO authenticated USING (public.has_role('directivo'::user_role));

-- Teachers can view all
DROP POLICY IF EXISTS "Teachers can view all student_sections" ON public.student_sections;
CREATE POLICY "Teachers can view all student_sections" ON public.student_sections
  FOR SELECT TO authenticated USING (public.has_role('teacher'::user_role));

-- Tutors can view all
DROP POLICY IF EXISTS "Tutors can view all student_sections" ON public.student_sections;
CREATE POLICY "Tutors can view all student_sections" ON public.student_sections
  FOR SELECT TO authenticated USING (public.has_role('tutor'::user_role));

-- Students can view themselves and classmates in the same section
DROP POLICY IF EXISTS "Students can view classmates student_sections" ON public.student_sections;
CREATE POLICY "Students can view classmates student_sections" ON public.student_sections
  FOR SELECT TO authenticated USING (
    student_id = public.get_auth_role_id_fallback() OR
    student_id = public.get_auth_user_id() OR
    public.share_section_with_student(student_id)
  );


-- ─── 4. Enable RLS and add policies for sections table ─────────────────────────────

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can do everything on sections" ON public.sections;
CREATE POLICY "Admins can do everything on sections" ON public.sections
  FOR ALL TO authenticated USING (public.has_role('admin'::user_role));

-- Directivos can view all
DROP POLICY IF EXISTS "Directivos can view all sections" ON public.sections;
CREATE POLICY "Directivos can view all sections" ON public.sections
  FOR SELECT TO authenticated USING (public.has_role('directivo'::user_role));

-- Teachers can view all
DROP POLICY IF EXISTS "Teachers can view all sections" ON public.sections;
CREATE POLICY "Teachers can view all sections" ON public.sections
  FOR SELECT TO authenticated USING (public.has_role('teacher'::user_role));

-- Tutors can view all
DROP POLICY IF EXISTS "Tutors can view all sections" ON public.sections;
CREATE POLICY "Tutors can view all sections" ON public.sections
  FOR SELECT TO authenticated USING (public.has_role('tutor'::user_role));

-- Students can view sections they are assigned to
DROP POLICY IF EXISTS "Students can view their assigned sections" ON public.sections;
CREATE POLICY "Students can view their assigned sections" ON public.sections
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.student_sections ss
      WHERE ss.section_id = sections.id 
        AND ss.student_id = public.get_auth_user_id()
    )
  );
