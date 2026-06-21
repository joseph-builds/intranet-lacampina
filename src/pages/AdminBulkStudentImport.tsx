import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BulkStudentImport } from '@/components/students/BulkStudentImport';
import { Loader2, School, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

interface VirtualClassroom {
  id: string;
  name: string;
  grade: string;
  section: string;
  academic_year: string;
  education_level: string;
  is_active: boolean;
  teacher_id: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
  courses?: { count: number }[];
  enrollments?: { count: number }[];
}

const AdminBulkStudentImport = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [classrooms, setClassrooms] = useState<VirtualClassroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState<VirtualClassroom | null>(null);

  if (profile?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-8 text-center">
              <div className="text-destructive text-lg font-semibold mb-2">
                Acceso Denegado
              </div>
              <p className="text-muted-foreground">
                Solo los administradores pueden acceder a esta sección.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('virtual_classrooms')
        .select(`
          *,
          profiles!virtual_classrooms_teacher_id_fkey (first_name, last_name),
          courses (count)
        `)
        .eq('is_active', true)
        .order('academic_year', { ascending: false })
        .order('grade', { ascending: true });

      if (error) {
        console.error('Error fetching classrooms:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las aulas virtuales",
          variant: "destructive",
        });
      } else {
        // Fetch unique student counts separately
        const classroomsWithEnrollments = await Promise.all(
          (data || []).map(async (classroom) => {
            const { data: courses } = await supabase
              .from('courses')
              .select('id')
              .eq('classroom_id', classroom.id);
            
            const courseIds = courses?.map(c => c.id) || [];
            
            if (courseIds.length > 0) {
              const { data: enrollments } = await supabase
                .from('course_enrollments')
                .select('student_id')
                .in('modulo_id', courseIds);
              
              // Count unique students
              const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []);
              
              return { ...classroom, enrollments: [{ count: uniqueStudents.size }] };
            }
            
            return { ...classroom, enrollments: [{ count: 0 }] };
          })
        );
        
        setClassrooms(classroomsWithEnrollments as VirtualClassroom[]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEnrollmentCount = (classroom: VirtualClassroom): number => {
    return classroom.enrollments?.[0]?.count || 0;
  };

  const getCourseCount = (classroom: VirtualClassroom): number => {
    return classroom.courses?.[0]?.count || 0;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Importación Masiva de Estudiantes</h1>
        <p className="text-muted-foreground">
          Selecciona un aula virtual y carga el archivo Excel con los datos de los estudiantes
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {classrooms.map((classroom) => (
          <Card
            key={classroom.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedClassroom?.id === classroom.id
                ? 'ring-2 ring-primary shadow-lg'
                : ''
            }`}
            onClick={() => setSelectedClassroom(classroom)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <School className="h-5 w-5" />
                  {classroom.name}
                </div>
                <Badge variant={classroom.is_active ? 'default' : 'secondary'}>
                  {classroom.is_active ? 'Activa' : 'Inactiva'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Grado:</span>
                <span className="font-medium">{classroom.grade}{classroom.section}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nivel:</span>
                <span className="font-medium capitalize">{classroom.education_level}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Año:</span>
                <span className="font-medium">{classroom.academic_year}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cursos:</span>
                <span className="font-medium">{getCourseCount(classroom)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  <Users className="h-3 w-3 inline mr-1" />
                  Estudiantes:
                </span>
                <span className="font-medium">{getEnrollmentCount(classroom)}</span>
              </div>
              {classroom.profiles && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Tutor: {classroom.profiles.first_name} {classroom.profiles.last_name}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {classrooms.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <School className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No hay aulas virtuales activas disponibles
            </p>
          </CardContent>
        </Card>
      )}

      {selectedClassroom && (
        <div className="mt-8">
          <BulkStudentImport
            classroom={selectedClassroom}
            onImportComplete={fetchClassrooms}
          />
        </div>
      )}
      </div>
    </DashboardLayout>
  );
};

export default AdminBulkStudentImport;
