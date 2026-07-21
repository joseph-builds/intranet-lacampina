-- Migration: Create Grades Module
-- Creates tables for bimestres, evaluation types, weight configurations, grade records, and selected assignments for automatic grading.

-- 1. academic_bimestres
CREATE TABLE IF NOT EXISTS public.academic_bimestres (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. grade_evaluation_types
CREATE TABLE IF NOT EXISTS public.grade_evaluation_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_automatic BOOLEAN DEFAULT false,
    source_module TEXT, -- 'assignments', 'exams', etc (for automatic types)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed basic evaluation types (Admin can add more later)
INSERT INTO public.grade_evaluation_types (name, is_automatic, source_module)
VALUES 
  ('Tareas Virtuales', true, 'assignments'),
  ('Exámenes Virtuales', true, 'exams'),
  ('Examen Presencial', false, null),
  ('Participación', false, null),
  ('Trabajo de Campo', false, null)
ON CONFLICT DO NOTHING;

-- 3. grade_weight_configurations
CREATE TABLE IF NOT EXISTS public.grade_weight_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    bimestre_id UUID NOT NULL REFERENCES public.academic_bimestres(id) ON DELETE CASCADE,
    evaluation_type_id UUID NOT NULL REFERENCES public.grade_evaluation_types(id) ON DELETE CASCADE,
    weight_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(course_id, bimestre_id, evaluation_type_id)
);

-- 4. grade_records (Manual grades inputted by teachers)
CREATE TABLE IF NOT EXISTS public.grade_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    bimestre_id UUID NOT NULL REFERENCES public.academic_bimestres(id) ON DELETE CASCADE,
    evaluation_type_id UUID NOT NULL REFERENCES public.grade_evaluation_types(id) ON DELETE CASCADE,
    score_value NUMERIC(4, 2), -- 0-20
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, course_id, bimestre_id, evaluation_type_id)
);

-- 5. grade_selected_assignments (Which tasks/exams the teacher selects for automatic grading)
CREATE TABLE IF NOT EXISTS public.grade_selected_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    bimestre_id UUID NOT NULL REFERENCES public.academic_bimestres(id) ON DELETE CASCADE,
    evaluation_type_id UUID NOT NULL REFERENCES public.grade_evaluation_types(id) ON DELETE CASCADE,
    assignment_id UUID, -- For tasks
    exam_id UUID, -- For exams
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(course_id, bimestre_id, evaluation_type_id, assignment_id, exam_id)
);

-- 6. grade_consolidations (Final calculated grade per student, course, bimestre)
CREATE TABLE IF NOT EXISTS public.grade_consolidations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    bimestre_id UUID NOT NULL REFERENCES public.academic_bimestres(id) ON DELETE CASCADE,
    calculated_score_value NUMERIC(4, 2),
    manual_override_value NUMERIC(4, 2),
    override_reason TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, course_id, bimestre_id)
);

-- Enable RLS
ALTER TABLE public.academic_bimestres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_evaluation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_weight_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_selected_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_consolidations ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Admins full access academic_bimestres" ON public.academic_bimestres FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins full access grade_evaluation_types" ON public.grade_evaluation_types FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Anyone authenticated can read bimestres and evaluation types
CREATE POLICY "Auth read academic_bimestres" ON public.academic_bimestres FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth read grade_evaluation_types" ON public.grade_evaluation_types FOR SELECT USING (auth.role() = 'authenticated');

-- Teachers can manage configurations, records, and selected assignments for their courses
CREATE POLICY "Teachers manage weight configs" ON public.grade_weight_configurations FOR ALL USING (
  public.is_teacher_of_course(course_id)
);
CREATE POLICY "Teachers manage grade records" ON public.grade_records FOR ALL USING (
  public.is_teacher_of_course(course_id)
);
CREATE POLICY "Teachers manage selected assignments" ON public.grade_selected_assignments FOR ALL USING (
  public.is_teacher_of_course(course_id)
);
CREATE POLICY "Teachers manage consolidations" ON public.grade_consolidations FOR ALL USING (
  public.is_teacher_of_course(course_id)
);

-- Students can read their own records and configurations for enrolled courses
CREATE POLICY "Students read weight configs" ON public.grade_weight_configurations FOR SELECT USING (
  public.is_student_of_course(course_id)
);
CREATE POLICY "Students read their grade records" ON public.grade_records FOR SELECT USING (
  student_id = auth.uid()
);
CREATE POLICY "Students read their consolidations" ON public.grade_consolidations FOR SELECT USING (
  student_id = auth.uid()
);
