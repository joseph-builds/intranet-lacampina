-- Migration for Temarios (Course Syllabi) module

CREATE TABLE IF NOT EXISTS public.temarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    profesor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    archivo_pdf TEXT NOT NULL,
    nombre_original TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_revision', 'aprobado', 'rechazado')),
    retroalimentacion TEXT,
    revisado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    revisado_en TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_temario_curso_profesor UNIQUE (curso_id, profesor_id)
);

-- Enable RLS
ALTER TABLE public.temarios ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Temarios profesor select policy" ON public.temarios;
DROP POLICY IF EXISTS "Temarios profesor insert policy" ON public.temarios;
DROP POLICY IF EXISTS "Temarios profesor update policy" ON public.temarios;
DROP POLICY IF EXISTS "Temarios admin policy" ON public.temarios;

-- RLS Policies for temarios table
CREATE POLICY "Temarios profesor select policy" ON public.temarios
    FOR SELECT TO authenticated
    USING (
        profesor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = temarios.profesor_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Temarios profesor insert policy" ON public.temarios
    FOR INSERT TO authenticated
    WITH CHECK (
        profesor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = temarios.profesor_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Temarios profesor update policy" ON public.temarios
    FOR UPDATE TO authenticated
    USING (
        profesor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = temarios.profesor_id AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        profesor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = temarios.profesor_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Temarios admin policy" ON public.temarios
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE (id = auth.uid() OR user_id = auth.uid()) AND role = 'admin'
        )
    );

-- Storage bucket for temarios
INSERT INTO storage.buckets (id, name, public)
VALUES ('temarios', 'temarios', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage bucket 'temarios'
DROP POLICY IF EXISTS "Temarios storage select" ON storage.objects;
DROP POLICY IF EXISTS "Temarios storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Temarios storage update" ON storage.objects;
DROP POLICY IF EXISTS "Temarios storage delete" ON storage.objects;

CREATE POLICY "Temarios storage select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'temarios');

CREATE POLICY "Temarios storage insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'temarios');

CREATE POLICY "Temarios storage update" ON storage.objects
    FOR UPDATE TO authenticated
    WITH CHECK (bucket_id = 'temarios');

CREATE POLICY "Temarios storage delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'temarios');
