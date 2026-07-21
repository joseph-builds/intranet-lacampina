-- Política para que los tutores puedan ver la asistencia de su aula

DROP POLICY IF EXISTS "Tutors can view their classroom attendance" ON public.attendance;

CREATE POLICY "Tutors can view their classroom attendance" ON public.attendance
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.id = attendance.classroom_id
        AND s.tutor_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
);
