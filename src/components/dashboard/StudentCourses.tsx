import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Clock,
  User,
  AlertCircle,
  FileText,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Course {
  id: string;
  name: string;
  code: string;
  schedule?: Array<{
    day: string;
    start_time: string;
    end_time: string;
  }>;
  teacher?: {
    first_name: string;
    last_name: string;
  };
  pending_assignments?: number;
  upcoming_exams?: number;
}

const ITEMS_PER_PAGE = 6;

export function StudentCourses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCourses, setTotalCourses] = useState(0);

  useEffect(() => {
    if (profile?.id) {
      fetchCourses();
    }
  }, [profile, currentPage]);

  const fetchCourses = async () => {
    try {
      setLoading(true);

      console.log("Fetching courses for student:", profile!.id);

      // Get total count first
      const { count: totalCount, error: countError } = await supabase
        .from("course_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("student_id", profile!.id);

      console.log("Total enrollments count:", totalCount);
      if (countError) {
        console.error("Count error:", countError);
      }

      setTotalCourses(totalCount || 0);

      if (!totalCount || totalCount === 0) {
        console.log("No enrollments found for this student");
        setCourses([]);
        setLoading(false);
        return;
      }

      // Get paginated enrolled courses - updated to fetch course details via modulos
      const { data: enrollments, error: enrollError } = await supabase
        .from("course_enrollments")
        .select(`
          course_id,
          modulos!inner(
            course_id,
            courses(
              id,
              name,
              code,
              schedule,
              teacher_principal_id
            )
          )
        `)
        .eq("student_id", profile!.id)
        .range(
          (currentPage - 1) * ITEMS_PER_PAGE,
          currentPage * ITEMS_PER_PAGE - 1,
        )
        .order("enrolled_at", { ascending: false });

      console.log("Enrollments data:", enrollments);
      console.log("Enrollments error:", enrollError);

      if (enrollError) throw enrollError;

      if (!enrollments || enrollments.length === 0) {
        console.log("No enrollments in this page");
        setCourses([]);
        setLoading(false);
        return;
      }

      // Get course IDs (course_ids)
      const courseIds = enrollments.map((e) => e.course_id);
      console.log("Course IDs:", courseIds);

      const coursesData = enrollments.map((e: any) => e.modulos?.courses).filter(Boolean);

      // Fetch teachers separately
      const teacherIds =
        coursesData.map((c: any) => c.teacher_principal_id).filter(Boolean) || [];
      const { data: teachers } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", teacherIds);

      console.log("Teachers data:", teachers);

      const teachersMap = new Map(teachers?.map((t) => [t.id, t]) || []);

      // Single query for submitted assignments
      const { data: submissions } = await supabase
        .from("assignment_submissions")
        .select("assignment_id")
        .eq("student_id", profile!.id);

      const submittedIds = new Set(
        submissions?.map((s) => s.assignment_id) || [],
      );

      // Single query for all pending assignments across all courses
      const { data: allAssignments } = await supabase
        .from("assignments")
        .select("id, course_id")
        .in("course_id", courseIds)
        .eq("is_published", true)
        .gt("due_date", new Date().toISOString());

      // Single query for all upcoming exams across all courses
      const { data: allExams } = await supabase
        .from("exams")
        .select("id, course_id")
        .in("course_id", courseIds)
        .eq("is_published", true)
        .gt("start_time", new Date().toISOString());

      // Group by course_id
      const assignmentsByCourse = new Map<string, number>();
      const examsByCourse = new Map<string, number>();

      allAssignments?.forEach((assignment) => {
        if (!submittedIds.has(assignment.id)) {
          const current = assignmentsByCourse.get(assignment.course_id) || 0;
          assignmentsByCourse.set(assignment.course_id, current + 1);
        }
      });

      allExams?.forEach((exam) => {
        const current = examsByCourse.get(exam.course_id) || 0;
        examsByCourse.set(exam.course_id, current + 1);
      });

      // Map to courses
      const coursesWithData =
        enrollments.map((enrollment: any) => {
          const course = enrollment.modulos?.courses;
          return {
            id: enrollment.course_id,
            name: course?.name || "Curso sin nombre",
            code: course?.code || "",
            schedule: course?.schedule,
            teacher: teachersMap.get(course?.teacher_principal_id),
            pending_assignments: assignmentsByCourse.get(enrollment.course_id) || 0,
            upcoming_exams: examsByCourse.get(enrollment.course_id) || 0,
          };
        });

      console.log("Final courses with data:", coursesWithData);
      setCourses(coursesWithData as Course[]);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCourses / ITEMS_PER_PAGE);

  const formatSchedule = (course: Course) => {
    if (!course.schedule || course.schedule.length === 0) {
      return "Horario no definido";
    }

    const daysMap: { [key: string]: string } = {
      Lunes: "L",
      Martes: "M",
      Miércoles: "X",
      Jueves: "J",
      Viernes: "V",
      Sábado: "S",
      Domingo: "D",
    };

    const scheduleSummary = course.schedule
      .map(
        (s) =>
          `${daysMap[s.day] || s.day.charAt(0)} ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`,
      )
      .join(", ");

    return scheduleSummary;
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Mis Cursos Activos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (courses.length === 0) {
    return (
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Mis Cursos Activos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No estás inscrito en ningún curso</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Mis Cursos Activos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="p-4 rounded-lg bg-background/60 border border-border/50 hover:shadow-card transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground">
                      {course.name}
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      {course.code}
                    </Badge>
                  </div>

                  {course.teacher && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                      <User className="w-3 h-3" />
                      Prof. {course.teacher.first_name}{" "}
                      {course.teacher.last_name}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatSchedule(course)}
                  </div>
                </div>

                <Link to={`/courses/${course.id}`}>
                  <Button size="sm" variant="outline">
                    Ver Curso
                  </Button>
                </Link>
              </div>

              {(course.pending_assignments > 0 ||
                course.upcoming_exams > 0) && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
                  {course.pending_assignments > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="w-3 h-3 text-accent" />
                      <span className="font-medium text-accent">
                        {course.pending_assignments}
                      </span>{" "}
                      tareas pendientes
                    </div>
                  )}
                  {course.upcoming_exams > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ClipboardList className="w-3 h-3 text-accent" />
                      <span className="font-medium text-accent">
                        {course.upcoming_exams}
                      </span>{" "}
                      exámenes próximos
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
            <p className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages} ({totalCourses} cursos total)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages || loading}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
