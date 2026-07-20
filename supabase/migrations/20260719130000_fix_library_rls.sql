-- Fix infinite recursion in library_resources RLS policies

-- Drop the old policies
DROP POLICY IF EXISTS "Teachers and Admins can view all resources" ON public.library_resources;
DROP POLICY IF EXISTS "Admins can manage any resource" ON public.library_resources;
DROP POLICY IF EXISTS "Teachers can insert resources" ON public.library_resources;
DROP POLICY IF EXISTS "Teachers can update/delete own resources" ON public.library_resources;
DROP POLICY IF EXISTS "Teachers can delete own resources" ON public.library_resources;

-- Recreate policies using the secure helper functions

-- Policy: Teachers and Admins can view ALL resources (even inactive ones if they need to)
CREATE POLICY "Teachers and Admins can view all resources"
ON public.library_resources
FOR SELECT
USING (
    public.has_role('admin'::user_role) OR public.has_role('teacher'::user_role)
);

-- Policy: Admins can insert/update/delete any resource
CREATE POLICY "Admins can manage any resource" 
ON public.library_resources 
FOR ALL 
USING (
    public.has_role('admin'::user_role)
);

-- Policy: Teachers can insert their own resources
CREATE POLICY "Teachers can insert resources" 
ON public.library_resources 
FOR INSERT 
WITH CHECK (
    public.has_role('teacher'::user_role)
    AND uploaded_by = public.get_auth_user_id()
);

-- Policy: Teachers can update and delete ONLY their own resources
CREATE POLICY "Teachers can update/delete own resources" 
ON public.library_resources 
FOR UPDATE 
USING (
    public.has_role('teacher'::user_role)
    AND uploaded_by = public.get_auth_user_id()
);

CREATE POLICY "Teachers can delete own resources" 
ON public.library_resources 
FOR DELETE 
USING (
    public.has_role('teacher'::user_role)
    AND uploaded_by = public.get_auth_user_id()
);
