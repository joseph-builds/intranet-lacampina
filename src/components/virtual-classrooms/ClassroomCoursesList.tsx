import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { BookOpen, Calendar, Users, GraduationCap, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  teacher: {
    first_name: string;
    last_name: string;
  };
  is_enrolled: boolean;
  total_sections: number;
  completed_sections: number;
}

interface ClassroomCoursesListProps {
  classroomId: string;
  classroomName: string;
}

export function ClassroomCoursesList({ classroomId, classroomName }: ClassroomCoursesListProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (classroomId) {
      fetchCourses();
    }
  }, [classroomId]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data: coursesData, error } = await supabase
        .from('courses')
        .select(`
          *,
          profiles!courses_teacher_id_fkey(first_name, last_name)
        `)
        .eq('classroom_id', classroomId)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;

      // Check enrollment status for each course
      const coursesWithEnrollment = await Promise.all(
        (coursesData || []).map(async (course) => {
          const { data: enrollment } = await supabase
            .from('course_enrollments')
            .select('id')
            .eq('course_id', course.id)
            .eq('student_id', profile?.id)
            .maybeSingle();

          // Get progress data
          const { data: sectionsData } = await supabase
            .from('course_weekly_sections')
            .select('id')
            .eq('course_id', course.id);

          const { data: progressData } = await supabase
            .from('student_progress')
            .select('id')
            .eq('course_id', course.id)
            .eq('student_id', profile?.id)
            .eq('progress_type', 'section_completed');

          return {
            ...course,
            teacher: course.profiles || { first_name: 'Profesor', last_name: 'Asignado' },
            is_enrolled: !!enrollment,
            total_sections: sectionsData?.length || 0,
            completed_sections: progressData?.length || 0
          };
        })
      );

      setCourses(coursesWithEnrollment);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Error al cargar los cursos');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!profile?.id) return;

    setEnrolling(courseId);
    try {
      const { error } = await supabase
        .from('course_enrollments')
        .insert({
          course_id: courseId,
          student_id: profile.id
        });

      if (error) throw error;

      toast.success('Te has inscrito al curso exitosamente');
      fetchCourses(); // Refresh the list
    } catch (error) {
      console.error('Error enrolling in course:', error);
      toast.error('Error al inscribirse al curso');
    } finally {
      setEnrolling(null);
    }
  };

  const getProgressPercentage = (completed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-muted rounded w-full mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-foreground mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Cursos Disponibles
        </h2>
        <p className="text-muted-foreground text-lg">
          {courses.length} curso{courses.length !== 1 ? 's' : ''} en {classroomName}
        </p>
      </div>

      {courses.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="text-center py-16">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No hay cursos disponibles</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Esta aula virtual aún no tiene cursos creados. Los cursos aparecerán aquí cuando estén disponibles.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const progressPercentage = getProgressPercentage(course.completed_sections, course.total_sections);
            
            return (
              <Card 
                key={course.id} 
                className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  course.is_enrolled 
                    ? 'border-primary/50 bg-gradient-to-br from-primary/5 to-transparent' 
                    : 'hover:border-primary/30'
                }`}
              >
                {/* Decorative gradient overlay */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity" />
                
                <CardHeader className="relative pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <Badge variant="secondary" className="text-xs font-medium shadow-sm">
                          {course.code}
                        </Badge>
                        {course.is_enrolled ? (
                          <Badge className="text-xs bg-green-500 hover:bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Inscrito
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Disponible
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {course.name}
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            Prof. {course.teacher?.first_name || 'Sin asignar'} {course.teacher?.last_name || ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>{course.academic_year}</span>
                        </div>
                      </CardDescription>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4 relative">
                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {course.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-xs">{formatDate(course.start_date)}</span>
                    </div>
                    {course.total_sections > 0 && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{course.total_sections} semanas</span>
                      </div>
                    )}
                  </div>

                  {course.is_enrolled && course.total_sections > 0 && (
                    <div className="space-y-2.5 p-3 bg-gradient-to-br from-primary/5 to-transparent rounded-lg border border-primary/10">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Tu progreso</span>
                        <span className="font-bold text-primary">{progressPercentage}%</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2.5" />
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {course.completed_sections} de {course.total_sections} semanas completadas
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    {course.is_enrolled ? (
                      <Button 
                        onClick={() => navigate(`/courses/${course.id}`)}
                        className="w-full font-medium shadow-md hover:shadow-lg transition-all"
                        size="lg"
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        Acceder al Curso
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleEnroll(course.id)}
                        disabled={enrolling === course.id}
                        className="w-full font-medium"
                        variant="outline"
                        size="lg"
                      >
                        {enrolling === course.id ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Inscribiendo...
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4 mr-2" />
                            Inscribirse Ahora
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}