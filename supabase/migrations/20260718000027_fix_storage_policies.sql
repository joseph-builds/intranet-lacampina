DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Recreate essential storage policies for student-submissions and course-files

-- 1. Allow public read access to all files (or whatever is appropriate)
-- Since this is an educational platform, let's keep it simple for now or restrict it to authenticated users.
CREATE POLICY "Allow authenticated users to read storage" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to upload storage" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update storage" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to delete storage" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (true);
