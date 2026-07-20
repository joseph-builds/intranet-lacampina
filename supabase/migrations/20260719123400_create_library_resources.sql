-- Create the library_resources table
CREATE TABLE IF NOT EXISTS public.library_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('pdf', 'video', 'link', 'document', 'image', 'other')),
    education_level TEXT CHECK (education_level IN ('Inicial', 'Primaria', 'Secundaria')),
    grade TEXT,
    classroom_id UUID REFERENCES public.virtual_classrooms(id) ON DELETE SET NULL,
    subject TEXT,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.library_resources ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone (Students, Teachers, Admins, Parents) can view active resources
CREATE POLICY "Public read active library resources" 
ON public.library_resources 
FOR SELECT 
USING (is_active = true);

-- Policy: Teachers and Admins can view ALL resources (even inactive ones if they need to)
CREATE POLICY "Teachers and Admins can view all resources"
ON public.library_resources
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'teacher')
    )
);

-- Policy: Admins can insert/update/delete any resource
CREATE POLICY "Admins can manage any resource" 
ON public.library_resources 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- Policy: Teachers can insert their own resources
CREATE POLICY "Teachers can insert resources" 
ON public.library_resources 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'teacher'
    )
    AND uploaded_by = auth.uid()
);

-- Policy: Teachers can update and delete ONLY their own resources
CREATE POLICY "Teachers can update/delete own resources" 
ON public.library_resources 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'teacher'
    )
    AND uploaded_by = auth.uid()
);

CREATE POLICY "Teachers can delete own resources" 
ON public.library_resources 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'teacher'
    )
    AND uploaded_by = auth.uid()
);

-- Indices for performance on frequent filters
CREATE INDEX IF NOT EXISTS idx_library_resources_level ON public.library_resources(education_level);
CREATE INDEX IF NOT EXISTS idx_library_resources_grade ON public.library_resources(grade);
CREATE INDEX IF NOT EXISTS idx_library_resources_classroom ON public.library_resources(classroom_id);
CREATE INDEX IF NOT EXISTS idx_library_resources_subject ON public.library_resources(subject);
CREATE INDEX IF NOT EXISTS idx_library_resources_type ON public.library_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_library_resources_uploaded_by ON public.library_resources(uploaded_by);

-- ====================================================================================
-- STORAGE BUCKET FOR LIBRARY
-- ====================================================================================

-- Create 'library' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('library', 'library', true) 
ON CONFLICT (id) DO NOTHING;

-- RLS for Storage (library bucket)
-- Anyone can view files in library
CREATE POLICY "Public read library bucket" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'library');

-- Only Teachers and Admins can upload to library bucket
CREATE POLICY "Admins and teachers can upload to library bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'library' 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'teacher')
    )
);

-- Teachers can delete their own files, Admins can delete any file
CREATE POLICY "Users can delete files from library bucket" 
ON storage.objects 
FOR DELETE 
USING (
    bucket_id = 'library' 
    AND (
        -- User owns the file (using the owner column in storage.objects which points to auth.uid())
        auth.uid() = owner
        OR 
        -- Or user is an admin
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    )
);
