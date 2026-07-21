-- Migration: RPC for calculating consolidated grades

CREATE OR REPLACE FUNCTION public.calculate_consolidated_grades(
    p_course_id UUID,
    p_bimestre_id UUID
) RETURNS void AS $$
DECLARE
    v_student record;
    v_config record;
    v_total_weight NUMERIC;
    v_final_score NUMERIC;
    v_type_score NUMERIC;
    
    v_assignments_avg NUMERIC;
    v_exams_avg NUMERIC;
BEGIN
    -- This function calculates the consolidated grade for all students in a specific course and bimestre.
    
    -- Loop through all enrolled students for this course
    FOR v_student IN (
        SELECT DISTINCT student_id 
        FROM (
            SELECT student_id FROM course_enrollments WHERE course_id = p_course_id
            UNION
            SELECT ss.student_id 
            FROM student_sections ss
            JOIN section_courses sc ON ss.section_id = sc.section_id
            JOIN base_courses bc ON sc.base_course_id = bc.id
            WHERE bc.course_id = p_course_id
              AND ss.is_active = true
        ) sub
    ) LOOP
        v_final_score := 0;
        v_total_weight := 0;
        
        -- Loop through the configurations for this course and bimestre
        FOR v_config IN (
            SELECT gwc.evaluation_type_id, gwc.weight_percentage, get.is_automatic, get.source_module
            FROM grade_weight_configurations gwc
            JOIN grade_evaluation_types get ON gwc.evaluation_type_id = get.id
            WHERE gwc.course_id = p_course_id AND gwc.bimestre_id = p_bimestre_id
        ) LOOP
            v_type_score := 0;
            
            IF v_config.is_automatic THEN
                -- Automatic calculation
                IF v_config.source_module = 'assignments' THEN
                    -- Average of selected assignments
                    SELECT COALESCE(AVG(NULLIF(BTRIM(asu.score), '')::numeric), 0) INTO v_type_score
                    FROM assignment_submissions asu
                    JOIN assignments a ON asu.assignment_id = a.id
                    JOIN grade_selected_assignments gsa ON gsa.assignment_id = a.id
                    WHERE a.course_id = p_course_id 
                      AND asu.student_id = v_student.student_id
                      AND asu.score IS NOT NULL
                      AND gsa.course_id = p_course_id
                      AND gsa.bimestre_id = p_bimestre_id
                      AND gsa.evaluation_type_id = v_config.evaluation_type_id;
                      
                ELSIF v_config.source_module = 'exams' THEN
                    -- Average of selected exams
                    SELECT COALESCE(AVG(NULLIF(BTRIM(qs.score::text), '')::numeric), 0) INTO v_type_score
                    FROM quiz_submissions qs
                    JOIN quizzes q ON qs.quiz_id = q.id
                    JOIN exams e ON e.course_id = q.course_id AND e.title = q.title
                    JOIN grade_selected_assignments gsa ON gsa.exam_id = e.id
                    WHERE e.course_id = p_course_id 
                      AND qs.student_id = v_student.student_id
                      AND qs.score IS NOT NULL
                      AND gsa.course_id = p_course_id
                      AND gsa.bimestre_id = p_bimestre_id
                      AND gsa.evaluation_type_id = v_config.evaluation_type_id;
                END IF;
            ELSE
                -- Manual calculation (from grade_records)
                SELECT COALESCE(score_value, 0) INTO v_type_score
                FROM grade_records
                WHERE student_id = v_student.student_id
                  AND course_id = p_course_id
                  AND bimestre_id = p_bimestre_id
                  AND evaluation_type_id = v_config.evaluation_type_id;
            END IF;
            
            -- Add to final score based on weight
            v_final_score := v_final_score + (v_type_score * (v_config.weight_percentage / 100.0));
            v_total_weight := v_total_weight + v_config.weight_percentage;
        END LOOP;
        
        -- Upsert into grade_consolidations
        INSERT INTO public.grade_consolidations (
            student_id, course_id, bimestre_id, calculated_score_value, updated_at
        ) VALUES (
            v_student.student_id, p_course_id, p_bimestre_id, v_final_score, NOW()
        )
        ON CONFLICT (student_id, course_id, bimestre_id) 
        DO UPDATE SET 
            calculated_score_value = EXCLUDED.calculated_score_value,
            updated_at = EXCLUDED.updated_at;
            
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
