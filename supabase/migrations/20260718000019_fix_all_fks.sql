-- Fix ALL foreign keys that might still be pointing to courses_old!
-- We must delete orphaned data first, then apply the foreign key pointing to public.courses(id).

DO $$ 
DECLARE 
  t_name TEXT;
  fk_name TEXT;
  tables_to_check TEXT[] := ARRAY[
    'exams', 
    'assignments', 
    'attendance', 
    'course_events', 
    'course_weekly_sections',
    'course_forum_topics'
  ];
BEGIN 
  FOREACH t_name IN ARRAY tables_to_check 
  LOOP
    -- 1. Delete orphaned rows
    EXECUTE format('DELETE FROM public.%I WHERE modulo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.courses WHERE id = %I.modulo_id)', t_name, t_name);

    -- 2. Drop old constraints
    fk_name := t_name || '_course_id_fkey';
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk_name) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t_name, fk_name);
    END IF;

    fk_name := t_name || '_modulo_id_fkey';
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk_name) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t_name, fk_name);
    END IF;

    -- 3. Add the correct constraint pointing to the CURRENT courses table
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (modulo_id) REFERENCES public.courses(id) ON DELETE CASCADE', t_name, fk_name);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
