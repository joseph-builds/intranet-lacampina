-- FIX QUIZ QUESTIONS RLS
-- Earlier we dropped policies for quiz_questions but forgot to recreate them!
-- This is why creating exams failed (it couldn't save the questions).

CREATE POLICY "Teachers can manage quiz questions" ON public.quiz_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_questions.quiz_id AND public.is_teacher_of_course(q.course_id))
  );

CREATE POLICY "Students can view quiz questions" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_questions.quiz_id AND public.is_student_of_course(q.course_id))
  );

NOTIFY pgrst, 'reload schema';
