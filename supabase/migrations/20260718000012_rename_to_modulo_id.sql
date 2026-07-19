-- Let's finally fix the root cause!
-- The frontend code and types.ts expect the column to be named 'modulo_id',
-- but the database still has it named 'course_id'.
-- This script renames 'course_id' to 'modulo_id' in all relevant tables.

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
    -- Check if course_id exists and modulo_id does not exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = t_name AND column_name = 'course_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = t_name AND column_name = 'modulo_id'
    ) THEN 
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN course_id TO modulo_id', t_name);
    END IF;
  END LOOP;
END $$;

-- Now that the columns are actually 'modulo_id', we MUST drop the old policies that used 'course_id'
-- (which are now broken since we renamed the column, wait, PostgreSQL automatically renames columns inside views/policies if they are bound! But just in case, let's let PostgreSQL handle the policy update, or we can just reload the schema).

NOTIFY pgrst, 'reload schema';
