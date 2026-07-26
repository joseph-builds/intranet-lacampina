import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractAnswersMap(rawAnswers: any): Record<string, any> {
  if (!rawAnswers) return {};
  
  if (Array.isArray(rawAnswers)) {
    const result: Record<string, any> = {};
    for (const item of rawAnswers) {
      if (!item || item.is_metadata) continue;
      if (typeof item === 'object') {
        if (item.question_id) {
          result[item.question_id] = item;
        } else {
          Object.assign(result, item);
        }
      }
    }
    return result;
  }

  if (typeof rawAnswers === 'object') {
    return rawAnswers;
  }
  
  return {};
}

export interface FormattedCourse {
  id: string;
  name: string;
  code: string;
  originalName: string;
  classroomInfo?: string;
}

export const fetchTeacherCoursesWithClassrooms = async (
  supabase: any,
  teacherId: string
): Promise<FormattedCourse[]> => {
  if (!teacherId) return [];

  try {
    // 1. Cursos donde es profesor principal con aula virtual asignada
    const { data: directCourses, error: dcError } = await supabase
      .from("courses")
      .select(`
        id, name, code,
        classroom:virtual_classrooms!courses_classroom_id_fkey (
          id, name, grade, education_level
        )
      `)
      .eq("teacher_principal_id", teacherId)
      .eq("is_active", true);

    if (dcError) {
      console.error("Error fetching direct courses:", dcError);
    }

    let allCourses: any[] = directCourses || [];

    // 2. Cursos asignados via section_courses (secciones y grados)
    const { data: sectionCourses, error: scError } = await supabase
      .from("section_courses")
      .select(`
        section:sections (
          id,
          name,
          grade:academic_grades (
            name,
            level:academic_levels (name)
          )
        ),
        base_course:base_courses!inner(
          course_id,
          courses!inner(
            id, name, code,
            classroom:virtual_classrooms!courses_classroom_id_fkey (
              id, name, grade, education_level
            )
          )
        )
      `)
      .eq("teacher_id", teacherId);

    if (!scError && sectionCourses) {
      sectionCourses.forEach((sc: any) => {
        const c = sc.base_course?.courses;
        if (!c) return;

        let courseObj = c;
        if (!c.classroom && sc.section) {
          const secGrade = sc.section.grade?.name || "";
          const secName = sc.section.name || "";
          const secLevel = sc.section.grade?.level?.name || "";
          courseObj = {
            ...c,
            classroom: {
              grade: secGrade,
              name: secName ? `Aula ${secName}` : "",
              education_level: secLevel,
            },
          };
        }
        allCourses.push(courseObj);
      });
    }

    // 3. Desduplicar y formatear nombre descriptivo con grado/sección/aula
    const courseMap = new Map<string, FormattedCourse>();

    allCourses.forEach((c: any) => {
      if (!c || !c.id) return;
      if (courseMap.has(c.id)) return;

      const details: string[] = [];
      if (c.classroom?.grade) details.push(c.classroom.grade);
      if (c.classroom?.name) details.push(c.classroom.name);
      if (c.classroom?.education_level && !details.some((d: string) => d.includes(c.classroom.education_level))) {
        details.push(c.classroom.education_level);
      }

      let displayName = c.name;
      const infoStr = details.join(" - ");
      if (details.length > 0) {
        displayName = `${c.name} (${infoStr})`;
      } else if (c.code) {
        displayName = `${c.name} [${c.code}]`;
      }

      courseMap.set(c.id, {
        id: c.id,
        name: displayName,
        code: c.code || "",
        originalName: c.name,
        classroomInfo: infoStr,
      });
    });

    const result = Array.from(courseMap.values());
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  } catch (err) {
    console.error("Error in fetchTeacherCoursesWithClassrooms:", err);
    return [];
  }
};


