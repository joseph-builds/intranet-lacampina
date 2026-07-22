import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, Clock, Plus, ArrowRight, GraduationCap, Calendar, Trash2, School } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Course {
  id: string;
  name: string;
  description: string;
  code: string;
  academic_year: string;
  semester: string;
  is_active: boolean;
  created_at: string;
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  classroom?: {
    id: string;
    name: string;
    grade: string;
    education_level: string;
  };
  course_teachers?: {
    teacher: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
  }[];
  enrollments?: { count: number }[];
  enrolled_at?: string; // For students
  enrollment_status?: string; // For students
  schedule?: string | null;
}

const Courses = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentSection, setStudentSection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, [profile]);

  const fetchCourses = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      
      let coursesData: any[] = [];

      if (profile.role === 'student') {
        // Fetch exemptions first
        const { data: exemptions } = await supabase
          .from('student_course_exemptions')
          .select('section_course_id')
          .eq('student_id', profile.id);
        const exemptIds = exemptions?.map(e => e.section_course_id) || [];

        const { data: direct, error: dError } = await supabase
          .from('course_enrollments')
          .select(`
            enrolled_at,
            course:courses (
              *,
              teacher:profiles!courses_teacher_principal_id_fkey (
                id, first_name, last_name, email
              ),
              classroom:virtual_classrooms!courses_classroom_id_fkey (
                id, name, grade, education_level
              ),
              course_teachers (
                teacher:profiles (
                  id, first_name, last_name, email
                )
              )
            )
          `)
          .eq('student_id', profile.id)
          .eq('course.is_active', true);

        if (dError) throw dError;
        coursesData = direct?.map(e => ({
          ...(e.course as any),
          enrolled_at: e.enrolled_at,
          enrollment_status: 'enrolled'
        })) || [];

        // Fetch courses via student_sections
        const { data: sectionData, error: sError } = await supabase
          .from('student_sections')
          .select(`
            created_at,
            section:sections!inner (
              id, name, room_number,
              grade:academic_grades(name, level:academic_levels(name)),
              section_courses (
                id,
                teacher:profiles!section_courses_teacher_id_fkey (
                  id, first_name, last_name, email
                ),
                base:base_courses (
                  course:courses (
                    *,
                    teacher:profiles!courses_teacher_principal_id_fkey (
                      id, first_name, last_name, email
                    ),
                    classroom:virtual_classrooms!courses_classroom_id_fkey (
                      id, name, grade, education_level
                    ),
                    course_teachers (
                      teacher:profiles (
                        id, first_name, last_name, email
                      )
                    )
                  )
                )
              )
            )
          `)
          .eq('student_id', profile.id)
          .eq('is_active', true);
          
        if (!sError && sectionData && sectionData.length > 0) {
          setStudentSection(sectionData[0].section);
          sectionData.forEach(ss => {
            const scs = (ss.section as any)?.section_courses || [];
            scs.forEach((sc: any) => {
              const course = sc.base?.course;
              const isExempted = exemptIds.includes(sc.id);
              
              if (course && course.is_active && !isExempted && !coursesData.find(c => c.id === course.id)) {
                coursesData.push({
                  ...course,
                  teacher: course.teacher || sc.teacher,
                  enrolled_at: ss.created_at,
                  enrollment_status: 'enrolled'
                });
              }
            });
          });
        }

      } else if (profile.role === 'teacher') {
        const { data: primary, error: pError } = await supabase
          .from('courses')
          .select(`
            *,
            teacher:profiles!courses_teacher_principal_id_fkey (
              id, first_name, last_name, email
            ),
            classroom:virtual_classrooms!courses_classroom_id_fkey (
              id, name, grade, education_level
            ),
            course_teachers (
              teacher:profiles (
                id, first_name, last_name, email
              )
            )
          `)
          .eq('teacher_principal_id', profile.id)
          .eq('is_active', true);

        if (pError) throw pError;

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
              ),
              course_teachers (
                teacher:profiles (
                  id, first_name, last_name, email
                )
              )
            )
          `)
          .eq('teacher_id', profile.id)
          .eq('course.is_active', true);

        if (aError) throw aError;

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
                ),
                course_teachers (
                  teacher:profiles (
                    id, first_name, last_name, email
                  )
                )
              )
            )
          `)
          .eq('teacher_id', profile.id);

        if (scError) throw scError;

        const all = [
          ...(primary || []), 
          ...(additional?.map(a => a.course).filter(Boolean) || []),
          ...(sectionCourses?.map(sc => {
            if (sc.base?.course) {
              // Inject the current user as the teacher because they are assigned via section_courses
              sc.base.course.teacher = {
                id: profile.id,
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email
              };
              return sc.base.course;
            }
            return null;
          }).filter(Boolean) || [])
        ];
        
        // unique
        coursesData = all.reduce((acc, current) => {
          if (!acc.find((item: any) => item.id === current.id)) {
            acc.push(current);
          }
          return acc;
        }, []);

      } else {
        // admin / directivo
        const { data, error } = await supabase
          .from('courses')
          .select(`
            *,
            teacher:profiles!courses_teacher_principal_id_fkey (
              id, first_name, last_name, email
            ),
            classroom:virtual_classrooms!courses_classroom_id_fkey (
              id, name, grade, education_level
            ),
            course_teachers (
              teacher:profiles (
                id, first_name, last_name, email
              )
            )
          `)
          .eq('is_active', true);

        if (error) throw error;
        coursesData = data || [];
      }

      setCourses(coursesData);

    } catch (error) {
      console.error('Error fetching courses:', error);
      toast({
        title: "Error",
        description: "Error interno al cargar los cursos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      toast({
        title: "Curso eliminado",
        description: "El curso ha sido eliminado exitosamente",
      });

      fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el curso",
        variant: "destructive",
      });
    } finally {
      setCourseToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Mis Cursos</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground">Mis Cursos</h1>
            {profile?.role === 'teacher' && (
            <Button 
              className="bg-gradient-primary shadow-glow"
              onClick={() => navigate('/admin/courses')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Curso
            </Button>
            )}
          </div>
          {profile?.role === 'student' && studentSection && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-slate-100 w-fit px-3 py-1.5 rounded-full border">
              <School className="w-4 h-4 text-primary" />
              <span>
                Aula asignada: <strong className="text-foreground">{studentSection.grade?.name} "{studentSection.name}"</strong> 
                <span className="opacity-60 ml-1">({studentSection.grade?.level?.name})</span>
              </span>
            </div>
          )}
        </div>

      {courses.length === 0 ? (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay cursos disponibles
            </h3>
            <p className="text-muted-foreground">
              {profile?.role === 'student' 
                ? 'Aún no estás inscrito en ningún curso. Contacta a tu coordinador académico.'
                : 'Aún no has creado ningún curso. ¡Crea tu primer curso!'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all duration-300">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-foreground mb-1">
                      {course.name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {course.code}
                    </Badge>
                  </div>
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {course.description || 'Sin descripción disponible'}
                </p>
                
                <div className="space-y-3">
                  {/* Aula Virtual info for students */}
                  {profile?.role === 'student' && course.classroom && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="w-4 h-4" />
                      <span>{course.classroom.name} - {course.classroom.grade}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>
                      Prof. {
                        course.teacher?.first_name 
                          ? `${course.teacher.first_name} ${course.teacher.last_name || ''}` 
                          : course.course_teachers && course.course_teachers.length > 0
                            ? `${course.course_teachers[0].teacher.first_name} ${course.course_teachers[0].teacher.last_name || ''}`
                            : 'Sin asignar'
                      }
                    </span>
                  </div>
                  
                  {course.schedule && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 text-primary shrink-0" />
                      <span className="line-clamp-1">Horario: {course.schedule}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span>
                      Año Académico: {course.academic_year || new Date().getFullYear()}
                      {course.semester ? ` - ${course.semester}` : ''}
                    </span>
                  </div>

                  {/* Enrollment date for students */}
                  {profile?.role === 'student' && course.enrolled_at && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Inscrito: {new Date(course.enrolled_at).toLocaleDateString()}</span>
                    </div>
                  )}

                  {/* Student count for teachers and admins */}
                  {profile?.role !== 'student' && course.enrollments && course.enrollments[0] && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{course.enrollments[0].count} estudiantes</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-border/50 flex gap-2">
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => navigate(`/courses/${course.id}`)}
                  >
                    Ver Curso
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  {profile?.role === 'admin' && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCourseToDelete(course.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!courseToDelete} onOpenChange={() => setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el curso
              y todos los datos asociados (tareas, exámenes, asistencias, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => courseToDelete && handleDeleteCourse(courseToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Courses;