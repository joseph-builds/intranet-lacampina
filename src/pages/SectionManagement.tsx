import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, BookOpen, Users, RefreshCw, GraduationCap, MinusCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const SectionManagement = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]); 

  useEffect(() => {
    if (sectionId) loadAllData();
  }, [sectionId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Sección y datos del grado asociado
      const { data: secData, error: secErr } = await supabase
        .from('sections')
        .select('*, tutor:profiles!tutor_id(*), grade:academic_grades(name, level:academic_levels(name))')
        .eq('id', sectionId)
        .single();
      if (secErr) throw secErr;
      setSection(secData);

      // 2. Cargar Todo el Staff Educativo Activo (Teachers, Tutors y Admins)
      const { data: staffData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('role', ['teacher', 'tutor', 'admin'])
        .eq('is_active', true)
        .order('first_name');
      setStaff(staffData || []);

      // 3. Cargar Cursos de esta sección (Solo cursos base activos)
      const { data: coursesData } = await supabase
        .from('section_courses')
        .select('id, teacher_id, base:base_courses(name, area, is_mandatory, course_id, course:courses(is_active))')
        .eq('section_id', sectionId);
      
      const activeCourses = (coursesData || [])
        .filter((c: any) => c.base?.course?.is_active !== false) // Ocultar si el curso maestro fue desactivado
        .sort((a: any, b: any) => a.base.name.localeCompare(b.base.name));
      setCourses(activeCourses);

      // 4. Cargar Alumnos Asignados (Solo alumnos activos)
      // !inner obliga a que la fila de profiles cumpla la condición de is_active = true
      const { data: studData } = await supabase
        .from('student_sections')
        .select('id, student:profiles!inner(id, first_name, last_name, email, is_active)')
        .eq('section_id', sectionId)
        .eq('profiles.is_active', true);
      
      const alumnosLimpios = studData?.map(s => ({ enrollment_id: s.id, ...s.student })) || [];
      alumnosLimpios.sort((a: any, b: any) => a.last_name.localeCompare(b.last_name));
      setStudents(alumnosLimpios);
      
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo cargar la información del aula.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCursos = async () => {
    if (!section?.grade_id) return;
    setLoading(true);

    try {
      const { data: mallaCursos } = await supabase.from('base_courses').select('id').eq('grade_id', section.grade_id);
      if (!mallaCursos || mallaCursos.length === 0) {
        toast({ title: "Sin novedades", description: "La malla curricular maestra de este grado está vacía.", variant: "default" });
        return;
      }

      const registros = mallaCursos.map(c => ({ section_id: sectionId, base_course_id: c.id }));
      await supabase.from('section_courses').upsert(registros, { onConflict: 'section_id, base_course_id' });
      
      toast({ title: "Cursos Sincronizados", description: "El aula tiene todos los cursos actualizados de la malla." });
      loadAllData();
    } catch (error) {
      toast({ title: "Error", description: "Fallo al sincronizar cursos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateTutor = async (tutorId: string) => {
    await supabase.from('sections').update({ tutor_id: tutorId === 'none' ? null : tutorId }).eq('id', sectionId);
    toast({ title: "Tutor actualizado" });
    loadAllData();
  };

  const updateTeacher = async (courseId: string, teacherId: string) => {
    await supabase.from('section_courses').update({ teacher_id: teacherId === 'none' ? null : teacherId }).eq('id', courseId);
    toast({ title: "Profesor asignado correctamente" });
    loadAllData();
  };

  const handleRemoverAlumno = async (enrollmentId: string) => {
    if (!confirm('¿Seguro que deseas remover al alumno de esta sección? Pasará a estado "Sin Asignar".')) return;
    await supabase.from('student_sections').delete().eq('id', enrollmentId);
    toast({ title: "Alumno retirado" });
    loadAllData();
  };

  // FILTROS ESTRICTOS DE ROLES (Memoizados para rendimiento)
  const availableTutors = useMemo(() => staff.filter(s => s.role === 'tutor' || s.role === 'admin'), [staff]);
  const availableTeachers = useMemo(() => staff.filter(s => s.role === 'teacher' || s.role === 'admin'), [staff]);

  if (loading && !section) return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-blue-600 w-10 h-10"/></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        
        <Button variant="ghost" className="text-gray-500 hover:text-gray-800" onClick={() => navigate('/admin/classrooms')}>
          <ArrowLeft className="mr-2 h-4 w-4"/> Volver al resumen de grados
        </Button>

        {/* HEADER AULA */}
        <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-blue-600">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Aula "{section?.name}"</h1>
            <p className="text-muted-foreground mt-1 text-lg">
              {section?.grade?.name} de {section?.grade?.level?.name} <span className="mx-2">•</span> {section?.room_number || 'Sin ubicación específica'}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border min-w-[250px]">
            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Tutor Principal del Aula</Label>
            <Select value={section?.tutor_id || 'none'} onValueChange={updateTutor}>
              <SelectTrigger className="bg-white border-blue-200 font-medium">
                <SelectValue placeholder="Seleccionar Tutor..."/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-red-500">Sin Tutor Asignado</SelectItem>
                {/* AQUI SOLO MOSTRAMOS TUTORES */}
                {availableTutors.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* COLUMNA IZQUIERDA: PROFESORES Y CURSOS */}
          <Card className="border-0 shadow-sm shadow-blue-100">
            <CardHeader className="bg-blue-50/50 border-b flex flex-row justify-between items-center pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-900"><BookOpen className="w-5 h-5"/> Plana Docente</CardTitle>
              <Button onClick={handleSyncCursos} variant="outline" size="sm" className="h-8 bg-white" title="Forzar sincronización con Malla Maestra">
                <RefreshCw className="mr-2 h-3 w-3"/> Refrescar Malla
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto p-4 space-y-3">
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay cursos registrados. Haz clic en Refrescar Malla.</p>
                ) : (
                  courses.map(course => (
                    <div key={course.id} className="p-3 border rounded-lg bg-gray-50 hover:bg-white transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-gray-800 block">{course.base?.name}</span>
                          <span className="text-xs text-gray-500">{course.base?.area}</span>
                        </div>
                        {!course.base?.is_mandatory && <Badge variant="secondary" className="text-[10px]">Electivo</Badge>}
                      </div>
                      <Select value={course.teacher_id || 'none'} onValueChange={(val) => updateTeacher(course.id, val)}>
                        <SelectTrigger className="h-8 text-sm bg-white">
                          <SelectValue placeholder="Asignar profesor..."/>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-red-500 italic">Sin profesor asignado</SelectItem>
                          {/* AQUI SOLO MOSTRAMOS PROFESORES */}
                          {availableTeachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* COLUMNA DERECHA: ALUMNOS INSCRITOS */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-gray-50 border-b pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                <Users className="w-5 h-5"/> Lista de Alumnos Activos
                <Badge className="ml-auto bg-gray-200 text-gray-800 hover:bg-gray-300">{students.length}</Badge>
              </CardTitle>
              <CardDescription>Los alumnos se matriculan desde la vista principal de grados.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {students.map((s, index) => (
                      <TableRow key={s.id} className="hover:bg-gray-50">
                        <TableCell className="w-8 text-center text-xs text-gray-400 font-medium border-r">{index + 1}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-gray-800">{s.last_name}, {s.first_name}</div>
                          <div className="text-xs text-gray-500">{s.email}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleRemoverAlumno(s.enrollment_id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 h-auto" title="Remover del aula">
                            <MinusCircle className="w-4 h-4"/>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {students.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-16 text-gray-500">
                          <GraduationCap className="w-12 h-12 mx-auto text-gray-300 mb-3"/>
                          Aula vacía.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default SectionManagement;