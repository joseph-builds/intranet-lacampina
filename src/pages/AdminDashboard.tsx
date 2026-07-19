import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, BookOpen, Activity, GraduationCap, UserCheck, 
  ShieldAlert, School, AlertTriangle, CheckCircle2, UserMinus, FileWarning, TrendingUp, Clock, ArrowUpRight, BookMarked
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

// --- INTERFACES ---
interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  current_grade_id: string | null;
  email: string;
  created_at: string;
}

interface Grade { id: string; name: string; level?: { name: string } }
interface Section { id: string; name: string; grade_id: string; tutor_id: string | null; }
interface StudentSection { student_id: string; section_id: string; }
interface SectionCourse { id: string; teacher_id: string | null; section_id: string; }

// Paleta de colores profesionales para gráficos
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const CURRENT_YEAR = new Date().getFullYear();

// --- FUNCIONES HELPER ---
const formatGradeLabel = (gradeName: string, levelName?: string) => {
  if (!levelName) return gradeName;
  const upperLevel = levelName.toUpperCase();
  let initial = '';
  if (upperLevel.includes('INICIAL')) initial = 'I';
  else if (upperLevel.includes('PRIMARIA')) initial = 'P';
  else if (upperLevel.includes('SECUNDARIA')) initial = 'S';
  else initial = upperLevel.charAt(0);
  
  return `${initial} - ${gradeName}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xl">
        <p className="font-bold text-slate-800 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium flex items-center gap-2" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // CONTROLADOR DE PESTAÑAS
  
  // Estados de datos crudos
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [studentSections, setStudentSections] = useState<StudentSection[]>([]);
  const [sectionCourses, setSectionCourses] = useState<SectionCourse[]>([]);
  const [totalCoursesBase, setTotalCoursesBase] = useState(0);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchMasterData();
    }
  }, [profile]);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const [
        { data: profilesData, error: profilesError },
        { data: gradesData },
        { data: sectionsData },
        { data: studentSectionsData },
        { data: sectionCoursesData },
        { count: coursesCount }
      ] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, role, is_active, current_grade_id, email, created_at').order('created_at', { ascending: false }),
        supabase.from('academic_grades').select('id, name, level:academic_levels(name)').order('grade_order'),
        supabase.from('sections').select('id, name, grade_id, tutor_id').eq('academic_year', CURRENT_YEAR),
        supabase.from('student_sections').select('student_id, section_id').eq('academic_year', CURRENT_YEAR),
        supabase.from('section_courses').select('id, teacher_id, section_id'),
        supabase.from('base_courses').select('*', { count: 'exact', head: true })
      ]);

      if (profilesError) throw profilesError;

      setProfiles(profilesData || []);
      setGrades(gradesData || []);
      setSections(sectionsData || []);
      setStudentSections(studentSectionsData || []);
      setSectionCourses(sectionCoursesData || []);
      setTotalCoursesBase(coursesCount || 0);

    } catch (error) {
      console.error('Error fetching master data:', error);
      toast({ title: "Error de Sincronización", description: "No se pudieron cargar los datos del sistema.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- MOTOR DE INTELIGENCIA Y CÁLCULOS ---
  const activeProfiles = useMemo(() => profiles.filter(p => p.is_active), [profiles]);
  const activeStudents = useMemo(() => activeProfiles.filter(p => p.role === 'student'), [activeProfiles]);
  const activeTeachers = useMemo(() => activeProfiles.filter(p => p.role === 'teacher'), [activeProfiles]);
  const activeTutors = useMemo(() => activeProfiles.filter(p => p.role === 'tutor'), [activeProfiles]);
  const inactiveProfiles = useMemo(() => profiles.filter(p => !p.is_active), [profiles]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newUsersThisMonth = profiles.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length;

  // --- ALERTAS CRÍTICAS ---
  const studentsWithoutGrade = useMemo(() => activeStudents.filter(s => !s.current_grade_id), [activeStudents]);
  const studentsWithoutSection = useMemo(() => activeStudents.filter(s => s.current_grade_id && !studentSections.some(ss => ss.student_id === s.id)), [activeStudents, studentSections]);
  const tutorsWithoutSection = useMemo(() => activeTutors.filter(t => !sections.some(s => s.tutor_id === t.id)), [activeTutors, sections]);
  const teachersWithoutCourses = useMemo(() => activeTeachers.filter(t => !sectionCourses.some(sc => sc.teacher_id === t.id)), [activeTeachers, sectionCourses]);
  
  const totalAlerts = studentsWithoutGrade.length + studentsWithoutSection.length + tutorsWithoutSection.length + teachersWithoutCourses.length;

  // --- DATOS PARA GRÁFICOS ---
  const roleDistributionData = [
    { name: 'Estudiantes', value: activeStudents.length },
    { name: 'Profesores', value: activeTeachers.length },
    { name: 'Tutores', value: activeTutors.length },
    { name: 'Administradores', value: activeProfiles.length - activeStudents.length - activeTeachers.length - activeTutors.length },
  ].filter(item => item.value > 0);

  const studentsPerGradeData = useMemo(() => {
    return grades.map(grade => {
      const studentsInThisGrade = activeStudents.filter(s => 
        s.current_grade_id === grade.id && studentSections.some(ss => ss.student_id === s.id)
      ).length;
      return { 
        name: formatGradeLabel(grade.name, grade.level?.name), 
        Estudiantes: studentsInThisGrade 
      };
    }).filter(data => data.Estudiantes > 0); // Solo mostramos grados que tienen alumnos para limpiar el gráfico
  }, [grades, activeStudents, studentSections]);

  const systemHealth = Math.round((activeProfiles.length / (profiles.length || 1)) * 100);

  // --- RENDERIZADO DE SEGURIDAD ---
  if (profile?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center space-y-4">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
            <h1 className="text-3xl font-bold text-gray-800">Acceso Restringido</h1>
            <p className="text-gray-500">Privilegios insuficientes para el centro de mando.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-6 animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
          <div className="h-[400px] bg-gray-200 rounded-xl mt-6"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-[1400px]">
        
        {/* HEADER DEL DASHBOARD */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-xl border shadow-sm">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Centro de Mando Educativo</h1>
            <p className="text-gray-500 mt-1 flex items-center gap-2 font-medium">
              <Activity className="w-4 h-4 text-green-500" /> Año Escolar Operativo: <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{CURRENT_YEAR}</Badge>
            </p>
          </div>
          <div className="flex items-center gap-6">
            {totalAlerts > 0 && (
              <Badge variant="destructive" className="px-3 py-1.5 text-sm animate-pulse flex items-center gap-2 cursor-pointer shadow-md" onClick={() => setActiveTab("alerts")}>
                <AlertTriangle className="w-4 h-4"/> {totalAlerts} Alertas Críticas
              </Badge>
            )}
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border shadow-inner">
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Salud del Sistema</p>
                <p className={`text-sm font-black ${systemHealth >= 90 ? 'text-green-600' : 'text-amber-500'}`}>
                  {systemHealth}% Usuarios Activos
                </p>
              </div>
              <Progress value={systemHealth} className="w-24 h-2.5 bg-gray-200 rounded-full" indicatorColor={systemHealth >= 90 ? 'bg-green-500' : 'bg-amber-500'} />
            </div>
          </div>
        </div>

        {/* PESTAÑAS CONTROLADAS POR ESTADO */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border shadow-sm p-1 rounded-lg">
            <TabsTrigger value="overview" className="text-sm font-medium rounded-md">Resumen Directivo</TabsTrigger>
            <TabsTrigger value="analytics" className="text-sm font-medium rounded-md">Analítica Académica</TabsTrigger>
            <TabsTrigger value="alerts" className="text-sm font-medium rounded-md relative">
              Centro de Alertas
              {totalAlerts > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-bounce"></span>}
            </TabsTrigger>
          </TabsList>

          {/* ==========================================
              PESTAÑA 1: RESUMEN DIRECTIVO
             ========================================== */}
          <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-0 shadow-md hover:-translate-y-1 transition-transform duration-300 bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 text-white overflow-hidden relative">
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4"><GraduationCap className="w-32 h-32"/></div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
                  <CardTitle className="text-sm font-bold text-blue-100 uppercase tracking-wider">Estudiantes Activos</CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="text-4xl font-black">{activeStudents.length}</div>
                  <div className="flex items-center mt-2 text-sm text-blue-200 font-medium bg-blue-800/40 w-fit px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    <span>{studentSections.length} matriculados en aulas</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md hover:-translate-y-1 transition-transform duration-300 bg-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">Plana Docente</CardTitle>
                  <div className="p-2 bg-purple-100 rounded-lg"><UserCheck className="h-5 w-5 text-purple-600" /></div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-gray-800">{activeTeachers.length}</div>
                  <p className="text-sm text-gray-500 mt-2 font-medium flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-purple-400"/> +{activeTutors.length} Tutores de aula
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md hover:-translate-y-1 transition-transform duration-300 bg-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">Aulas Operativas</CardTitle>
                  <div className="p-2 bg-amber-100 rounded-lg"><School className="h-5 w-5 text-amber-600" /></div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-gray-800">{sections.length}</div>
                  <p className="text-sm text-gray-500 mt-2 font-medium flex items-center gap-1">
                    <BookMarked className="w-3.5 h-3.5 text-amber-400"/> Salones virtuales creados
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md hover:-translate-y-1 transition-transform duration-300 bg-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">Cursos Base</CardTitle>
                  <div className="p-2 bg-emerald-100 rounded-lg"><BookOpen className="h-5 w-5 text-emerald-600" /></div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-gray-800">{totalCoursesBase}</div>
                  <p className="text-sm text-gray-500 mt-2 font-medium flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400"/> Materias en la currícula
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Accesos Rápidos y Resumen de Alertas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <Card className={`lg:col-span-2 border-0 shadow-sm border-t-4 ${totalAlerts > 0 ? 'border-t-red-500 bg-red-50/30' : 'border-t-green-500 bg-green-50/30'}`}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${totalAlerts > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {totalAlerts > 0 ? <FileWarning className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>} 
                    Visión General de Anomalías
                  </CardTitle>
                  <CardDescription>
                    {totalAlerts > 0 ? 'Resumen de usuarios que requieren asignación inmediata en el sistema.' : 'El sistema se encuentra perfectamente configurado.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                      <p className={`text-3xl font-black ${studentsWithoutGrade.length > 0 ? 'text-red-600' : 'text-gray-300'}`}>{studentsWithoutGrade.length}</p>
                      <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-wide">Alumnos<br/>Sin Grado</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                      <p className={`text-3xl font-black ${studentsWithoutSection.length > 0 ? 'text-orange-600' : 'text-gray-300'}`}>{studentsWithoutSection.length}</p>
                      <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-wide">Alumnos<br/>Sin Aula</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                      <p className={`text-3xl font-black ${tutorsWithoutSection.length > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{tutorsWithoutSection.length}</p>
                      <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-wide">Tutores<br/>En Espera</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                      <p className={`text-3xl font-black ${teachersWithoutCourses.length > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{teachersWithoutCourses.length}</p>
                      <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-wide">Profesores<br/>Sin Cursos</p>
                    </div>
                  </div>
                  {totalAlerts > 0 && (
                    <div className="mt-6 text-right">
                      {/* BOTÓN REPARADO: Ahora usa el State de React en lugar de document.querySelector */}
                      <Button className="bg-red-600 hover:bg-red-700 text-white shadow-md transition-all hover:scale-105" onClick={() => setActiveTab("alerts")}>
                        Resolver Alertas Ahora <ArrowUpRight className="w-4 h-4 ml-2"/>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-indigo-500"/> Últimos Ingresos</CardTitle>
                  <CardDescription>Usuarios añadidos recientemente a la plataforma.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  <div className="space-y-3">
                    {profiles.slice(0, 5).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-100">
                        <div>
                          <p className="text-sm font-bold text-slate-800 line-clamp-1">{user.last_name}, {user.first_name}</p>
                          <p className="text-[10px] text-slate-500">{new Date(user.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge variant="outline" className={
                          user.role === 'student' ? 'bg-green-50 text-green-700 border-green-200' : 
                          user.role === 'teacher' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                          user.role === 'tutor' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                          'bg-red-50 text-red-700 border-red-200'
                        }>
                          {user.role}
                        </Badge>
                      </div>
                    ))}
                    {profiles.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No hay registros recientes.</p>}
                  </div>
                </CardContent>
                <div className="p-4 border-t bg-gray-50 rounded-b-xl mt-auto">
                  <Button variant="outline" className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-indigo-200" onClick={() => window.location.href = '/admin/users'}>
                    Ver Directorio Completo <ArrowUpRight className="w-4 h-4 ml-2"/>
                  </Button>
                </div>
              </Card>

            </div>
          </TabsContent>


          {/* ==========================================
              PESTAÑA 2: ANALÍTICA ACADÉMICA
             ========================================== */}
          <TabsContent value="analytics" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Gráfico de Barras: Estudiantes por Grado */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Densidad Poblacional por Grado</CardTitle>
                  <CardDescription>Cantidad de alumnos efectivamente matriculados en aulas por grado/nivel.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[380px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={studentsPerGradeData} margin={{ top: 20, right: 30, left: -20, bottom: 80 }}>
                        <defs>
                          <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.7}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 500}} angle={-45} textAnchor="end" />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="Estudiantes" fill="url(#colorStudents)" radius={[6, 6, 0, 0]} barSize={35} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico Circular: Distribución de Roles */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Composición del Ecosistema</CardTitle>
                  <CardDescription>Distribución porcentual de los usuarios activos en la plataforma.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-[380px] relative">
                  {/* Texto en el centro de la dona */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                    <span className="text-4xl font-black text-slate-800">{activeProfiles.length}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Activos</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={roleDistributionData} 
                        cx="50%" cy="50%" 
                        innerRadius={90} outerRadius={130} 
                        paddingAngle={6} 
                        dataKey="value"
                        stroke="none"
                      >
                        {roleDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}/>
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

            </div>
          </TabsContent>


          {/* ==========================================
              PESTAÑA 3: CENTRO DE ALERTAS
             ========================================== */}
          <TabsContent value="alerts" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {totalAlerts === 0 ? (
              <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <h2 className="text-3xl font-black text-green-800 mb-2">¡Ecosistema Perfecto!</h2>
                  <p className="text-green-600 max-w-md font-medium">Todos los alumnos, profesores y tutores activos están correctamente asignados. La base de datos no presenta anomalías estructurales.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* ALERTA: ALUMNOS SIN AULA/GRADO */}
                {(studentsWithoutGrade.length > 0 || studentsWithoutSection.length > 0) && (
                  <Card className="border-0 shadow-md border-t-4 border-t-red-500 overflow-hidden">
                    <CardHeader className="bg-red-50/50 pb-4 border-b border-red-100">
                      <CardTitle className="text-lg text-red-800 flex items-center gap-2">
                        <UserMinus className="w-5 h-5"/> Estudiantes Sin Aula Asignada
                      </CardTitle>
                      <CardDescription className="text-red-600/70 font-medium">Estos alumnos no podrán ver tareas ni interactuar en la plataforma.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-white sticky top-0 shadow-sm">
                            <TableRow>
                              <TableHead className="font-bold">Estudiante</TableHead>
                              <TableHead className="font-bold text-right">Problema Detectado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-red-50">
                            {/* Alumnos sin grado */}
                            {studentsWithoutGrade.map(s => (
                              <TableRow key={s.id} className="hover:bg-red-50/30">
                                <TableCell className="font-semibold text-slate-800">{s.last_name}, {s.first_name}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200">Falta Grado</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Alumnos con grado pero sin sección */}
                            {studentsWithoutSection.map(s => {
                              const grade = grades.find(g => g.id === s.current_grade_id);
                              const formattedLabel = grade ? formatGradeLabel(grade.name, grade.level?.name) : 'Desconocido';
                              return (
                                <TableRow key={s.id} className="hover:bg-orange-50/30">
                                  <TableCell className="font-semibold text-slate-800">{s.last_name}, {s.first_name}</TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                      En {formattedLabel}, sin Aula
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="p-3 bg-gray-50 border-t text-center">
                        <Button variant="link" className="text-blue-600 h-auto p-0" onClick={() => window.location.href = '/admin/classrooms'}>Ir a distribuir aulas →</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ALERTA: TUTORES SIN AULA */}
                {tutorsWithoutSection.length > 0 && (
                  <Card className="border-0 shadow-md border-t-4 border-t-amber-500 overflow-hidden">
                    <CardHeader className="bg-amber-50/50 pb-4 border-b border-amber-100">
                      <CardTitle className="text-lg text-amber-800 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5"/> Tutores en Espera
                      </CardTitle>
                      <CardDescription className="text-amber-700/70 font-medium">Tutores activos que aún no supervisan ningún aula virtual.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-white sticky top-0 shadow-sm">
                            <TableRow>
                              <TableHead className="font-bold">Tutor</TableHead>
                              <TableHead className="font-bold">Correo de Contacto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-amber-50">
                            {tutorsWithoutSection.map(t => (
                              <TableRow key={t.id} className="hover:bg-amber-50/30">
                                <TableCell className="font-semibold text-slate-800">{t.last_name}, {t.first_name}</TableCell>
                                <TableCell className="text-slate-500 text-sm">{t.email}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="p-3 bg-gray-50 border-t text-center">
                        <Button variant="link" className="text-blue-600 h-auto p-0" onClick={() => window.location.href = '/admin/classrooms'}>Asignar tutores a aulas →</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ALERTA: PROFESORES SIN CURSOS */}
                {teachersWithoutCourses.length > 0 && (
                  <Card className="border-0 shadow-md border-t-4 border-t-blue-500 overflow-hidden">
                    <CardHeader className="bg-blue-50/50 pb-4 border-b border-blue-100">
                      <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
                        <BookOpen className="w-5 h-5"/> Profesores Sin Carga Académica
                      </CardTitle>
                      <CardDescription className="text-blue-700/70 font-medium">Docentes activos sin cursos asignados en la malla del año actual.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-white sticky top-0 shadow-sm">
                            <TableRow>
                              <TableHead className="font-bold">Profesor</TableHead>
                              <TableHead className="font-bold text-right">Estado Actual</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-blue-50">
                            {teachersWithoutCourses.map(t => (
                              <TableRow key={t.id} className="hover:bg-blue-50/30">
                                <TableCell className="font-semibold text-slate-800">{t.last_name}, {t.first_name}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Sin materias dictadas</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="p-3 bg-gray-50 border-t text-center">
                        <Button variant="link" className="text-blue-600 h-auto p-0" onClick={() => window.location.href = '/admin/classrooms'}>Ir a vincular profesores →</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;