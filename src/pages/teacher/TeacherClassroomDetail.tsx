import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Users, BookOpen, GraduationCap, Mail } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from 'sonner';

interface SectionInfo {
  id: string;
  name: string;
  room_number: string;
  grade_name: string;
  level_name: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
}

const TeacherClassroomDetail = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [section, setSection] = useState<SectionInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClassroomDetails();
  }, [id, profile]);

  const fetchClassroomDetails = async () => {
    if (!profile?.id || !id) return;

    try {
      setLoading(true);

      // 1. Fetch Section Info
      const { data: sectionData, error: sectionError } = await supabase
        .from('sections')
        .select(`
          id, name, room_number,
          grade:academic_grades (name, level:academic_levels(name))
        `)
        .eq('id', id)
        .single();

      if (sectionError) throw sectionError;

      setSection({
        id: sectionData.id,
        name: sectionData.name,
        room_number: sectionData.room_number || 'No asignado',
        grade_name: sectionData.grade?.name || 'Sin grado',
        level_name: sectionData.grade?.level?.name || 'Sin nivel'
      });

      // 2. Fetch Students in this section
      const { data: studentsData, error: studentsError } = await supabase
        .from('student_sections')
        .select(`
          student:profiles!student_id (id, first_name, last_name, email, avatar_url)
        `)
        .eq('section_id', id);

      if (studentsError) throw studentsError;

      const mappedStudents = (studentsData || [])
        .map(item => item.student as unknown as Student)
        .filter(Boolean)
        .sort((a, b) => a.last_name.localeCompare(b.last_name));
        
      setStudents(mappedStudents);

      // 3. Fetch specific courses THIS teacher teaches in THIS section
      const { data: coursesData, error: coursesError } = await supabase
        .from('section_courses')
        .select(`
          base_course:base_courses (
            course:courses (id, name, code, description)
          )
        `)
        .eq('section_id', id)
        .eq('teacher_id', profile.id);

      if (coursesError) throw coursesError;

      const mappedCourses = (coursesData || [])
        .map(item => (item.base_course as any)?.course)
        .filter(Boolean);
        
      setCourses(mappedCourses);

    } catch (error: any) {
      console.error('Error fetching classroom details:', error);
      toast.error('Error al cargar los detalles del aula');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-full flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!section) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Aula no encontrada</p>
          <Button onClick={() => navigate('/teacher/classrooms')} className="mt-4">
            Volver a mis aulas
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <Button variant="ghost" onClick={() => navigate('/teacher/classrooms')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a mis aulas
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {section.grade_name} "{section.name}"
            </h1>
            <p className="text-muted-foreground mt-1">
              {section.level_name} • Aula Física: {section.room_number}
            </p>
          </div>
        </div>

        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Alumnos
            </TabsTrigger>
            <TabsTrigger value="courses" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Mis Cursos
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="students" className="mt-6">
            <Card className="border-0 shadow-card bg-gradient-card">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  Alumnos Matriculados ({students.length})
                </CardTitle>
                <CardDescription>
                  Listado de alumnos de esta sección.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">No hay alumnos en esta sección.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {students.map((student) => (
                      <div key={student.id} className="flex items-center gap-4 p-4 rounded-xl bg-white border hover:shadow-md transition-shadow">
                        <Avatar className="h-12 w-12 border-2 border-primary/10">
                          <AvatarImage src={student.avatar_url || ''} />
                          <AvatarFallback className="bg-primary/5 text-primary font-semibold">
                            {student.first_name?.[0]}{student.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {student.last_name}, {student.first_name}
                          </p>
                          <div className="flex items-center text-xs text-muted-foreground mt-1 gap-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{student.email}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="courses" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.length === 0 ? (
                <div className="col-span-full text-center py-10 bg-white rounded-xl border border-dashed">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-muted-foreground">No tienes cursos asignados a ti en esta sección.</p>
                </div>
              ) : (
                courses.map((course) => (
                  <Card key={course.id} className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate(`/courses/${course.id}`)}>
                    <CardHeader>
                      <CardTitle className="text-xl text-primary">{course.name}</CardTitle>
                      <CardDescription>Código: {course.code}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {course.description || "Sin descripción proporcionada para este curso."}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TeacherClassroomDetail;
