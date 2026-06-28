// ...existing code...
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StudentCourses } from "@/components/dashboard/StudentCourses";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Notifications } from "@/components/Notifications";
import { AcademicCalendar } from "@/components/calendar/AcademicCalendar";
import { BookOpen, FileText, GraduationCap, TrendingUp, User, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-education.jpg";
import { Link } from "react-router-dom";

interface DashboardStats {
  coursesCount: number;
  pendingAssignments: number;
  upcomingExams: number;
  attendanceRate: number;
}


const Index = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(() => {
    // Try to load cached stats
    const cached = sessionStorage.getItem('dashboardStats');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return {
          coursesCount: 0,
          pendingAssignments: 0,
          upcomingExams: 0,
          attendanceRate: 0,
        };
      }
    }
    return {
      coursesCount: 0,
      pendingAssignments: 0,
      upcomingExams: 0,
      attendanceRate: 0,
    };
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardStats();
    }
  }, [profile]);

  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);

      // Execute all queries in parallel for better performance
      const [
        { count: coursesCount },
        { data: enrollments },
        { data: attendance }
      ] = await Promise.all([
        supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', profile!.id),
        supabase
          .from('course_enrollments')
          .select('modulo_id')
          .eq('student_id', profile!.id),
        supabase
          .from('attendance')
          .select('status')
          .eq('student_id', profile!.id)
      ]);

      const courseIds = enrollments?.map(e => e.modulo_id) || [];

      // Calculate attendance rate
      let attendanceRate = 0;
      if (attendance && attendance.length > 0) {
        const presentCount = attendance.filter(a => 
          a.status === 'present' || a.status === 'late'
        ).length;
        attendanceRate = Math.round((presentCount / attendance.length) * 100);
      }

      // Only fetch assignments and exams if student has courses
      let pendingAssignments = 0;
      let upcomingExams = 0;

      if (courseIds.length > 0) {
        const [
          { data: assignments },
          { count: examsCount }
        ] = await Promise.all([
          supabase
            .from('assignments')
            .select('id')
            .in('course_id', courseIds)
            .eq('is_published', true)
            .gt('due_date', new Date().toISOString()),
          supabase
            .from('exams')
            .select('*', { count: 'exact', head: true })
            .in('course_id', courseIds)
            .eq('is_published', true)
            .gt('start_time', new Date().toISOString())
        ]);

        upcomingExams = examsCount || 0;

        const assignmentIds = assignments?.map(a => a.id) || [];

        if (assignmentIds.length > 0) {
          const { data: submissions } = await supabase
            .from('assignment_submissions')
            .select('assignment_id')
            .eq('student_id', profile!.id)
            .in('assignment_id', assignmentIds);

          const submittedIds = new Set(submissions?.map(s => s.assignment_id) || []);
          pendingAssignments = assignmentIds.filter(id => !submittedIds.has(id)).length;
        }
      }

      setStats({
        coursesCount: coursesCount || 0,
        pendingAssignments,
        upcomingExams,
        attendanceRate,
      });
      
      // Cache the stats for faster subsequent loads
      sessionStorage.setItem('dashboardStats', JSON.stringify({
        coursesCount: coursesCount || 0,
        pendingAssignments,
        upcomingExams,
        attendanceRate,
      }));
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Helpers para mensaje de bienvenida y subtítulo (dentro del componente para acceso a profile)
  const getWelcomeMessage = () => {
    const name = profile ? profile.first_name : 'Usuario';
    return `¡Bienvenido, ${name}!`;
  };

  const getSubtitle = () => {
    return 'Plataforma Educativa - IE La Campiña';
  };

  // Redirigir a dashboards específicos según el rol
  if (profile?.role === 'parent') {
    return <Navigate to="/parent/admin" replace />;
  }

  if (profile?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (profile?.role === 'directivo') {
    return <Navigate to="/directivo-dashboard" replace />;
  }

  if (profile?.role === 'tutor') {
    return <Navigate to="/tutor-dashboard" replace />;
  }

  // Vista original para estudiantes y profesores
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-8 text-white shadow-glow">
          <div className="absolute inset-0 opacity-20">
            <img 
              src={heroImage} 
              alt="Educación virtual IE La Campiña" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <GraduationCap className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">{getWelcomeMessage()}</h1>
                <p className="text-white/90">{getSubtitle()}</p>
              </div>
            </div>
            <p className="text-lg text-white/90 max-w-2xl">
              {(profile?.role as string) === 'teacher'
                ? 'Gestiona tus cursos, evalúa a tus estudiantes y mantente conectado con la comunidad educativa.'
                : (profile?.role as string) === 'admin'
                ? 'Administra la plataforma educativa y supervisa el progreso académico institucional.'
                : (profile?.role as string) === 'parent'
                ? 'Mantente informado sobre el progreso académico de tus hijos y la vida escolar.'
                : 'Accede a tus cursos, completa tus tareas y mantente conectado con tu educación desde cualquier lugar.'
              }
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Mis Cursos"
            value={loadingStats ? "..." : stats.coursesCount.toString()}
            icon={BookOpen}
            description="Cursos inscritos"
            color="primary"
          />
          <StatsCard
            title="Tareas Pendientes"
            value={loadingStats ? "..." : stats.pendingAssignments.toString()}
            icon={FileText}
            description="Por entregar próximamente"
            color="accent"
          />
          <StatsCard
            title="Exámenes Próximos"
            value={loadingStats ? "..." : stats.upcomingExams.toString()}
            icon={TrendingUp}
            description="Próximos a rendir"
            color="secondary"
          />
          <StatsCard
            title="Asistencia"
            value={loadingStats ? "..." : `${stats.attendanceRate}%`}
            icon={GraduationCap}
            description="Tasa de asistencia"
            color="primary"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <StudentCourses />
            <RecentActivity />
          </div>
          
          {/* Right Column */}
          <div className="space-y-6">
            <QuickActions />
            
            {/* Calendar Section */}
            <div>
              <AcademicCalendar />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Index;
