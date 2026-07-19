-- ═══════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC + FIX: Find and destroy ALL broken policies across ALL tables
-- Run this FIRST to see what's broken, then it will fix everything
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 1: DIAGNOSTIC - Show ALL policies that mention 'ce.course_id' anywhere
-- Run this SELECT first and check the output before continuing
SELECT schemaname, tablename, policyname, 
       LEFT(qual::text, 200) as policy_condition
FROM pg_policies 
WHERE qual::text LIKE '%ce.course_id%' 
   OR with_check::text LIKE '%ce.course_id%'
   OR qual::text LIKE '%course_enrollments%course_id%'
   OR with_check::text LIKE '%course_enrollments%course_id%';

-- Step 2: NUCLEAR DROP - Drop ALL policies on ALL course-related tables
DO $$
DECLARE
    pol RECORD;
    tables TEXT[] := ARRAY[
        'exams', 'quizzes', 'assignments', 'assignment_submissions',
        'attendance', 'course_events', 'course_weekly_sections', 
        'course_weekly_resources', 'courses', 'course_enrollments',
        'course_teachers', 'quiz_submissions', 'quiz_questions'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        FOR pol IN
            SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
            RAISE NOTICE 'Dropped policy "%" on table "%"', pol.policyname, t;
        END LOOP;
    END LOOP;
END
$$;

-- Step 3: Recreate ALL policies cleanly

-- ─── courses ─────────────────────────────────────────────────────────────────
CREATE POLICY "Teachers can view their courses" ON public.courses
  FOR SELECT USING (public.is_teacher_of_course(id));
CREATE POLICY "Teachers can manage their courses" ON public.courses
  FOR ALL USING (public.is_teacher_of_course(id));
CREATE POLICY "Students can view enrolled courses" ON public.courses
  FOR SELECT USING (public.is_student_of_course(id));
CREATE POLICY "Admins can view all courses" ON public.courses
  FOR SELECT USING (public.has_role('admin'::user_role) OR public.has_role('directivo'::user_role));

-- ─── course_enrollments ──────────────────────────────────────────────────────
CREATE POLICY "Students can view their enrollments" ON public.course_enrollments
  FOR SELECT USING (student_id = public.get_auth_user_id());
CREATE POLICY "Teachers can view enrollments" ON public.course_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.modulos m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = course_enrollments.modulo_id
        AND public.is_teacher_of_course(c.id)
    )
  );

-- ─── course_teachers ─────────────────────────────────────────────────────────
CREATE POLICY "Teachers can view course teachers" ON public.course_teachers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage course teachers" ON public.course_teachers
  FOR ALL USING (public.has_role('admin'::user_role));

-- ─── exams ───────────────────────────────────────────────────────────────────
CREATE POLICY "Teachers can manage exams" ON public.exams
  FOR ALL USING (public.is_teacher_of_course(course_id));
CREATE POLICY "Students can view published exams" ON public.exams
  FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));

-- ─── quizzes ─────────────────────────────────────────────────────────────────
CREATE POLICY "Teachers can manage quizzes" ON public.quizzes
  FOR ALL USING (public.is_teacher_of_course(course_id));
CREATE POLICY "Students can view published quizzes" ON public.quizzes
  FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));

-- ─── quiz_submissions ────────────────────────────────────────────────────────
CREATE POLICY "Students can view own quiz submissions" ON public.quiz_submissions
  FOR SELECT USING (student_id = public.get_auth_user_id());
CREATE POLICY "Students can create quiz submissions" ON public.quiz_submissions
  FOR INSERT WITH CHECK (student_id = public.get_auth_user_id());
CREATE POLICY "Teachers can view quiz submissions" ON public.quiz_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_submissions.quiz_id AND public.is_teacher_of_course(q.course_id))
  );

-- ─── assignments ─────────────────────────────────────────────────────────────
CREATE POLICY "Teachers can manage assignments" ON public.assignments
  FOR ALL USING (public.is_teacher_of_course(course_id));
CREATE POLICY "Students can view published assignments" ON public.assignments
  FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));

-- ─── assignment_submissions ──────────────────────────────────────────────────
CREATE POLICY "Students can view own submissions" ON public.assignment_submissions
  FOR SELECT USING (student_id = public.get_auth_user_id());
CREATE POLICY "Students can create submissions" ON public.assignment_submissions
  FOR INSERT WITH CHECK (student_id = public.get_auth_user_id());
CREATE POLICY "Students can update own submissions" ON public.assignment_submissions
  FOR UPDATE USING (student_id = public.get_auth_user_id());
CREATE POLICY "Teachers can view submissions" ON public.assignment_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND public.is_teacher_of_course(a.course_id))
  );
CREATE POLICY "Teachers can grade submissions" ON public.assignment_submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND public.is_teacher_of_course(a.course_id))
  );

-- ─── attendance ──────────────────────────────────────────────────────────────
CREATE POLICY "Teachers can manage attendance" ON public.attendance
  FOR ALL USING (public.is_teacher_of_course(course_id));
CREATE POLICY "Students can view own attendance" ON public.attendance
  FOR SELECT USING (student_id = public.get_auth_user_id());

-- ─── course_events ───────────────────────────────────────────────────────────
CREATE POLICY "Teachers can manage course events" ON public.course_events
  FOR ALL USING (public.is_teacher_of_course(course_id));
CREATE POLICY "Students can view published events" ON public.course_events
  FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));

-- ─── course_weekly_sections ──────────────────────────────────────────────────
CREATE POLICY "Teachers can manage weekly sections" ON public.course_weekly_sections
  FOR ALL TO authenticated USING (public.has_role('admin'::user_role) OR public.is_teacher_of_course(course_id));
CREATE POLICY "Students can view published sections" ON public.course_weekly_sections
  FOR SELECT TO authenticated USING (
    public.has_role('admin'::user_role) OR public.has_role('directivo'::user_role) 
    OR public.is_teacher_of_course(course_id) 
    OR (is_published = true AND public.is_student_of_course(course_id))
  );

-- ─── course_weekly_resources ─────────────────────────────────────────────────
CREATE POLICY "Teachers can manage weekly resources" ON public.course_weekly_resources
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.course_weekly_sections s WHERE s.id = course_weekly_resources.section_id AND (public.has_role('admin'::user_role) OR public.is_teacher_of_course(s.course_id)))
  );
CREATE POLICY "Students can view published resources" ON public.course_weekly_resources
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.course_weekly_sections s WHERE s.id = course_weekly_resources.section_id AND (public.has_role('admin'::user_role) OR public.has_role('directivo'::user_role) OR public.is_teacher_of_course(s.course_id) OR (s.is_published = true AND course_weekly_resources.is_published = true AND public.is_student_of_course(s.course_id))))
  );

-- Step 4: Verify - show all policies that still reference ce.course_id (should be empty!)
SELECT schemaname, tablename, policyname
FROM pg_policies 
WHERE qual::text LIKE '%ce.course_id%' 
   OR with_check::text LIKE '%ce.course_id%';
