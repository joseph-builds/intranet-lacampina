-- Fix RLS policies broken by column renames:
--   courses.teacher_id → courses.teacher_principal_id
--   course_enrollments.course_id → course_enrollments.modulo_id (now FK to modulos)

-- ─── courses table ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Teachers can view their courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers can manage their courses" ON public.courses;

CREATE POLICY "Teachers can view their courses" ON public.courses
  FOR SELECT USING (
    teacher_principal_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Teachers can manage their courses" ON public.courses
  FOR ALL USING (
    teacher_principal_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ─── course_enrollments table ────────────────────────────────────────────────
-- Old policy used course_enrollments.course_id (column removed) and
-- courses.teacher_id (column renamed). Rewrite to use modulo_id → modulos → courses.

DROP POLICY IF EXISTS "Teachers can view enrollments in their courses" ON public.course_enrollments;

CREATE POLICY "Teachers can view enrollments in their courses" ON public.course_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.modulos m
      JOIN public.courses c ON c.id = m.course_id
      JOIN public.profiles p ON p.id = c.teacher_principal_id
      WHERE m.id = course_enrollments.modulo_id
        AND p.user_id = auth.uid()
    )
  );
