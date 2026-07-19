-- Fix the foreign key constraint on quizzes (and clean up orphaned data)!
-- When we tried to add the foreign key to the current "courses" table, it failed
-- because there are old quizzes that belong to courses that were deleted (orphaned data).
-- We must delete those orphaned rows first, then add the constraint.

DO $$
BEGIN
  -- 1. Delete orphaned quizzes (quizzes that point to a course that no longer exists)
  DELETE FROM public.quizzes 
  WHERE modulo_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM public.courses WHERE id = quizzes.modulo_id);

  -- 2. Drop the old constraints if they exist
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_course_id_fkey') THEN
    ALTER TABLE public.quizzes DROP CONSTRAINT quizzes_course_id_fkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_modulo_id_fkey') THEN
    ALTER TABLE public.quizzes DROP CONSTRAINT quizzes_modulo_id_fkey;
  END IF;

  -- 3. Add the correct constraint pointing to the CURRENT courses table
  ALTER TABLE public.quizzes 
    ADD CONSTRAINT quizzes_modulo_id_fkey 
    FOREIGN KEY (modulo_id) REFERENCES public.courses(id) ON DELETE CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';
