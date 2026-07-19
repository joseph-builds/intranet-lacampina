-- ─── 4. Fix Foreign Keys referencing courses_old ──────────────────────────────

DO $$
DECLARE
  rec RECORD;
  table_names TEXT[] := ARRAY['attendance', 'assignments', 'exams', 'course_weekly_sections', 'course_enrollments', 'course_teachers'];
  t_name TEXT;
  fk_name TEXT;
  col_name TEXT;
BEGIN
  -- Loop through each table that might have a foreign key to courses_old
  FOREACH t_name IN ARRAY table_names
  LOOP
    -- Find the foreign key constraint referencing courses_old
    FOR rec IN (
      SELECT
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = t_name
        AND ccu.table_name = 'courses_old'
    )
    LOOP
      fk_name := rec.constraint_name;
      col_name := rec.column_name;
      
      -- Drop the old constraint
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t_name, fk_name);
      
      -- Create the new constraint pointing to courses
      -- We name it tablename_columnname_fkey to avoid conflicts
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I_%I_fkey FOREIGN KEY (%I) REFERENCES public.courses(id) ON DELETE CASCADE', 
        t_name, t_name, col_name, col_name);
        
      RAISE NOTICE 'Fixed foreign key for table %: % -> courses', t_name, fk_name;
    END LOOP;
  END LOOP;
END $$;
