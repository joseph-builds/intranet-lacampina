-- Create a SECURITY DEFINER function to insert exams bypassing RLS
CREATE OR REPLACE FUNCTION public.create_exam(
  p_course_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NOW(),
  p_duration_minutes INTEGER DEFAULT 60,
  p_is_published BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  exam_result JSON;
BEGIN
  INSERT INTO public.exams (modulo_id, title, description, start_time, duration_minutes, is_published)
  VALUES (p_course_id, p_title, p_description, p_start_time, p_duration_minutes, p_is_published)
  RETURNING row_to_json(exams.*) INTO exam_result;
  
  RETURN exam_result;
END;
$$;

-- Also for quizzes
CREATE OR REPLACE FUNCTION public.create_quiz(
  p_course_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_time_limit_minutes INTEGER DEFAULT 60,
  p_max_attempts INTEGER DEFAULT 1,
  p_exam_id UUID DEFAULT NULL,
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
BEGIN
  INSERT INTO public.quizzes (modulo_id, title, description, time_limit_minutes, max_attempts, exam_id, is_published, due_date)
  VALUES (p_course_id, p_title, p_description, p_time_limit_minutes, p_max_attempts, p_exam_id, p_is_published, p_due_date)
  RETURNING row_to_json(quizzes.*) INTO quiz_result;
  
  RETURN quiz_result;
END;
$$;

-- Also for course_events
CREATE OR REPLACE FUNCTION public.create_course_event(
  p_course_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT 'exam',
  p_start_date TIMESTAMPTZ DEFAULT NOW(),
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_is_published BOOLEAN DEFAULT false,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  event_result JSON;
BEGIN
  -- course_events might also use modulo_id. If this throws an error, we will adjust it.
  INSERT INTO public.course_events (modulo_id, title, description, event_type, start_date, end_date, is_published, created_by)
  VALUES (p_course_id, p_title, p_description, p_event_type, p_start_date, p_end_date, p_is_published, p_created_by)
  RETURNING row_to_json(course_events.*) INTO event_result;
  
  RETURN event_result;
END;
$$;
