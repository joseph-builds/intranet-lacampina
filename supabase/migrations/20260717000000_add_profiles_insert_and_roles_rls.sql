-- ─── 1. Create helper functions with row_security = off ──────────────────────

-- Check if teacher_profile_id is a teacher of one of the authenticated parent's children
CREATE OR REPLACE FUNCTION public.is_teacher_of_parents_child(teacher_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    JOIN public.modulos m ON m.id = ce.modulo_id
    JOIN public.courses c ON c.id = m.course_id
    JOIN public.parent_student_relationships psr ON psr.student_id = ce.student_id
    JOIN public.profiles parent ON parent.id = psr.parent_id
    WHERE parent.user_id = auth.uid() AND c.teacher_principal_id = teacher_profile_id
  );
$$;

-- ─── 2. Add INSERT policies for profiles table ──────────────────────────────────

-- Policy to allow admins to insert profiles (needed for upsert during creation)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.has_role('admin'::user_role));

-- Policy to allow users to insert/create their own profile (e.g., self-signup if any)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── 3. Add SELECT policies for profiles table (with recursion fixes) ──────────

-- Allow directivos to view profiles
DROP POLICY IF EXISTS "Directivos can view all profiles" ON public.profiles;
CREATE POLICY "Directivos can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role('directivo'::user_role));

-- Allow parents to view their children's profiles (recursion-safe)
DROP POLICY IF EXISTS "Parents can view their children's profiles" ON public.profiles;
CREATE POLICY "Parents can view their children's profiles" ON public.profiles
  FOR SELECT USING (public.is_parent_of_student(id));

-- Allow parents to view profiles of their children's teachers (recursion-safe)
DROP POLICY IF EXISTS "Parents can view their children's teachers' profiles" ON public.profiles;
CREATE POLICY "Parents can view their children's teachers' profiles" ON public.profiles
  FOR SELECT USING (public.is_teacher_of_parents_child(id));

-- ─── 4. Add SELECT policies for directivo role on other tables ───────────────

-- Allow directivos to view courses
DROP POLICY IF EXISTS "Directivos can view all courses" ON public.courses;
CREATE POLICY "Directivos can view all courses" ON public.courses
  FOR SELECT USING (public.has_role('directivo'::user_role));

-- Allow directivos to view modulos
DROP POLICY IF EXISTS "Directivos can view all modulos" ON public.modulos;
CREATE POLICY "Directivos can view all modulos" ON public.modulos
  FOR SELECT USING (public.has_role('directivo'::user_role));

-- Allow directivos to view course teacher associations
DROP POLICY IF EXISTS "Directivos can view all course_teachers" ON public.course_teachers;
CREATE POLICY "Directivos can view all course_teachers" ON public.course_teachers
  FOR SELECT USING (public.has_role('directivo'::user_role));

-- Allow directivos to view assignments
DROP POLICY IF EXISTS "Directivos can view all assignments" ON public.assignments;
CREATE POLICY "Directivos can view all assignments" ON public.assignments
  FOR SELECT USING (public.has_role('directivo'::user_role));

-- Allow directivos to view assignment submissions
DROP POLICY IF EXISTS "Directivos can view all submissions" ON public.assignment_submissions;
CREATE POLICY "Directivos can view all submissions" ON public.assignment_submissions
  FOR SELECT USING (public.has_role('directivo'::user_role));

-- Allow directivos to view attendance
DROP POLICY IF EXISTS "Directivos can view all attendance" ON public.attendance;
CREATE POLICY "Directivos can view all attendance" ON public.attendance
  FOR SELECT USING (public.has_role('directivo'::user_role));

-- Allow directivos to view exams
DROP POLICY IF EXISTS "Directivos can view all exams" ON public.exams;
CREATE POLICY "Directivos can view all exams" ON public.exams
  FOR SELECT USING (public.has_role('directivo'::user_role));

-- Allow directivos to view student enrollments
DROP POLICY IF EXISTS "Directivos can view all enrollments" ON public.course_enrollments;
CREATE POLICY "Directivos can view all enrollments" ON public.course_enrollments
  FOR SELECT USING (public.has_role('directivo'::user_role));

-- ─── 5. Add SELECT policies for parent role on other tables ─────────────────

-- Allow parents to view their children's courses
DROP POLICY IF EXISTS "Parents can view their children's courses" ON public.courses;
CREATE POLICY "Parents can view their children's courses" ON public.courses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      JOIN public.modulos m ON m.id = ce.modulo_id
      WHERE m.course_id = courses.id
        AND public.is_parent_of_student(ce.student_id)
    )
  );

-- Allow parents to view their children's assignments
DROP POLICY IF EXISTS "Parents can view their children's assignments" ON public.assignments;
CREATE POLICY "Parents can view their children's assignments" ON public.assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      JOIN public.modulos m ON m.id = ce.modulo_id
      WHERE m.course_id = assignments.course_id
        AND public.is_parent_of_student(ce.student_id)
    )
  );

-- Allow parents to view their children's submissions
DROP POLICY IF EXISTS "Parents can view their children's submissions" ON public.assignment_submissions;
CREATE POLICY "Parents can view their children's submissions" ON public.assignment_submissions
  FOR SELECT USING (public.is_parent_of_student(student_id));

-- Allow parents to view their children's exams
DROP POLICY IF EXISTS "Parents can view their children's exams" ON public.exams;
CREATE POLICY "Parents can view their children's exams" ON public.exams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      JOIN public.modulos m ON m.id = ce.modulo_id
      WHERE m.course_id = exams.course_id
        AND public.is_parent_of_student(ce.student_id)
    )
  );

-- ─── 6. Add/Update policies for tutor role ─────────────────────────────────────

-- Allow tutores to manage announcements (adding tutor to existing admin/teacher policy)
DROP POLICY IF EXISTS "Admins and teachers can manage announcements" ON public.announcements;
CREATE POLICY "Admins and teachers can manage announcements" ON public.announcements
  FOR ALL USING (
    public.has_role('admin'::user_role) OR
    public.has_role('teacher'::user_role) OR
    public.has_role('tutor'::user_role)
  );
