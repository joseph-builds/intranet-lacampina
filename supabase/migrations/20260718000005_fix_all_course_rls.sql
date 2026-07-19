-- ─── Fix RLS Policies for course-related tables ───────────────────────────────
-- This migration replaces old verbose RLS policies that referenced 'ce.course_id'
-- with the new robust 'is_teacher_of_course' and 'is_student_of_course' helper functions.

-- 1. exams
DROP POLICY IF EXISTS "Students can view exams in their courses" ON public.exams;
CREATE POLICY "Students can view exams in their courses" ON public.exams
  FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));

DROP POLICY IF EXISTS "Teachers can manage exams in their courses" ON public.exams;
CREATE POLICY "Teachers can manage exams in their courses" ON public.exams
  FOR ALL USING (public.is_teacher_of_course(course_id));

-- 2. quizzes
DROP POLICY IF EXISTS "Students can view quizzes in their courses" ON public.quizzes;
CREATE POLICY "Students can view quizzes in their courses" ON public.quizzes
  FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));

DROP POLICY IF EXISTS "Teachers can manage quizzes in their courses" ON public.quizzes;
CREATE POLICY "Teachers can manage quizzes in their courses" ON public.quizzes
  FOR ALL USING (public.is_teacher_of_course(course_id));

-- 3. assignments
DROP POLICY IF EXISTS "Students can view assignments in their courses" ON public.assignments;
CREATE POLICY "Students can view assignments in their courses" ON public.assignments
  FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));

DROP POLICY IF EXISTS "Teachers can manage assignments in their courses" ON public.assignments;
CREATE POLICY "Teachers can manage assignments in their courses" ON public.assignments
  FOR ALL USING (public.is_teacher_of_course(course_id));

-- 4. attendance
DROP POLICY IF EXISTS "Teachers can manage attendance in their courses" ON public.attendance;
CREATE POLICY "Teachers can manage attendance in their courses" ON public.attendance
  FOR ALL USING (public.is_teacher_of_course(course_id));

DROP POLICY IF EXISTS "Students can view their own attendance" ON public.attendance;
CREATE POLICY "Students can view their own attendance" ON public.attendance
  FOR SELECT USING (
    student_id = public.get_auth_user_id() 
    AND public.is_student_of_course(course_id)
  );

-- 5. course_events
DROP POLICY IF EXISTS "Students can view course events" ON public.course_events;
CREATE POLICY "Students can view course events" ON public.course_events
  FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));
-- 7. assignment_submissions
DROP POLICY IF EXISTS "Students can view their own submissions" ON public.assignment_submissions;
CREATE POLICY "Students can view their own submissions" ON public.assignment_submissions
  FOR SELECT USING (student_id = public.get_auth_user_id());

DROP POLICY IF EXISTS "Teachers can grade submissions in their courses" ON public.assignment_submissions;
CREATE POLICY "Teachers can grade submissions in their courses" ON public.assignment_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id AND public.is_teacher_of_course(a.course_id)
    )
  );

-- 8. quiz_submissions
DROP POLICY IF EXISTS "Students can view their own quiz submissions" ON public.quiz_submissions;
CREATE POLICY "Students can view their own quiz submissions" ON public.quiz_submissions
  FOR SELECT USING (student_id = public.get_auth_user_id());

DROP POLICY IF EXISTS "Teachers can view all quiz submissions" ON public.quiz_submissions;
CREATE POLICY "Teachers can view all quiz submissions" ON public.quiz_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_submissions.quiz_id AND public.is_teacher_of_course(q.course_id)
    )
  );

DROP POLICY IF EXISTS "Teachers can manage course events" ON public.course_events;
CREATE POLICY "Teachers can manage course events" ON public.course_events
  FOR ALL USING (public.is_teacher_of_course(course_id));

-- 6. course_weekly_sections
DROP POLICY IF EXISTS "Students can view published sections" ON public.course_weekly_sections;
CREATE POLICY "Students can view published sections" ON public.course_weekly_sections
  FOR SELECT USING (is_published = true AND public.is_student_of_course(course_id));

DROP POLICY IF EXISTS "Teachers can manage sections" ON public.course_weekly_sections;
CREATE POLICY "Teachers can manage sections" ON public.course_weekly_sections
  FOR ALL USING (public.is_teacher_of_course(course_id));
