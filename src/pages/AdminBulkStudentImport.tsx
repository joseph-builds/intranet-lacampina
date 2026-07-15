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
      // 1. Traer solo los campos core que sí existen 100% en la tabla 'modulos'
      const { data: modulosData, error } = await supabase
        .from('modulos')
        .select('id, name, teacher_principal_id, is_active, academic_year')
        .eq('is_active', true)
        .order('name', { ascending: true }); // Ordenamos por name que es seguro

      if (error) throw error;

      // 2. Traer perfiles de profesores/tutores de forma asíncrona
      const teacherIds = [...new Set(modulosData?.map(m => m.teacher_principal_id).filter(Boolean))];
      let profilesMap = new Map();
      
      if (teacherIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', teacherIds);
          
        profilesData?.forEach(p => profilesMap.set(p.id, p));
      }

      // 3. Traer conteo de estudiantes matriculados
      const moduloIds = modulosData?.map(m => m.id) || [];
      let enrollmentsMap = new Map();
      
      if (moduloIds.length > 0) {
        const { data: enrollmentsData } = await supabase
          .from('course_enrollments')
          .select('modulo_id, student_id')
          .in('modulo_id', moduloIds);

        if (enrollmentsData) {
          enrollmentsData.forEach(e => {
            if (!enrollmentsMap.has(e.modulo_id)) {
              enrollmentsMap.set(e.modulo_id, new Set());
            }
            enrollmentsMap.get(e.modulo_id).add(e.student_id);
          });
        }
      }

      // 4. Mapear los datos simulando los campos de grado/sección para que la UI no se rompa
      const formattedClassrooms = modulosData?.map(modulo => {
        const teacherInfo = profilesMap.get(modulo.teacher_principal_id);
        const uniqueStudentsCount = enrollmentsMap.get(modulo.id)?.size || 0;

        return {
          ...modulo,
          grade: 'Módulo ', // Quitamos el fallback al campo 'grade' inexistente
          section: 'Único',  // Fallback seguro
          education_level: 'General',
          teacher_id: modulo.teacher_principal_id,
          profiles: teacherInfo || null,
          enrollments: [{ count: uniqueStudentsCount }],
          courses: [{ count: 1 }]
        };
      }) || [];

      setClassrooms(formattedClassrooms as any);

    } catch (error: any) {
      console.error('Error fetching classrooms:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de las aulas",
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
                <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
                  Tutor/Profesor: {classroom.profiles.first_name} {classroom.profiles.last_name}
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