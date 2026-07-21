-- Sincronización Automática entre 'sections' y 'virtual_classrooms'

-- 1. Crear función que sincroniza los datos
CREATE OR REPLACE FUNCTION public.sync_section_to_virtual_classroom()
RETURNS TRIGGER AS $$
DECLARE
    grade_name text;
    level_name text;
BEGIN
    -- Obtener los nombres del grado y nivel académico
    IF NEW.grade_id IS NOT NULL THEN
        SELECT ag.name, al.name INTO grade_name, level_name 
        FROM public.academic_grades ag
        JOIN public.academic_levels al ON al.id = ag.level_id
        WHERE ag.id = NEW.grade_id;
        
        IF TG_OP = 'INSERT' THEN
            -- Al crear una sección, crear su aula virtual correspondiente
            INSERT INTO public.virtual_classrooms (id, name, grade, education_level, academic_year, section, tutor_id)
            VALUES (NEW.id, NEW.name, COALESCE(grade_name, ''), COALESCE(level_name, ''), NEW.academic_year::text, NEW.name, NEW.tutor_id);
        ELSIF TG_OP = 'UPDATE' THEN
            -- Al actualizar una sección (ej. asignar tutor), actualizar el aula virtual
            IF EXISTS (SELECT 1 FROM public.virtual_classrooms WHERE id = NEW.id) THEN
                UPDATE public.virtual_classrooms
                SET name = NEW.name,
                    grade = COALESCE(grade_name, ''),
                    education_level = COALESCE(level_name, ''),
                    academic_year = NEW.academic_year::text,
                    section = NEW.name,
                    tutor_id = NEW.tutor_id
                WHERE id = NEW.id;
            ELSE
                INSERT INTO public.virtual_classrooms (id, name, grade, education_level, academic_year, section, tutor_id)
                VALUES (NEW.id, NEW.name, COALESCE(grade_name, ''), COALESCE(level_name, ''), NEW.academic_year::text, NEW.name, NEW.tutor_id);
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_sync_section_to_virtual_classroom ON public.sections;

-- 3. Crear el trigger
CREATE TRIGGER trigger_sync_section_to_virtual_classroom
AFTER INSERT OR UPDATE ON public.sections
FOR EACH ROW
EXECUTE FUNCTION public.sync_section_to_virtual_classroom();
