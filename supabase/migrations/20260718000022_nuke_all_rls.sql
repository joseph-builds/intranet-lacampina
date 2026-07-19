DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public' 
          AND tablename IN ('course_enrollments', 'courses', 'modulos', 'attendance')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END
$$;

-- After dropping EVERYTHING, recreate simple public read policies
CREATE POLICY "Public read course_enrollments" ON public.course_enrollments FOR SELECT USING (true);
CREATE POLICY "Public read courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Public read modulos" ON public.modulos FOR SELECT USING (true);
CREATE POLICY "Public read attendance" ON public.attendance FOR SELECT USING (true);

-- Ensure pgrst schema is refreshed
NOTIFY pgrst, 'reload schema';
