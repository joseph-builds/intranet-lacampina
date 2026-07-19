-- Drop and recreate RLS policies for tables that actually use 'modulo_id' instead of 'course_id'.

-- ─── assignments ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Students can view published assignments" ON public.assignments;

CREATE POLICY "Teachers can manage assignments" ON public.assignments
  FOR ALL USING (public.is_teacher_of_course(modulo_id));
CREATE POLICY "Students can view published assignments" ON public.assignments
  FOR SELECT USING (is_published = true AND public.is_student_of_course(modulo_id));

-- ─── assignment_submissions ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can view submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Teachers can grade submissions" ON public.assignment_submissions;

CREATE POLICY "Teachers can view submissions" ON public.assignment_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND public.is_teacher_of_course(a.modulo_id))
  );
CREATE POLICY "Teachers can grade submissions" ON public.assignment_submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND public.is_teacher_of_course(a.modulo_id))
  );

-- ─── attendance ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can manage attendance" ON public.attendance;

CREATE POLICY "Teachers can manage attendance" ON public.attendance
  FOR ALL USING (public.is_teacher_of_course(modulo_id));

-- ─── course_events ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can manage course events" ON public.course_events;
DROP POLICY IF EXISTS "Students can view published events" ON public.course_events;

CREATE POLICY "Teachers can manage course events" ON public.course_events
  FOR ALL USING (public.is_teacher_of_course(modulo_id));
CREATE POLICY "Students can view published events" ON public.course_events
  FOR SELECT USING (is_published = true AND public.is_student_of_course(modulo_id));

-- ─── course_weekly_sections ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can manage weekly sections" ON public.course_weekly_sections;
DROP POLICY IF EXISTS "Students can view published sections" ON public.course_weekly_sections;

CREATE POLICY "Teachers can manage weekly sections" ON public.course_weekly_sections
  FOR ALL TO authenticated USING (public.has_role('admin'::user_role) OR public.is_teacher_of_course(modulo_id));
CREATE POLICY "Students can view published sections" ON public.course_weekly_sections
  FOR SELECT TO authenticated USING (
    public.has_role('admin'::user_role) OR public.has_role('directivo'::user_role) 
    OR public.is_teacher_of_course(modulo_id) 
    OR (is_published = true AND public.is_student_of_course(modulo_id))
  );

-- ─── course_weekly_resources ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can manage weekly resources" ON public.course_weekly_resources;
DROP POLICY IF EXISTS "Students can view published resources" ON public.course_weekly_resources;

CREATE POLICY "Teachers can manage weekly resources" ON public.course_weekly_resources
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.course_weekly_sections s WHERE s.id = course_weekly_resources.section_id AND (public.has_role('admin'::user_role) OR public.is_teacher_of_course(s.modulo_id)))
  );
CREATE POLICY "Students can view published resources" ON public.course_weekly_resources
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.course_weekly_sections s WHERE s.id = course_weekly_resources.section_id AND (public.has_role('admin'::user_role) OR public.has_role('directivo'::user_role) OR public.is_teacher_of_course(s.modulo_id) OR (s.is_published = true AND course_weekly_resources.is_published = true AND public.is_student_of_course(s.modulo_id))))
  );

-- ─── exams ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can manage exams" ON public.exams;
DROP POLICY IF EXISTS "Students can view published exams" ON public.exams;

CREATE POLICY "Teachers can manage exams" ON public.exams
  FOR ALL USING (public.is_teacher_of_course(modulo_id));
CREATE POLICY "Students can view published exams" ON public.exams
  FOR SELECT USING (is_published = true AND public.is_student_of_course(modulo_id));

-- ─── quizzes ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can manage quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Students can view published quizzes" ON public.quizzes;

CREATE POLICY "Teachers can manage quizzes" ON public.quizzes
  FOR ALL USING (public.is_teacher_of_course(modulo_id));
CREATE POLICY "Students can view published quizzes" ON public.quizzes
  FOR SELECT USING (is_published = true AND public.is_student_of_course(modulo_id));

-- ─── quiz_submissions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can view quiz submissions" ON public.quiz_submissions;

CREATE POLICY "Teachers can view quiz submissions" ON public.quiz_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_submissions.quiz_id AND public.is_teacher_of_course(q.modulo_id))
  );

NOTIFY pgrst, 'reload schema';
