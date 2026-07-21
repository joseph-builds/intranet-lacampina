import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, BookOpen, Users, RefreshCw, GraduationCap, MinusCircle, UserMinus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const CURRENT_YEAR = new Date().getFullYear();
const COLUMNA_CURSO = 'section_course_id'; 

const SectionManagement = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]); 
  const [busyTutors, setBusyTutors] = useState<string[]>([]);
  const [exoneratedStudents, setExoneratedStudents] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (sectionId) loadAllData();
  }, [sectionId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const { data: secData, error: secErr } = await supabase
        .from('sections')
        .select('*, tutor:profiles!tutor_id(*), grade:academic_grades(id, name, level:academic_levels(name))')
        .eq('id', sectionId)
        .single();
      
      if (secErr) throw secErr;
      setSection(secData);

      // Traer todos los tutores ocupados este año
      const { data: allSections } = await supabase.from('sections').select('tutor_id').eq('academic_year', CURRENT_YEAR).not('tutor_id', 'is', null);
      setBusyTutors(allSections?.map(s => s.tutor_id) || []);

      const { data: staffData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('role', ['teacher', 'tutor', 'admin'])
        .eq('is_active', true)
        .order('first_name');
      setStaff(staffData || []);

      const { data: studData } = await supabase
        .from('student_sections')
        .select('id, student:profiles!inner(id, first_name, last_name, email, is_active)')
        .eq('section_id', sectionId)
        .eq('academic_year', CURRENT_YEAR)
        .eq('profiles.is_active', true);
      
      const alumnosLimpios = studData?.map(s => ({ enrollment_id: s.id, ...s.student })).filter(s => s.is_active === true) || [];
      alumnosLimpios.sort((a: any, b: any) => a.last_name.localeCompare(b.last_name));
      setStudents(alumnosLimpios);

      await loadCourses(secData.grade_id);

      if (alumnosLimpios.length > 0) {
        const { data: exempData } = await supabase
          .from('student_course_exemptions')
          .select(`student_id, ${COLUMNA_CURSO}`)
          .in('student_id', alumnosLimpios.map(a => a.id));
        
        const mappedExemptions: Record<string, string[]> = {};
        exempData?.forEach(row => {
          const cId = row[COLUMNA_CURSO];
          if (!mappedExemptions[cId]) mappedExemptions[cId] = [];
          mappedExemptions[cId].push(row.student_id);
        });
        setExoneratedStudents(mappedExemptions);
      }
    } catch (err: any) {
      toast({ title: "Error", description: "No se pudo cargar la información del aula.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const loadCourses = async (gradeId: string) => {
    const { data: coursesData } = await supabase
      .from('section_courses')
      .select('id, teacher_id, base:base_courses(name, area, is_mandatory, course_id, course:courses(is_active))')
      .eq('section_id', sectionId);
    
    if (!coursesData || coursesData.length === 0) {
      await autoSyncCursos(gradeId);
    } else {
      const allCourses = coursesData.sort((a: any, b: any) => a.base.name.localeCompare(b.base.name));
      setCourses(allCourses);
    }
  };

  const autoSyncCursos = async (gradeId: string) => {
    const { data: mallaCursos } = await supabase.from('base_courses').select('id').eq('grade_id', gradeId);
    if (mallaCursos && mallaCursos.length > 0) {
      const registros = mallaCursos.map(c => ({ section_id: sectionId, base_course_id: c.id }));
      await supabase.from('section_courses').insert(registros);
      const { data: newCoursesData } = await supabase
        .from('section_courses')
        .select('id, teacher_id, base:base_courses(name, area, is_mandatory, course_id, course:courses(is_active))')
        .eq('section_id', sectionId);
      
      const allCourses = (newCoursesData || []).sort((a: any, b: any) => a.base.name.localeCompare(b.base.name));
      setCourses(allCourses);
      toast({ title: "Malla Importada", description: "Los cursos se sincronizaron automáticamente." });
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
      await loadCourses(section.grade_id);
    } catch (error) {
      toast({ title: "Error", description: "Fallo al sincronizar cursos.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const updateTutor = async (tutorId: string) => {
    try {
      const newTutorId = tutorId === 'none' ? null : tutorId;
      await supabase.from('sections').update({ tutor_id: newTutorId }).eq('id', sectionId);
      setSection((prev: any) => ({ ...prev, tutor_id: newTutorId }));
      toast({ title: "Éxito", description: "El Tutor Principal ha sido actualizado." });
    } catch (error) { toast({ title: "Error", variant: "destructive" }); }
  };

  const updateTeacher = async (courseId: string, teacherId: string) => {
    try {
      await supabase.from('section_courses').update({ teacher_id: teacherId === 'none' ? null : teacherId }).eq('id', courseId);
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, teacher_id: teacherId === 'none' ? null : teacherId } : c));
      toast({ title: "Éxito", description: "Profesor asignado correctamente al curso." });
    } catch (error) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleRemoverAlumno = async (enrollmentId: string) => {
    if (!confirm('¿Seguro que deseas remover al alumno de esta sección? Pasará a estado "Sin Asignar".')) return;
    await supabase.from('student_sections').delete().eq('id', enrollmentId);
    toast({ title: "Alumno retirado" });
    setStudents(prev => prev.filter(s => s.enrollment_id !== enrollmentId));
  };

  const toggleExoneration = async (courseId: string, studentId: string) => {
    const isExempted = (exoneratedStudents[courseId] || []).includes(studentId);
    try {
      if (isExempted) {
        await supabase.from('student_course_exemptions').delete().eq('student_id', studentId).eq(COLUMNA_CURSO, courseId);
        setExoneratedStudents(prev => ({ ...prev, [courseId]: (prev[courseId] || []).filter(id => id !== studentId) }));
        toast({ title: "Inscrito", description: "El alumno ha sido reincorporado al curso." });
      } else {
        await supabase.from('student_course_exemptions').insert({ student_id: studentId, [COLUMNA_CURSO]: courseId });
        setExoneratedStudents(prev => ({ ...prev, [courseId]: [...(prev[courseId] || []), studentId] }));
        toast({ title: "Exonerado", description: "El alumno ha sido exonerado del curso." });
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar la exoneración.", variant: "destructive" });
    }
  };

  // Filtrado Seguro de Tutores (Solo mostrar los que no tienen aula asignada, o si es el tutor actual de esta misma aula)
  const availableTutors = useMemo(() => {
    return staff.filter(s => 
      (s.role === 'tutor' || s.role === 'admin') && 
      (!busyTutors.includes(s.id) || s.id === section?.tutor_id)
    );
  }, [staff, busyTutors, section]);

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
                {availableTutors.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* COLUMNA IZQUIERDA: PROFESORES Y CURSOS */}
          <Card className="border-0 shadow-sm shadow-blue-100 flex flex-col h-[700px]">
            <CardHeader className="bg-blue-50/50 border-b flex flex-row justify-between items-center pb-4 shrink-0">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                <BookOpen className="w-5 h-5"/> Malla de Cursos del Aula
              </CardTitle>
              <Button onClick={handleSyncCursos} variant="outline" size="sm" className="h-8 bg-white" title="Forzar sincronización con Malla Maestra">
                <RefreshCw className="mr-2 h-3 w-3"/> Refrescar Malla
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
              <div className="p-4 space-y-4">
                {courses.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                    <p className="text-sm">No hay cursos registrados.<br/>Haz clic en Refrescar Malla.</p>
                  </div>
                ) : (
                  courses.map(course => {
                    const isCourseActive = course.base?.course?.is_active !== false;
                    const exemptIds = exoneratedStudents[course.id] || [];
                    const activeExemptStudents = students.filter(s => exemptIds.includes(s.id));
                    const exemptCount = activeExemptStudents.length;

                    return (
                      <div key={course.id} className={`p-4 border rounded-lg transition-colors ${isCourseActive ? 'bg-gray-50 hover:bg-white border-gray-200' : 'bg-red-50/40 border-red-100 opacity-80'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className={`font-bold block ${isCourseActive ? 'text-gray-800' : 'text-gray-500 line-through'}`}>{course.base?.name}</span>
                            <span className="text-xs text-gray-500 block">{course.base?.area}</span>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            {!course.base?.is_mandatory && <Badge variant="secondary" className="text-[10px]">Electivo</Badge>}
                            {!isCourseActive && <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200">Inactivo en Catálogo</Badge>}
                          </div>
                        </div>

                        <Select value={course.teacher_id || 'none'} onValueChange={(val) => updateTeacher(course.id, val)} disabled={!isCourseActive}>
                          <SelectTrigger className={`h-8 text-sm ${isCourseActive ? 'bg-white' : 'bg-gray-100 text-gray-400 border-dashed'}`}>
                            <SelectValue placeholder={isCourseActive ? "Asignar profesor al curso..." : "Curso inhabilitado"}/>
                          </SelectTrigger>
                          {isCourseActive && (
                            <SelectContent>
                              <SelectItem value="none" className="text-red-500 italic">Sin profesor asignado</SelectItem>
                              {availableTeachers.map(t => <SelectItem key={t.id} value={t.id}>Prof. {t.last_name}, {t.first_name}</SelectItem>)}
                            </SelectContent>
                          )}
                        </Select>

                        {/* SECCIÓN EXONERADOS POR CURSO */}
                        {isCourseActive && (
                          <div className="mt-3 pt-3 border-t border-dashed">
                            {exemptCount > 0 && (
                              <div className="mb-3 p-2.5 bg-amber-50/80 rounded border border-amber-100">
                                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5 block">Alumnos Exonerados ({exemptCount}):</span>
                                <ul className="text-xs text-amber-700 space-y-1">
                                  {activeExemptStudents.map(es => (
                                    <li key={es.id} className="flex items-center gap-1.5">
                                      <MinusCircle className="w-3 h-3 text-amber-500 shrink-0"/> <span className="font-medium">{es.last_name}</span>, {es.first_name}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className={`w-full text-xs h-7 ${exemptCount > 0 ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-gray-500 hover:text-amber-700 hover:bg-amber-50'}`}>
                                  <UserMinus className="w-3 h-3 mr-1"/> Gestión de Exonerados
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="text-amber-700 flex items-center gap-2"><UserMinus className="w-5 h-5"/> Alumnos Exonerados</DialogTitle>
                                  <DialogDescription>Marca a los alumnos que NO llevarán el curso de <strong>{course.base?.name}</strong>.</DialogDescription>
                                </DialogHeader>
                                <div className="max-h-[300px] overflow-y-auto border rounded-md">
                                  {students.map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-3 border-b hover:bg-gray-50">
                                      <div className="text-sm font-medium text-gray-700">{student.last_name}, {student.first_name}</div>
                                      <div className="flex items-center gap-2">
                                        <Label htmlFor={`ex-${course.id}-${student.id}`} className="text-xs text-gray-500">Exonerado</Label>
                                        <Checkbox 
                                          id={`ex-${course.id}-${student.id}`}
                                          checked={(exoneratedStudents[course.id] || []).includes(student.id)} 
                                          onCheckedChange={() => toggleExoneration(course.id, student.id)}
                                          className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                  {students.length === 0 && <div className="p-6 text-center text-gray-500 text-sm">El aula no tiene alumnos matriculados.</div>}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* COLUMNA DERECHA: ALUMNOS INSCRITOS */}
          <Card className="border-0 shadow-sm flex flex-col h-[700px]">
            <CardHeader className="bg-gray-50 border-b pb-4 shrink-0">
              <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                <Users className="w-5 h-5"/> Lista de Alumnos Activos
                <Badge className="ml-auto bg-gray-200 text-gray-800 hover:bg-gray-300">{students.length}</Badge>
              </CardTitle>
              <CardDescription>Para matricular alumnos, ve a la vista principal de grados.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
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
                      <TableCell colSpan={3} className="text-center py-20 text-gray-500">
                        <GraduationCap className="w-12 h-12 mx-auto text-gray-300 mb-3"/>
                        <p className="font-medium text-gray-600">Aula vacía.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SectionManagement;