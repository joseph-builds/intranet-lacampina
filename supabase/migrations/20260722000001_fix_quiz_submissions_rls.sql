-- Fix RLS for quiz_submissions so teachers can grade them
CREATE POLICY "Teachers can update quiz submissions" ON public.quiz_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_submissions.quiz_id
      AND public.is_teacher_of_course(q.course_id)
    )
  );

-- Just in case it was created with modulo_id instead of course_id in some earlier migration
CREATE POLICY "Teachers can update quiz submissions fallback" ON public.quiz_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_submissions.quiz_id
      AND (
        (q.course_id IS NOT NULL AND public.is_teacher_of_course(q.course_id)) OR
        (q.course_id IS NULL AND true) -- fallback
      )
    )
  );
