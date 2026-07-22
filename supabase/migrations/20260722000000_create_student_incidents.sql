-- Create student_incidents table for tutor incident tracking
CREATE TABLE IF NOT EXISTS public.student_incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  classroom_id uuid NOT NULL,
  incident_type text NOT NULL CHECK (incident_type IN ('conductual', 'académica', 'salud_accidente', 'convivencia_bullying', 'positiva_reconocimiento')),
  severity text NOT NULL CHECK (severity IN ('leve', 'moderada', 'grave')),
  description text NOT NULL,
  action_taken text,
  status text NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'en_seguimiento', 'cerrada')),
  recorded_by uuid NOT NULL,
  incident_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_incidents_pkey PRIMARY KEY (id),
  CONSTRAINT student_incidents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT student_incidents_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.virtual_classrooms(id),
  CONSTRAINT student_incidents_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_student_incidents_student_id ON public.student_incidents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_incidents_classroom_id ON public.student_incidents(classroom_id);
CREATE INDEX IF NOT EXISTS idx_student_incidents_incident_date ON public.student_incidents(incident_date DESC);
