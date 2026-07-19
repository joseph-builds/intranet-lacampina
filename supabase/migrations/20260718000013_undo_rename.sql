-- UNDO THE PREVIOUS SCRIPT
-- This renames 'modulo_id' back to 'course_id' for the tables that were just modified.

DO $$ 
DECLARE 
  t_name TEXT;
  tables_to_check TEXT[] := ARRAY[
    'exams', 
    'quizzes', 
    'assignments', 
    'attendance', 
    'course_events', 
    'course_weekly_sections',
    'course_forum_topics',
    'course_resources'
  ];
BEGIN 
  FOREACH t_name IN ARRAY tables_to_check 
  LOOP
    -- Check if modulo_id exists and course_id does not exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = t_name AND column_name = 'modulo_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = t_name AND column_name = 'course_id'
    ) THEN 
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN modulo_id TO course_id', t_name);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
