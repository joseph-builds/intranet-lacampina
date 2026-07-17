import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Users, BookOpen, FileText, Activity, GraduationCap, UserCheck } from 'lucide-react';

// Se eliminaron las importaciones innecesarias de otros componentes (Tabs, TestForm, AdminStudentManagement, etc.)

interface AdminStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalCourses: number;
  totalAssignments: number;
  activeUsers: number;
}

const AdminDashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalParents: 0,
    totalCourses: 0,
    totalAssignments: 0,
    activeUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchAdminStats();
    }
  }, [profile]);

  const fetchAdminStats = async () => {
    try {
      // 1. Obtener conteo de usuarios por rol
      const { data: usersData } = await supabase
        .from('profiles')
        .select('role, is_active');

      // 2. Obtener conteo exacto de cursos (Corregido usando count)
      const { count: coursesCount, error: coursesError } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true });

      // 3. Obtener conteo exacto de tareas (Corregido usando count)
      const { count: assignmentsCount, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true });

      if (usersData) {
        const totalUsers = usersData.length;
        const totalStudents = usersData.filter(u => u.role === 'student').length;
        const totalTeachers = usersData.filter(u => u.role === 'teacher').length;
        const totalParents = usersData.filter(u => u.role === 'parent').length;
        const activeUsers = usersData.filter(u => u.is_active).length;

        setStats({
          totalUsers,
          totalStudents,
          totalTeachers,
          totalParents,
          totalCourses: coursesCount || 0,       // <-- Sincronizado correctamente
          totalAssignments: assignmentsCount || 0, // <-- Sincronizado correctamente
          activeUsers
        });
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas del sistema",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <h1 className="text-2xl font-bold text-red-600">Acceso Denegado</h1>
              <p className="mt-2 text-gray-600">No tienes permisos para acceder al panel de administración.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="mt-2 text-gray-600">
            Gestiona usuarios, cursos y contenido de La Campiña
          </p>
        </div>

        {/* Estadísticas Globales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "Total Usuarios",
              value: stats.totalUsers,
              icon: Users,
              description: "Usuarios registrados en el sistema",
              color: "text-blue-600"
            },
            {
              title: "Estudiantes",
              value: stats.totalStudents,
              icon: GraduationCap,
              description: "Estudiantes activos",
              color: "text-green-600"
            },
            {
              title: "Profesores",
              value: stats.totalTeachers,
              icon: UserCheck,
              description: "Profesores registrados",
              color: "text-purple-600"
            },
            {
              title: "Cursos",
              value: stats.totalCourses,
              icon: BookOpen,
              description: "Cursos disponibles",
              color: "text-indigo-600"
            }
          ].map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <IconComponent className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Paneles Informativos Inferiores */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Actividad Reciente */}
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>
                Últimas acciones en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">Usuario</Badge>
                    <span className="text-sm">Nuevo estudiante registrado</span>
                  </div>
                  <span className="text-xs text-gray-500">Hace 2 horas</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">Curso</Badge>
                    <span className="text-sm">Curso actualizado</span>
                  </div>
                  <span className="text-xs text-gray-500">Hace 5 horas</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">Tarea</Badge>
                    <span className="text-sm">Nueva tarea asignada</span>
                  </div>
                  <span className="text-xs text-gray-500">Hace 1 día</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acciones Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
              <CardDescription>
                Tareas administrativas comunes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline" onClick={() => window.location.href = '/admin/users'}>
                <Users className="mr-2 h-4 w-4" />
                Ir a Gestión de Usuarios
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => window.location.href = '/admin/courses'}>
                <BookOpen className="mr-2 h-4 w-4" />
                Ir a Gestión de Cursos
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => window.location.href = '/admin/students'}>
                <GraduationCap className="mr-2 h-4 w-4" />
                Ir a Gestión de Estudiantes
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={fetchAdminStats}
              >
                <Activity className="mr-2 h-4 w-4" />
                Actualizar estadísticas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;