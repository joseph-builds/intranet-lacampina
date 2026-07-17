import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Plus, Search, Edit, Users, BookOpen, Mail, Phone, GraduationCap, ShieldAlert, CheckCircle2 } from 'lucide-react';

// --- INTERFACES ---
interface Level { id: string; name: string; }
interface Grade { id: string; name: string; level_id: string; level?: Level; }
interface Student {
  id: string; first_name: string; last_name: string; email: string;
  phone: string | null; guardian_name: string | null; emergency_phone: string | null;
  role: string; is_active: boolean; current_grade_id?: string; grade?: Grade;
}
interface StudentFormData {
  first_name: string; last_name: string; email: string; phone: string;
  guardian_name: string; emergency_phone: string; current_grade_id: string;
}
interface CourseMalla { id: string; name: string; area: string; is_mandatory: boolean; course?: { is_active: boolean }; }

const AdminStudentManagement = () => {
  const { toast } = useToast();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [studentMallaCourses, setStudentMallaCourses] = useState<CourseMalla[]>([]);
  const [exemptions, setExemptions] = useState<string[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [nivelFilter, setNivelFilter] = useState('all');
  const [gradoFilter, setGradoFilter] = useState('all');

  const initialFormState: StudentFormData = {
    first_name: '', last_name: '', email: '', phone: '', guardian_name: '', emergency_phone: '', current_grade_id: 'unassigned'
  };
  const [formData, setFormData] = useState<StudentFormData>(initialFormState);

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchLevelsAndGrades(), fetchStudents()]);
    setLoading(false);
  };

  const fetchLevelsAndGrades = async () => {
    try {
      const [levelsRes, gradesRes] = await Promise.all([
        supabase.from('academic_levels').select('*').order('name'),
        supabase.from('academic_grades').select('*, level:academic_levels(id, name)').order('name')
      ]);
      if (levelsRes.data) setLevels(levelsRes.data);
      if (gradesRes.data) setGrades(gradesRes.data);
    } catch (error) {
      console.error("Error cargando estructura académica", error);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`id, first_name, last_name, email, phone, guardian_name, emergency_phone, is_active, role, current_grade_id, grade:academic_grades(id, name, level:academic_levels(id, name))`)
        .eq('role', 'student')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los estudiantes.", variant: "destructive" });
    }
  };

  // --- SOLUCIÓN: BUG DE ACTUALIZACIÓN Y FALLOS SILENCIOSOS ---
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1. Armamos el payload SIN EL EMAIL para las actualizaciones
      const payload: any = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim() || null,
        guardian_name: formData.guardian_name.trim() || null,
        emergency_phone: formData.emergency_phone.trim() || null,
        current_grade_id: formData.current_grade_id === 'unassigned' ? null : formData.current_grade_id,
      };

      if (editingStudent) {
        // ACTUALIZAR ALUMNO: Agregamos .select() para forzar respuesta de Supabase
        const { data, error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', editingStudent.id)
          .select(); // <-- CRÍTICO PARA DETECTAR FALLOS DE RLS
          
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("No se pudo actualizar en BD. Posible bloqueo por políticas RLS.");
        }
        toast({ title: "Éxito", description: "Ficha del estudiante actualizada correctamente." });
      } else {
        // CREAR ALUMNO: Aquí sí mandamos el email y los roles
        payload.email = formData.email.trim();
        payload.role = 'student';
        payload.is_active = true;
        
        const { error: profileError } = await supabase.from('profiles').insert([payload]);
        if (profileError) throw profileError; 
        toast({ title: "Éxito", description: "Estudiante matriculado en el sistema." });
      }
      
      closeModal();
      await fetchStudents(); // Esperamos a que recargue la data real
    } catch (error: any) {
      console.error("Error al guardar:", error);
      toast({ title: "Error", description: error.message || "Ocurrió un error al guardar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // --- SOLUCIÓN: BUG DE TOGGLE STATUS ---
  const handleToggleStatus = async (student: Student, newStatus: boolean) => {
    try {
      // Forzamos a que devuelva la fila actualizada con .select()
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', student.id)
        .select();
        
      if (error) throw error;
      if (!data || data.length === 0) {
         throw new Error("No tienes permisos para desactivar este usuario o hubo un bloqueo de base de datos.");
      }
      
      toast({ title: "Estado actualizado", description: `El alumno ha sido ${newStatus ? 'activado' : 'desmatriculado'}.` });
      await fetchStudents(); // Recargamos para que la tabla y el dashboard se actualicen
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo cambiar el estado.", variant: "destructive" });
    }
  };

  const openEnrollModal = async (student: Student) => {
    setSelectedStudent(student);
    setStudentMallaCourses([]);
    setExemptions([]);
    setIsEnrollModalOpen(true);
    
    if (student.grade?.id) {
      setLoadingCourses(true);
      try {
        const { data: malla } = await supabase
          .from('base_courses')
          .select('id, name, area, is_mandatory, course:courses(is_active)')
          .eq('grade_id', student.grade.id)
          .order('name');
          
        setStudentMallaCourses(malla as any);

        const { data: exempData } = await supabase
          .from('student_course_exemptions')
          .select('base_course_id')
          .eq('student_id', student.id);
          
        setExemptions(exempData?.map(e => e.base_course_id) || []);
      } catch (err) {
        toast({ title: "Error", description: "Fallo al cargar cursos.", variant: "destructive" });
      } finally {
        setLoadingCourses(false);
      }
    }
  };

  const handleToggleExemption = async (baseCourseId: string, isExempted: boolean) => {
    if (!selectedStudent) return;
    try {
      if (isExempted) {
        await supabase.from('student_course_exemptions').insert({ student_id: selectedStudent.id, base_course_id: baseCourseId });
        setExemptions(prev => [...prev, baseCourseId]);
        toast({ title: "Exonerado", description: "El alumno ya no llevará este curso." });
      } else {
        await supabase.from('student_course_exemptions').delete().eq('student_id', selectedStudent.id).eq('base_course_id', baseCourseId);
        setExemptions(prev => prev.filter(id => id !== baseCourseId));
        toast({ title: "Inscrito", description: "El alumno ha sido reincorporado al curso." });
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  };

  const openCreateModal = () => { setEditingStudent(null); setFormData(initialFormState); setIsModalOpen(true); };
  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      first_name: student.first_name || '', last_name: student.last_name || '', email: student.email || '',
      phone: student.phone || '', guardian_name: student.guardian_name || '', emergency_phone: student.emergency_phone || '',
      current_grade_id: student.current_grade_id || 'unassigned',
    });
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditingStudent(null); setFormData(initialFormState); };

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const searchStr = `${student.first_name} ${student.last_name} ${student.email} ${student.guardian_name || ''}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'active' && student.is_active) || 
                           (filterStatus === 'inactive' && !student.is_active);
      
      const studentLevelId = student.grade?.level?.id || 'unassigned';
      const studentGradeId = student.grade?.id || 'unassigned';
      const matchesNivel = nivelFilter === 'all' || studentLevelId === nivelFilter;
      const matchesGrado = gradoFilter === 'all' || studentGradeId === gradoFilter;

      return matchesSearch && matchesStatus && matchesNivel && matchesGrado;
    });
  }, [students, searchTerm, filterStatus, nivelFilter, gradoFilter]);

  const availableGradesForFilter = useMemo(() => {
    if (nivelFilter === 'all') return grades;
    return grades.filter(g => g.level_id === nivelFilter);
  }, [grades, nivelFilter]);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        
        {/* CABECERA Y DASHBOARD METRICS */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800">
                <Users className="h-8 w-8 text-blue-600" />
                Gestión de Estudiantes
              </h1>
              <p className="text-muted-foreground mt-1">Administra la base de datos de alumnos, apoderados y su matrícula en el colegio.</p>
            </div>
            <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              + Nuevo Estudiante
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">Total Registrados <Users className="inline h-5 w-5 text-blue-500" /></div>
                <div className="text-3xl font-bold text-gray-800">{students.length}</div>
              </div>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">Alumnos Activos <CheckCircle2 className="inline h-5 w-5 text-green-500" /></div>
                <div className="text-3xl font-bold text-gray-800">{students.filter(s => s.is_active).length}</div>
              </div>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-red-400">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">Desmatriculados (Inactivos) <ShieldAlert className="inline h-5 w-5 text-red-400" /></div>
                <div className="text-3xl font-bold text-gray-800">{students.filter(s => !s.is_active).length}</div>
              </div>
            </Card>
          </div>
        </div>

        {/* BARRA DE FILTROS */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar alumno, email o apoderado..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={nivelFilter} onValueChange={(val) => { setNivelFilter(val); setGradoFilter('all'); }}>
                <SelectTrigger><SelectValue placeholder="Nivel Educativo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Niveles</SelectItem>
                  {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={gradoFilter} onValueChange={setGradoFilter} disabled={nivelFilter === 'all' && grades.length === 0}>
                <SelectTrigger><SelectValue placeholder="Grado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Grados</SelectItem>
                  {availableGradesForFilter.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Solo Activos</SelectItem>
                  <SelectItem value="inactive">Solo Desmatriculados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* TABLA PRINCIPAL */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-500 animate-pulse">Cargando base de datos de estudiantes...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Grado / Nivel</TableHead>
                      <TableHead>Apoderado / Emergencia</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right pr-6">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          No se encontraron estudiantes con los filtros actuales.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => (
                        <TableRow key={student.id} className={`hover:bg-gray-50/50 ${!student.is_active ? 'bg-red-50/30 opacity-75' : ''}`}>
                          <TableCell>
                            <div className="font-semibold text-gray-900">{student.first_name} {student.last_name}</div>
                            <div className="text-xs text-gray-500 flex items-center mt-1">
                              <Mail className="w-3 h-3 mr-1" /> {student.email}
                            </div>
                            {student.phone && (
                              <div className="text-xs text-gray-500 flex items-center mt-0.5">
                                <Phone className="w-3 h-3 mr-1" /> {student.phone}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.grade ? (
                              <div>
                                <Badge variant="outline" className={`${student.is_active ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'} font-semibold`}>
                                  {student.grade.name}
                                </Badge>
                                <div className="text-xs text-gray-500 mt-1 pl-1">{student.grade.level?.name}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-orange-500 italic flex items-center">
                                <ShieldAlert className="w-3 h-3 mr-1"/> Sin asignar
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.guardian_name ? (
                              <div className="text-sm font-medium text-gray-700">{student.guardian_name}</div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No registrado</span>
                            )}
                            {student.emergency_phone && (
                              <div className="text-xs text-red-600 flex items-center mt-1 font-medium">
                                <Phone className="w-3 h-3 mr-1" /> {student.emergency_phone}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                             <div className="flex items-center justify-center gap-2">
                                <Switch checked={student.is_active} onCheckedChange={(val) => handleToggleStatus(student, val)} />
                                <span className={`text-xs font-medium w-16 text-left ${student.is_active ? "text-green-600" : "text-red-500"}`}>
                                  {student.is_active ? 'Activo' : 'Desmatriculado'}
                                </span>
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-indigo-600 hover:bg-indigo-50" onClick={() => openEnrollModal(student)} title="Ver Cursos/Matrícula">
                                <BookOpen className="w-4 h-4 mr-1" /> <span className="hidden sm:inline text-xs">Cursos</span>
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50" onClick={() => openEditModal(student)} title="Editar Ficha">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MODAL CREAR / EDITAR ESTUDIANTE */}
        <Dialog open={isModalOpen} onOpenChange={(open) => { if(!open) closeModal(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">{editingStudent ? 'Editar Ficha del Estudiante' : 'Registrar Nuevo Estudiante'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveStudent} className="space-y-6 mt-4">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2">1. Datos del Alumno</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Nombres *</Label><Input value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required autoFocus/></div>
                  <div className="space-y-2"><Label>Apellidos *</Label><Input value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required /></div>
                  <div className="space-y-2"><Label>Correo Institucional / Personal *</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required disabled={!!editingStudent} className={editingStudent ? "bg-gray-100 cursor-not-allowed" : ""}/></div>
                  <div className="space-y-2"><Label>Teléfono Celular (Opcional)</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Ej: 987654321" /></div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2">2. Ubicación Académica</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Grado Actual</Label>
                    <Select value={formData.current_grade_id} onValueChange={val => setFormData({...formData, current_grade_id: val})}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar grado a cursar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-orange-600 font-medium">Dejar sin asignar temporalmente</SelectItem>
                        {levels.map(level => (
                          <div key={`group-${level.id}`}>
                            <div className="px-2 py-1.5 text-xs font-bold text-gray-400 uppercase bg-gray-50">{level.name}</div>
                            {grades.filter(g => g.level_id === level.id).map(grade => (
                              <SelectItem key={grade.id} value={grade.id} className="pl-6">{grade.name}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">Asignar el grado conectará al alumno automáticamente a la malla curricular correspondiente.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2">3. Apoderado / Emergencia</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Nombre del Padre/Madre/Apoderado</Label><Input value={formData.guardian_name} onChange={e => setFormData({...formData, guardian_name: e.target.value})} placeholder="Nombre completo" /></div>
                  <div className="space-y-2"><Label className="text-red-600">Teléfono de Emergencia</Label><Input value={formData.emergency_phone} onChange={e => setFormData({...formData, emergency_phone: e.target.value})} placeholder="Nro para llamadas urgentes" className="border-red-200 focus-visible:ring-red-500" /></div>
                </div>
              </div>
              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 text-white" disabled={saving}>{saving ? 'Guardando...' : (editingStudent ? 'Actualizar Ficha' : 'Registrar Estudiante')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL VER CURSOS (Con gestión de inactivos, desmatriculados y exoneraciones) */}
        <Dialog open={isEnrollModalOpen} onOpenChange={setIsEnrollModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Situación Académica y Cursos Asignados</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-6">

              {/* AVISO DE ALUMNO DESMATRICULADO */}
              {!selectedStudent?.is_active && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
                  <div className="flex items-center gap-2 text-red-800 font-bold">
                    <ShieldAlert className="w-5 h-5" />
                    ALUMNO INACTIVO (DESMATRICULADO)
                  </div>
                  <p className="text-sm text-red-600 mt-1">Este alumno ha sido desactivado del sistema. No aparecerá en las listas de clase de los profesores y sus cursos se encuentran suspendidos.</p>
                </div>
              )}

              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg border">
                <div className={`p-3 rounded-full ${selectedStudent?.is_active ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}><GraduationCap className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-lg font-bold">{selectedStudent?.first_name} {selectedStudent?.last_name}</h3>
                  {selectedStudent?.grade ? (
                    <p className={`text-sm font-medium ${selectedStudent?.is_active ? 'text-blue-600' : 'text-gray-500'}`}>Matriculado en: {selectedStudent.grade.name} ({selectedStudent.grade.level?.name})</p>
                  ) : <p className="text-sm font-medium text-orange-600">Sin grado asignado actualmente.</p>}
                </div>
              </div>

              {selectedStudent?.grade ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-800 border-b pb-2 flex items-center justify-between">
                    Cursos de la Currícula
                    <Badge variant="secondary">{studentMallaCourses.length} Asignaturas</Badge>
                  </h4>
                  {loadingCourses ? (
                    <p className="text-center text-sm text-gray-500 animate-pulse py-4">Cargando cursos...</p>
                  ) : studentMallaCourses.length > 0 ? (
                    <div className={`border rounded-md overflow-hidden ${!selectedStudent.is_active ? 'opacity-80 grayscale' : ''}`}>
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TableHead>Curso</TableHead>
                            <TableHead className="text-center">Tipo</TableHead>
                            <TableHead className="text-right">Estado del Alumno</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentMallaCourses.map((curso) => {
                            const isExempt = exemptions.includes(curso.id);
                            const isCourseActive = curso.course?.is_active !== false;

                            return (
                              <TableRow key={curso.id} className={!isCourseActive || !selectedStudent.is_active ? "bg-red-50/20" : (isExempt ? "bg-gray-50 opacity-60" : "")}>
                                <TableCell className="font-medium flex items-center gap-2">
                                  <BookOpen className={`w-4 h-4 ${(!isCourseActive || !selectedStudent.is_active) ? 'text-red-400' : (isExempt ? 'text-gray-300' : 'text-blue-500')}`} /> 
                                  <span className={!isCourseActive || isExempt || !selectedStudent.is_active ? "line-through text-gray-400" : ""}>{curso.name}</span>
                                  {!isCourseActive && <Badge variant="outline" className="ml-2 text-[10px] bg-red-50 text-red-600 border-red-200">Inactivo en Catálogo</Badge>}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={curso.is_mandatory ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}>
                                    {curso.is_mandatory ? 'Obligatorio' : 'Electivo'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {!selectedStudent.is_active ? (
                                    <span className="text-xs font-bold text-red-500 pr-2">Desmatriculado (Inactivo)</span>
                                  ) : !isCourseActive ? (
                                    <span className="text-xs font-bold text-red-500 pr-2">Suspendido por Dirección</span>
                                  ) : (
                                    <div className="flex items-center justify-end gap-3">
                                      <span className={`text-xs font-bold ${isExempt ? 'text-red-500' : 'text-green-600'}`}>
                                        {isExempt ? 'Exonerado' : 'Cursando'}
                                      </span>
                                      <Switch 
                                        checked={!isExempt} 
                                        onCheckedChange={(checked) => handleToggleExemption(curso.id, !checked)}
                                      />
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
                      <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 font-medium">Este grado aún no tiene cursos registrados en su Malla Curricular.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                   <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-orange-400" />
                   <p className="text-gray-600 font-medium mb-1">Para visualizar los cursos, primero edita la ficha del alumno.</p>
                   <p className="text-sm text-gray-500">Asígnele un grado y automáticamente heredará los cursos de su respectiva malla curricular.</p>
                </div>
              )}
            </div>
            <DialogFooter className="border-t pt-4"><Button onClick={() => setIsEnrollModalOpen(false)}>Cerrar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminStudentManagement;