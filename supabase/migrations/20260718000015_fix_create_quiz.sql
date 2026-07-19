-- Fix create_quiz to remove exam_id since the quizzes table doesn't have it!
-- The frontend links quizzes and exams by title.

CREATE OR REPLACE FUNCTION public.create_quiz(
  p_course_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_time_limit_minutes INTEGER DEFAULT 60,
  p_max_attempts INTEGER DEFAULT 1,
  p_is_published BOOLEAN DEFAULT false,
  p_due_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  quiz_result JSON;
  has_modulo BOOLEAN;
  v_id UUID;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quizzes' AND column_name = 'modulo_id'
  ) INTO has_modulo;

  IF has_modulo THEN
    EXECUTE 'INSERT INTO public.quizzes (modulo_id, title, description, time_limit_minutes, max_attempts, is_published, due_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id' 
    USING p_course_id, p_title, p_description, p_time_limit_minutes, p_max_attempts, p_is_published, p_due_date
    INTO v_id;
  ELSE
    EXECUTE 'INSERT INTO public.quizzes (course_id, title, description, time_limit_minutes, max_attempts, is_published, due_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id' 
    USING p_course_id, p_title, p_description, p_time_limit_minutes, p_max_attempts, p_is_published, p_due_date
    INTO v_id;
  END IF;

  SELECT row_to_json(q.*) INTO quiz_result FROM public.quizzes q WHERE id = v_id;
  RETURN quiz_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
