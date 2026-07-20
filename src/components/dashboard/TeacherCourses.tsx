import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  ArrowRight,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TeacherCourse {
  id: string;
  name: string;
  code: string;
  schedule: string;
  studentCount?: number;
}

const ITEMS_PER_PAGE = 3;

export const TeacherCourses = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCourses, setTotalCourses] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (profile) {
      fetchCourses();
    }
  }, [profile, currentPage]);

  const fetchCourses = async () => {
    try {
      setLoading(true);

      // 1. Primary courses
      const { data: primary, error: pError } = await supabase
        .from('courses')
        .select(`
          *,
          teacher:profiles!courses_teacher_principal_id_fkey (
            id, first_name, last_name, email
          ),
          classroom:virtual_classrooms!courses_classroom_id_fkey (
            id, name, grade, education_level
          )
        `)
        .eq('teacher_principal_id', profile!.id)
        .eq('is_active', true);

      if (pError) throw pError;

      // 2. Additional course_teachers
      const { data: additional, error: aError } = await supabase
        .from('course_teachers')
        .select(`
          course:courses (
            *,
            teacher:profiles!courses_teacher_principal_id_fkey (
              id, first_name, last_name, email
            ),
            classroom:virtual_classrooms!courses_classroom_id_fkey (
              id, name, grade, education_level
            )
          )
        `)
        .eq('teacher_id', profile!.id)
        .eq('course.is_active', true);

      if (aError) throw aError;

      // 3. Section courses
      const { data: sectionCourses, error: scError } = await supabase
        .from('section_courses')
        .select(`
          base:base_courses (
            course:courses (
              *,
              teacher:profiles!courses_teacher_principal_id_fkey (
                id, first_name, last_name, email
              ),
              classroom:virtual_classrooms!courses_classroom_id_fkey (
                id, name, grade, education_level
              )
            )
          )
        `)
        .eq('teacher_id', profile!.id);

      if (scError) throw scError;

      const all = [
        ...(primary || []),
        ...(additional?.map(a => (a as any).course).filter(Boolean) || []),
        ...(sectionCourses?.map(sc => {
          const course = (sc.base as any)?.course;
          if (course) {
            course.teacher = {
              id: profile!.id,
              first_name: profile!.first_name,
              last_name: profile!.last_name,
              email: profile!.email
            };
            return course;
          }
          return null;
        }).filter(Boolean) || [])
      ];

      // Flatten arrays if any (just in case), and filter duplicates/inactives
      let flatCourses: any[] = [];
      all.forEach(item => {
        if (Array.isArray(item)) flatCourses.push(...item);
        else flatCourses.push(item);
      });

      let allCourses = flatCourses.reduce((acc, current) => {
        if (current && current.is_active !== false && !acc.find((item: any) => item.id === current.id)) {
          acc.push(current);
        }
        return acc;
      }, []);

      setTotalCourses(allCourses.length);

      if (allCourses.length === 0) {
        setCourses([]);
        setLoading(false);
        return;
      }

      const coursesData = allCourses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

      const enrichedCourses = coursesData.map((c) => ({
        ...c,
        studentCount: 0
      })) as TeacherCourse[];

      setCourses(enrichedCourses);
    } catch (error: any) {
      console.error("Error fetching teacher courses:", error);
      toast.error("Error al cargar tus cursos");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCourses / ITEMS_PER_PAGE);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Mis Cursos Activos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (courses.length === 0) {
    return (
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Mis Cursos Activos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-10 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No tienes cursos</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Actualmente no tienes cursos activos asignados.
          </p>
          <Button onClick={() => navigate("/courses")} variant="outline">
            Ver Todos
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-card border-0 h-full flex flex-col transition-all duration-300 hover:shadow-lg relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500" />
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Mis Cursos Activos
          <Badge variant="secondary" className="ml-2 font-normal">
            {totalCourses} {totalCourses === 1 ? "curso" : "cursos"}
          </Badge>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary/80 hidden sm:flex"
          onClick={() => navigate("/courses")}
        >
          Ver todos
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="p-0 flex-grow flex flex-col">
        <div className="divide-y flex-grow">
          {courses.map((course) => (
            <div
              key={course.id}
              className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors group/item"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-lg text-foreground group-hover/item:text-primary transition-colors">
                    {course.name}
                  </h3>

                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-help">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span>
                              {course.schedule || "Horario por definir"}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Horario del curso</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-emerald-500" />
                      <span>{course.code}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3">
                  <Button
                    size="sm"
                    className="w-full sm:w-auto shadow-glow transition-transform hover:scale-105"
                    onClick={() => navigate(`/courses/${course.id}`)}
                  >
                    Ir al Curso
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-slate-50/30">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
