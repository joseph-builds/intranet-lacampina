-- RPC para guardar asistencia del aula (tutor) sin usar Edge Functions

CREATE OR REPLACE FUNCTION public.create_classroom_attendance(
    p_classroom_id uuid,
    p_date date,
    p_records jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record jsonb;
    v_student_id uuid;
    v_status text;
    v_notes text;
    v_profile_id uuid;
BEGIN
    -- Obtener el ID del perfil del usuario actual
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();

    -- Eliminar registros existentes para esta aula y fecha
    DELETE FROM public.attendance
    WHERE classroom_id = p_classroom_id AND date = p_date;

    -- Insertar los nuevos registros
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_student_id := (v_record->>'student_id')::uuid;
        v_status := v_record->>'status';
        v_notes := v_record->>'notes';

        INSERT INTO public.attendance (
            classroom_id,
            student_id,
            date,
            status,
            notes,
            recorded_at,
            recorded_by
        )
        VALUES (
            p_classroom_id,
            v_student_id,
            p_date,
            v_status,
            v_notes,
            now(),
            v_profile_id
        );
    END LOOP;
END;
$$;
