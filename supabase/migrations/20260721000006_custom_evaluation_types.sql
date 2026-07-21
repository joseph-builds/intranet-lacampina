-- Add course_id to grade_evaluation_types to allow teachers to create custom sections per course
ALTER TABLE public.grade_evaluation_types ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;

-- Allow teachers to manage evaluation types for their courses
DROP POLICY IF EXISTS "Teachers manage custom evaluation types" ON public.grade_evaluation_types;
CREATE POLICY "Teachers manage custom evaluation types" ON public.grade_evaluation_types FOR ALL USING (
  course_id IS NOT NULL AND public.is_teacher_of_course(course_id)
);

NOTIFY pgrst, 'reload schema';
