-- ─── 1. Create helper functions with row_security = off ──────────────────────

-- Check if a student shares at least one course/modulo with the current authenticated user
CREATE OR REPLACE FUNCTION public.share_course_with_student(other_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments ce1
    JOIN public.course_enrollments ce2 ON ce2.modulo_id = ce1.modulo_id
    WHERE ce1.student_id = public.get_auth_user_id() 
      AND ce2.student_id = other_student_id
      AND ce1.is_active = true 
      AND ce2.is_active = true
  );
$$;

-- Check if the current authenticated user is enrolled in a specific course/modulo
CREATE OR REPLACE FUNCTION public.is_enrolled_in_modulo(modulo_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments
    WHERE modulo_id = $1 
      AND student_id = public.get_auth_user_id() 
      AND is_active = true
  );
$$;

-- ─── 2. Add RLS Policies for Classmates (profiles table) ──────────────────────

-- Allow students to view profiles of their classmates
DROP POLICY IF EXISTS "Students can view classmates' profiles" ON public.profiles;
CREATE POLICY "Students can view classmates' profiles" ON public.profiles
  FOR SELECT USING (
    public.share_course_with_student(id)
  );

-- ─── 3. Add RLS Policies for Classmates (course_enrollments table) ────────────

-- Allow students to view other enrollments in the same course/modulo
DROP POLICY IF EXISTS "Students can view classmates' enrollments" ON public.course_enrollments;
CREATE POLICY "Students can view classmates' enrollments" ON public.course_enrollments
  FOR SELECT USING (
    public.is_enrolled_in_modulo(modulo_id)
  );
