-- SMART RPC to insert into exams, quizzes, course_events regardless of their column names (course_id vs modulo_id)

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
  has_modulo BOOLEAN;
  v_id UUID;
BEGIN
  -- Check which column exams uses
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exams' AND column_name = 'modulo_id'
  ) INTO has_modulo;

  IF has_modulo THEN
    EXECUTE 'INSERT INTO public.exams (modulo_id, title, description, start_time, duration_minutes, is_published) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id' 
    USING p_course_id, p_title, p_description, p_start_time, p_duration_minutes, p_is_published
    INTO v_id;
  ELSE
    EXECUTE 'INSERT INTO public.exams (course_id, title, description, start_time, duration_minutes, is_published) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id' 
    USING p_course_id, p_title, p_description, p_start_time, p_duration_minutes, p_is_published
    INTO v_id;
  END IF;
  
  SELECT row_to_json(e.*) INTO exam_result FROM public.exams e WHERE id = v_id;
  RETURN exam_result;
END;
$$;

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
  has_modulo BOOLEAN;
  v_id UUID;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quizzes' AND column_name = 'modulo_id'
  ) INTO has_modulo;

  IF has_modulo THEN
    EXECUTE 'INSERT INTO public.quizzes (modulo_id, title, description, time_limit_minutes, max_attempts, exam_id, is_published, due_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id' 
    USING p_course_id, p_title, p_description, p_time_limit_minutes, p_max_attempts, p_exam_id, p_is_published, p_due_date
    INTO v_id;
  ELSE
    EXECUTE 'INSERT INTO public.quizzes (course_id, title, description, time_limit_minutes, max_attempts, exam_id, is_published, due_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id' 
    USING p_course_id, p_title, p_description, p_time_limit_minutes, p_max_attempts, p_exam_id, p_is_published, p_due_date
    INTO v_id;
  END IF;

  SELECT row_to_json(q.*) INTO quiz_result FROM public.quizzes q WHERE id = v_id;
  RETURN quiz_result;
END;
$$;

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
  has_modulo BOOLEAN;
  v_id UUID;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'course_events' AND column_name = 'modulo_id'
  ) INTO has_modulo;

  IF has_modulo THEN
    EXECUTE 'INSERT INTO public.course_events (modulo_id, title, description, event_type, start_date, end_date, is_published, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id' 
    USING p_course_id, p_title, p_description, p_event_type, p_start_date, p_end_date, p_is_published, p_created_by
    INTO v_id;
  ELSE
    EXECUTE 'INSERT INTO public.course_events (course_id, title, description, event_type, start_date, end_date, is_published, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id' 
    USING p_course_id, p_title, p_description, p_event_type, p_start_date, p_end_date, p_is_published, p_created_by
    INTO v_id;
  END IF;

  SELECT row_to_json(e.*) INTO event_result FROM public.course_events e WHERE id = v_id;
  RETURN event_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
