-- Fix RLS policies to use public.get_auth_user_id() instead of auth.uid()

DROP POLICY IF EXISTS "Students read their grade records" ON public.grade_records;
CREATE POLICY "Students read their grade records" ON public.grade_records FOR SELECT USING (
  student_id = public.get_auth_user_id()
);

DROP POLICY IF EXISTS "Students read their consolidations" ON public.grade_consolidations;
CREATE POLICY "Students read their consolidations" ON public.grade_consolidations FOR SELECT USING (
  student_id = public.get_auth_user_id()
);

NOTIFY pgrst, 'reload schema';
