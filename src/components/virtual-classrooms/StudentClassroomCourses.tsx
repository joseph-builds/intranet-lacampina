import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Users, Calendar, UserPlus, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Course {
  id: string;
  name: string;
  description: string;
  code: string;
  academic_year: string;
  is_active: boolean;
  teacher?: {
    first_name: string;
    last_name: string;
  };
  is_enrolled?: boolean;
  enrollments_count?: number;
}

interface StudentClassroomCoursesProps {
  classroomId: string;
}

export function StudentClassroomCourses({ classroomId }: StudentClassroomCoursesProps) {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchClassroomCourses();
  }, [classroomId]);

  const fetchClassroomCourses = async () => {
    try {
      setLoading(true);
      
      // Obtener todos los cursos del aula virtual
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          teacher:profiles!courses_teacher_id_fkey(first_name, last_name)
        `)
        .eq('classroom_id', classroomId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (coursesError) throw coursesError;

      // Obtener inscripciones del estudiante actual
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('student_id', profile?.id);

      if (enrollmentsError) throw enrollmentsError;

      // Obtener número de estudiantes por curso
      const { data: enrollmentCounts, error: countError } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .in('course_id', (coursesData || []).map(c => c.id));

      if (countError) throw countError;

      const enrolledCourseIds = new Set(enrollmentsData?.map(e => e.course_id) || []);
      const countsByType = enrollmentCounts?.reduce((acc, enrollment) => {
        acc[enrollment.course_id] = (acc[enrollment.course_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const coursesWithEnrollment = (coursesData || []).map(course => ({
        ...course,
        is_enrolled: enrolledCourseIds.has(course.id),
        enrollments_count: countsByType[course.id] || 0
      }));

      setCourses(coursesWithEnrollment);
    } catch (error) {
      console.error('Error fetching classroom courses:', error);
      toast.error('Error al cargar los cursos del aula virtual');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollment = async (courseId: string) => {
    if (!profile?.id) {
      toast.error('No se pudo identificar el usuario');
      return;
    }

    setEnrolling(prev => new Set(prev).add(courseId));

    try {
      const { error } = await supabase
        .from('course_enrollments')
        .insert({
          course_id: courseId,
          student_id: profile.id
        });

      if (error) throw error;

      toast.success('Te has inscrito exitosamente al curso');
      
      // Actualizar estado local
      setCourses(prev => prev.map(course => 
        course.id === courseId 
          ? { ...course, is_enrolled: true, enrollments_count: (course.enrollments_count || 0) + 1 }
          : course
      ));
    } catch (error) {
      console.error('Error enrolling in course:', error);
      toast.error('Error al inscribirse al curso');
    } finally {
      setEnrolling(prev => {
        const newSet = new Set(prev);
        newSet.delete(courseId);
        return newSet;
      });
    }
  };

  const getSemesterLabel = (semester: string) => {
    const semesterMap: Record<string, string> = {
      'primer-semestre': 'Primer Semestre',
      'segundo-semestre': 'Segundo Semestre',
      'anual': 'Anual'
    };
    return semesterMap[semester] || semester;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cursos Disponibles</h2>
          <p className="text-muted-foreground">
            Cursos de esta aula virtual - Inscríbete para acceder al contenido
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : courses.length > 0 ? (
          courses.map((course) => (
            <Card 
              key={course.id} 
              className={`hover:shadow-md transition-shadow ${course.is_enrolled ? 'ring-2 ring-green-500' : ''}`}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {course.name}
                      {course.is_enrolled && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      {course.code}
                    </CardDescription>
                  </div>
                  <Badge variant={course.is_enrolled ? "default" : "secondary"}>
                    {course.is_enrolled ? "Inscrito" : "Disponible"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {course.description || 'Sin descripción disponible'}
                </p>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Año {course.academic_year}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    {course.enrollments_count} estudiantes
                  </div>
                </div>

                {course.teacher && (
                  <div className="text-sm text-muted-foreground">
                    Profesor: {course.teacher?.first_name || 'Sin asignar'} {course.teacher?.last_name || ''}
                  </div>
                )}

                <div className="pt-2">
                  {course.is_enrolled ? (
                    <Button 
                      variant="default" 
                      className="w-full"
                      onClick={() => window.location.href = `/courses/${course.id}`}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Acceder al Curso
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleEnrollment(course.id)}
                      disabled={enrolling.has(course.id)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {enrolling.has(course.id) ? 'Inscribiendo...' : 'Inscribirse'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay cursos disponibles</h3>
                <p className="text-muted-foreground text-center">
                  Esta aula virtual aún no tiene cursos creados
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}