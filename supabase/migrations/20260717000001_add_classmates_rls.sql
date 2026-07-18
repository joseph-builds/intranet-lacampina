-- ─── 1. Create virtual_classrooms table and add foreign keys ──────────────────────

-- Create virtual_classrooms table
CREATE TABLE IF NOT EXISTS public.virtual_classrooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  grade text NOT NULL,
  education_level text NOT NULL,
  academic_year text NOT NULL,
  section text NOT NULL,
  teacher_principal_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tutor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT virtual_classrooms_pkey PRIMARY KEY (id)
);

-- Add classroom_id reference to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES public.virtual_classrooms(id) ON DELETE SET NULL;

-- Add classroom_id reference to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES public.virtual_classrooms(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_classroom_id ON public.courses(classroom_id);
CREATE INDEX IF NOT EXISTS idx_attendance_classroom_id ON public.attendance(classroom_id);


-- ─── 2. Enable RLS and add policies for virtual_classrooms table ─────────────────

ALTER TABLE public.virtual_classrooms ENABLE ROW LEVEL SECURITY;

-- Allow admins to perform all operations on virtual_classrooms
DROP POLICY IF EXISTS "Admins can do everything on virtual_classrooms" ON public.virtual_classrooms;
CREATE POLICY "Admins can do everything on virtual_classrooms" ON public.virtual_classrooms
  FOR ALL TO authenticated USING (public.has_role('admin'::user_role));

-- Allow directivos to view virtual_classrooms
DROP POLICY IF EXISTS "Directivos can view all virtual_classrooms" ON public.virtual_classrooms;
CREATE POLICY "Directivos can view all virtual_classrooms" ON public.virtual_classrooms
  FOR SELECT TO authenticated USING (public.has_role('directivo'::user_role));

-- Allow teachers and tutors to view their assigned virtual_classrooms
DROP POLICY IF EXISTS "Teachers can view their own virtual_classrooms" ON public.virtual_classrooms;
CREATE POLICY "Teachers can view their own virtual_classrooms" ON public.virtual_classrooms
  FOR SELECT TO authenticated USING (
    teacher_principal_id = public.get_auth_user_id() 
    OR tutor_id = public.get_auth_user_id()
  );


-- ─── 3. Create helper functions with row_security = off for Classmates ───────────

-- Check if a student shares at least one course/modulo with the current authenticated user
CREATE OR REPLACE FUNCTION public.share_course_with_student(other_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments ce1
    JOIN public.course_enrollments ce2 ON ce2.modulo_id = ce1.modulo_id
    WHERE ce1.student_id = public.get_auth_user_id() 
      AND ce2.student_id = other_student_id
      AND ce1.is_active = true 
      AND ce2.is_active = true
  );
$$;

-- Check if the current authenticated user is enrolled in a specific course/modulo
CREATE OR REPLACE FUNCTION public.is_enrolled_in_modulo(modulo_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments
    WHERE modulo_id = $1 
      AND student_id = public.get_auth_user_id() 
      AND is_active = true
  );
$$;


-- ─── 4. Add RLS Policies for Classmates (profiles table) ─────────────────────────

-- Allow students to view profiles of their classmates
DROP POLICY IF EXISTS "Students can view classmates' profiles" ON public.profiles;
CREATE POLICY "Students can view classmates' profiles" ON public.profiles
  FOR SELECT USING (
    public.share_course_with_student(id)
  );


-- ─── 5. Add RLS Policies for Classmates (course_enrollments table) ───────────────

-- Allow students to view other enrollments in the same course/modulo
DROP POLICY IF EXISTS "Students can view classmates' enrollments" ON public.course_enrollments;
CREATE POLICY "Students can view classmates' enrollments" ON public.course_enrollments
  FOR SELECT USING (
    public.is_enrolled_in_modulo(modulo_id)
  );
