import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Loader2, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Edit, Trash2, Users } from 'lucide-react';
import { fetchAllTeachers } from '@/utils/teacherUtils';

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Program {
  id: string;
  name: string;
}

interface Course {
  id: string;
  name: string;
  description?: string;
  code: string;
  teacher_principal_id: string;
  teacher?: Teacher;
  academic_year: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  enrollments?: { count: number }[];
}

interface CourseFormData {
  name: string;
  description: string;
  code: string;
  teacher_principal_id: string;
  academic_year: string;
  semester: string;
  program_id: string;
  start_date: string;
  end_date: string;
}

const AdminCourseManagement = () => {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CourseFormData>({
    name: '',
    description: '',
    code: '',
    teacher_principal_id: '',
    academic_year: '2024',
    semester: '',
    program_id: '',
    start_date: '',
    end_date: '',
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkTeacherModal, setShowBulkTeacherModal] = useState(false);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [bulkTeacherId, setBulkTeacherId] = useState<string>('');
  const [bulkSchedule, setBulkSchedule] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  // Edición rápida: cambios temporales
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [quickEditChanges, setQuickEditChanges] = useState<{ [id: string]: Partial<Course> }>({});
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleEditCourse, setScheduleEditCourse] = useState<Course | null>(null);
  const [scheduleForm, setScheduleForm] = useState<any[]>([]);
  const [inlineSaving, setInlineSaving] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    fetchCourses();
    fetchTeachers();
    fetchPrograms();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          teacher:profiles!courses_teacher_principal_id_fkey (
            id,
            first_name,
            last_name,
            email
          ),
          enrollments:course_enrollments (count)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching courses:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los cursos",
          variant: "destructive",
        });
      } else {
        setCourses((data as any) || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const data = await fetchAllTeachers();
      setTeachers(data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los profesores",
        variant: "destructive",
      });
    }
  };

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programas')
        .select('id, name')
        .order('name');
      if (!error) setPrograms(data || []);
    } catch (error) {
      console.error('Error fetching programs:', error);
    }
  };

  const handleInputChange = useCallback((field: keyof CourseFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

  const handleSelectChange = useCallback((field: keyof CourseFormData) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      code: '',
      teacher_principal_id: '',
      academic_year: '2024',
      semester: '',
      program_id: '',
      start_date: '',
      end_date: '',
    });
  }, []);

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      description: course.description || '',
      code: course.code,
      teacher_principal_id: course.teacher_principal_id,
      academic_year: course.academic_year,
      semester: (course as any).semester || '',
      program_id: (course as any).program_id || '',
      start_date: course.start_date || '',
      end_date: course.end_date || '',
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (course: Course) => {
    setDeletingCourse(course);
    setIsDeleteModalOpen(true);
  };

  const handleToggleCourseStatus = async (course: Course) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_active: !course.is_active })
        .eq('id', course.id);

      if (error) {
        console.error('Error toggling course status:', error);
        toast({
          title: "Error",
          description: "No se pudo cambiar el estado del curso",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: `Curso ${!course.is_active ? 'activado' : 'desactivado'} exitosamente`,
        });
        fetchCourses();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Filter courses based on search and filters
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.teacher?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.teacher?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = filterYear === 'all' || course.academic_year === filterYear;
    return matchesSearch && matchesYear;
  });

  // Edición rápida: guardar cambios en memoria
  const handleQuickEditChange = (courseId: string, field: keyof Course, value: any) => {
    setQuickEditChanges(prev => ({
      ...prev,
      [courseId]: { ...prev[courseId], [field]: value }
    }));
  };

  const clearQuickEditChanges = () => setQuickEditChanges({});

  // Guardar todos los cambios pendientes en la base de datos
  const saveAllQuickEdits = async () => {
    const updates = Object.entries(quickEditChanges);
    if (updates.length === 0) return;
    setSaving(true);
    try {
      for (const [id, changes] of updates) {
        const { error } = await supabase.from('courses').update(changes).eq('id', id);
        if (error) throw error;
      }
      toast({ title: 'Cambios guardados', description: 'Todos los cambios fueron guardados exitosamente.' });
      clearQuickEditChanges();
      fetchCourses();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron guardar los cambios', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Horario: abrir modal y cargar datos
  const openScheduleModal = (course: Course) => {
    setScheduleEditCourse(course);
    // courses.schedule removed in schema refactor — schedule managed via modulos (Categoría B)
    setScheduleForm([]);
    setShowScheduleModal(true);
  };

  // Horario: guardar
  const saveSchedule = async () => {
    if (!scheduleEditCourse) return;
    // courses.schedule removed in schema refactor — schedule managed via modulos (Categoría B)
    toast({ title: 'Info', description: 'El horario se gestiona desde los módulos del curso.' });
    setShowScheduleModal(false);
    setScheduleEditCourse(null);
  };

  // Horario: helpers para UI
  const daysOfWeek = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];
  const getDayLabel = (key: string) => daysOfWeek.find(d => d.key === key)?.label || key;
  const getScheduleSummary = (schedule: string | undefined) => {
    if (!schedule) return 'Sin horario';
    try {
      const arr = typeof schedule === 'string' ? JSON.parse(schedule) : schedule;
      if (!Array.isArray(arr) || arr.length === 0) return 'Sin horario';
      return arr.map((d: any) => `${getDayLabel(d.day)} ${d.start_time}-${d.end_time}`).join(', ');
    } catch {
      return 'Sin horario';
    }
  };

  const handleDeleteCourse = async () => {
    if (!deletingCourse) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', deletingCourse.id);
      if (error) {
        toast({
          title: "Error",
          description: "No se pudo eliminar el curso",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Curso eliminado",
          description: `El curso "${deletingCourse.name}" fue eliminado exitosamente.`,
        });
        fetchCourses();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSaving(false);
      setIsDeleteModalOpen(false);
      setDeletingCourse(null);
    }
  };

  // Crear curso
  const handleCreateCourse = async () => {
    if (!formData.name || !formData.code || !formData.teacher_principal_id || !formData.academic_year) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('courses')
        .insert([
          {
            name: formData.name,
            description: formData.description,
            code: formData.code,
            teacher_principal_id: formData.teacher_principal_id,
            academic_year: formData.academic_year,
            semester: formData.semester,
            program_id: formData.program_id,
            start_date: formData.start_date,
            is_active: true,
          },
        ]);
      if (error) {
        toast({
          title: "Error",
          description: "No se pudo crear el curso",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Curso creado",
          description: `El curso "${formData.name}" fue creado exitosamente.`,
        });
        setIsCreateModalOpen(false);
        resetForm();
        fetchCourses();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Editar curso
  const handleEditCourse = async () => {
    if (!editingCourse) return;
    if (!formData.name || !formData.code || !formData.teacher_principal_id || !formData.academic_year) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          name: formData.name,
          description: formData.description,
          code: formData.code,
          teacher_principal_id: formData.teacher_principal_id,
          academic_year: formData.academic_year,
          semester: formData.semester,
          program_id: formData.program_id,
          start_date: formData.start_date,
          end_date: formData.end_date,
        })
        .eq('id', editingCourse.id);
      if (error) {
        toast({
          title: "Error",
          description: "No se pudo actualizar el curso",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Curso actualizado",
          description: `El curso "${formData.name}" fue actualizado exitosamente.`,
        });
        setIsEditModalOpen(false);
        setEditingCourse(null);
        resetForm();
        fetchCourses();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Fila de filtros y botones de acción se mueve debajo de los indicadores */}
        {/* Panel resumen de cursos */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Gestión de Cursos</h1>
          <p className="text-gray-600 mb-6">Administra los cursos del sistema</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  Total Cursos
                  <BookOpen className="inline h-5 w-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold">{courses.length}</div>
                <p className="text-xs text-gray-500 mt-1">Cursos registrados en el sistema</p>
              </div>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  Cursos Activos
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                </div>
                <div className="text-2xl font-bold">{courses.filter(c => c.is_active).length}</div>
                <p className="text-xs text-gray-500 mt-1">Cursos activos</p>
              </div>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  Cursos Inactivos
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
                </div>
                <div className="text-2xl font-bold">{courses.filter(c => !c.is_active).length}</div>
                <p className="text-xs text-gray-500 mt-1">Cursos inactivos</p>
              </div>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  Profesores Asignados
                  <Users className="inline h-5 w-5 text-purple-500" />
                </div>
                <div className="text-2xl font-bold">{[...new Set(courses.map(c => c.teacher_principal_id).filter(Boolean))].length}</div>
                <p className="text-xs text-gray-500 mt-1">Profesores con al menos un curso</p>
              </div>
            </Card>
          </div>
        </div>
        {/* Fila de filtros y botones de acción DEBAJO de los indicadores */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          {/* Aquí iría el filtro/búsqueda si existe */}
          <div className="flex-1">{/* ...filtros o búsqueda aquí... */}</div>
          <div className="flex flex-wrap gap-2 items-center justify-end">
            {selectedIds.length > 0 && (
              <>
                <Button size="sm" className="bg-purple-600 text-white" onClick={() => setShowBulkTeacherModal(true)}>
                  Asignar Profesor a Seleccionados
                </Button>
                <Button size="sm" className="bg-blue-600 text-white" onClick={() => setShowBulkScheduleModal(true)}>
                  Asignar Horario a Seleccionados
                </Button>
                <span className="text-xs text-gray-500 ml-2">{selectedIds.length} seleccionados</span>
              </>
            )}
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>
              + Nuevo Curso
            </Button>
            <Button
              variant={quickEditMode ? 'default' : 'outline'}
              className={quickEditMode ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
              onClick={() => {
                if (quickEditMode && Object.keys(quickEditChanges).length > 0) {
                  if (window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos?')) {
                    clearQuickEditChanges();
                    setQuickEditMode(false);
                  }
                } else {
                  setQuickEditMode((prev) => !prev);
                }
              }}
            >
              {quickEditMode ? 'Salir de Edición Rápida' : 'Edición Rápida'}
            </Button>
            {quickEditMode && Object.keys(quickEditChanges).length > 0 && (
              <Button
                className="bg-green-600 text-white hover:bg-green-700 fixed bottom-8 right-8 z-50 shadow-lg"
                onClick={() => {
                  if (window.confirm('¿Deseas guardar todos los cambios realizados?')) {
                    saveAllQuickEdits();
                  }
                }}
                disabled={saving}
              >
                Guardar Cambios Pendientes
              </Button>
            )}
          </div>
        </div>
        {/* Tabla de cursos */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Lista de Cursos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto relative">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Profesor</TableHead>
                    <TableHead>Año/Semestre</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCourses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(course.id)}
                          onChange={e => {
                            setSelectedIds(prev => e.target.checked ? [...prev, course.id] : prev.filter(id => id !== course.id));
                          }}
                        />
                      </TableCell>
                      <TableCell>{course.code}</TableCell>
                              {/* Modal Asignar Profesor Masivo */}
                              <Dialog open={showBulkTeacherModal} onOpenChange={setShowBulkTeacherModal}>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Asignar Profesor a Cursos Seleccionados</DialogTitle>
                                  </DialogHeader>
                                  <div className="mb-4">
                                    <Label>Profesor</Label>
                                    <Select value={bulkTeacherId} onValueChange={setBulkTeacherId}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar profesor" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {teachers.map((t) => (
                                          <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      onClick={async () => {
                                        if (!bulkTeacherId) return;
                                        setSaving(true);
                                        try {
                                          for (const id of selectedIds) {
                                            await supabase.from('courses').update({ teacher_principal_id: bulkTeacherId }).eq('id', id);
                                          }
                                          toast({ title: 'Profesor asignado', description: 'Profesor asignado a los cursos seleccionados.' });
                                          setShowBulkTeacherModal(false);
                                          setBulkTeacherId('');
                                          setSelectedIds([]);
                                          fetchCourses();
                                        } catch {
                                          toast({ title: 'Error', description: 'No se pudo asignar el profesor', variant: 'destructive' });
                                        } finally {
                                          setSaving(false);
                                        }
                                      }}
                                      disabled={!bulkTeacherId || saving}
                                      className="bg-purple-600 text-white"
                                    >
                                      Asignar
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>

                              {/* Modal Asignar Horario Masivo */}
                              <Dialog open={showBulkScheduleModal} onOpenChange={setShowBulkScheduleModal}>
                                <DialogContent className="max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle>Asignar Horario a Cursos Seleccionados</DialogTitle>
                                  </DialogHeader>
                                  <div className="mb-2 text-sm text-gray-600">Define el horario que se asignará a todos los cursos seleccionados</div>
                                  <div className="space-y-2">
                                    {daysOfWeek.map(day => {
                                      const entry = bulkSchedule.find((d: any) => d.day === day.key);
                                      return (
                                        <div key={day.key} className="flex items-center gap-2">
                                          <input type="checkbox" checked={!!entry} onChange={e => {
                                            if (e.target.checked) {
                                              setBulkSchedule((prev: any[]) => [...prev, { day: day.key, start_time: '', end_time: '' }]);
                                            } else {
                                              setBulkSchedule((prev: any[]) => prev.filter(d => d.day !== day.key));
                                            }
                                          }} />
                                          <span className="w-24">{day.label}</span>
                                          {entry && (
                                            <>
                                              <input type="time" value={entry.start_time} onChange={e => setBulkSchedule((prev: any[]) => prev.map(d => d.day === day.key ? { ...d, start_time: e.target.value } : d))} className="border rounded px-2 py-1" />
                                              <span>a</span>
                                              <input type="time" value={entry.end_time} onChange={e => setBulkSchedule((prev: any[]) => prev.map(d => d.day === day.key ? { ...d, end_time: e.target.value } : d))} className="border rounded px-2 py-1" />
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <DialogFooter className="mt-4">
                                    <Button
                                      className="bg-blue-600 text-white"
                                      onClick={async () => {
                                        setSaving(true);
                                        try {
                                          // courses.schedule removed in schema refactor — managed via modulos (Categoría B)
                                          toast({ title: 'Info', description: 'El horario se gestiona desde los módulos del curso.' });
                                          setShowBulkScheduleModal(false);
                                          setBulkSchedule([]);
                                          setSelectedIds([]);
                                          fetchCourses();
                                        } catch {
                                          toast({ title: 'Error', description: 'No se pudo asignar el horario', variant: 'destructive' });
                                        } finally {
                                          setSaving(false);
                                        }
                                      }}
                                      disabled={bulkSchedule.length === 0 || saving}
                                    >
                                      Asignar Horario
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                      <TableCell className={quickEditMode ? "cursor-pointer group" : ""}>
                        {quickEditMode ? (
                          <Input
                            value={quickEditChanges[course.id]?.name ?? course.name}
                            onChange={e => handleQuickEditChange(course.id, 'name', e.target.value)}
                          />
                        ) : (
                          <div className="font-bold group-hover:underline group-hover:text-blue-600 flex items-center">
                            {course.name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={quickEditMode ? "cursor-pointer group" : ""}>
                        {quickEditMode ? (
                          <Select
                            value={quickEditChanges[course.id]?.teacher_principal_id ?? course.teacher_principal_id}
                            onValueChange={val => handleQuickEditChange(course.id, 'teacher_principal_id', val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar profesor" />
                            </SelectTrigger>
                            <SelectContent>
                              {teachers.map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="group-hover:underline group-hover:text-blue-600 flex items-center">
                            {course.teacher ? `${course.teacher.first_name} ${course.teacher.last_name}` : ''}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={quickEditMode ? "cursor-pointer group" : ""}>
                        {quickEditMode ? (
                          <Select
                            value={quickEditChanges[course.id]?.academic_year ?? course.academic_year}
                            onValueChange={val => handleQuickEditChange(course.id, 'academic_year', val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar año" />
                            </SelectTrigger>
                            <SelectContent>
                              {[2024,2025,2026,2027].map(y => (
                                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="group-hover:underline group-hover:text-blue-600 flex items-center">
                            {course.academic_year}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={quickEditMode ? "cursor-pointer group" : ""}>
                        <span className="group-hover:underline group-hover:text-blue-600 flex items-center">
                          <span className="text-gray-400">Gestionado por módulos</span>
                          {quickEditMode && (
                            <Button size="sm" variant="ghost" className="ml-1 p-1" onClick={e => { e.stopPropagation(); openScheduleModal(course); }}><Edit className="w-3 h-3" /></Button>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {quickEditMode ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={quickEditChanges[course.id]?.is_active ?? course.is_active}
                              onCheckedChange={val => handleQuickEditChange(course.id, 'is_active', val)}
                            />
                            <span className={(quickEditChanges[course.id]?.is_active ?? course.is_active) ? "text-green-700" : "text-gray-500"}>
                              {(quickEditChanges[course.id]?.is_active ?? course.is_active) ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Switch checked={course.is_active} disabled />
                            <span className={course.is_active ? "text-green-700" : "text-gray-500"}>
                              {course.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(course)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteModal(course)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
              {filteredCourses.length === 0 && (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No se encontraron cursos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Modal Crear Curso */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Curso</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre del Curso</Label>
                <Input placeholder="Ej: Matemáticas Básicas" value={formData.name} onChange={handleInputChange('name')} />
              </div>
              <div>
                <Label>Código del Curso</Label>
                <Input placeholder="Ej: MAT101" value={formData.code} onChange={handleInputChange('code')} />
              </div>
            </div>
            <div className="mt-2">
              <Label>Descripción</Label>
              <Textarea placeholder="Descripción del curso..." value={formData.description} onChange={handleInputChange('description')} />
            </div>
            <div className="mt-2">
              <Label>Profesor Principal *</Label>
              <Select value={formData.teacher_principal_id} onValueChange={handleSelectChange('teacher_principal_id')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar profesor" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <Label>Programa *</Label>
                <Select value={formData.program_id} onValueChange={handleSelectChange('program_id')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar programa" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Semestre *</Label>
                <Input placeholder="Ej: 2024-I" value={formData.semester} onChange={handleInputChange('semester')} />
              </div>
            </div>
            <div className="mt-2">
              <Label>Fecha de Inicio *</Label>
              <Input type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} />
            </div>
          </DialogContent>
        </Dialog>

    {/* Modal Editar Curso */}
    <Dialog open={isEditModalOpen} onOpenChange={(open) => { setIsEditModalOpen(open); if (!open) setEditingCourse(null); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Curso</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleEditCourse();
          }}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre del Curso *</Label>
              <Input id="edit-name" value={formData.name} onChange={handleInputChange('name')} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">Código *</Label>
              <Input id="edit-code" value={formData.code} onChange={handleInputChange('code')} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descripción</Label>
            <Textarea id="edit-description" value={formData.description} onChange={handleInputChange('description')} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-academic-year">Año Académico *</Label>
              <Input id="edit-academic-year" value={formData.academic_year} onChange={handleInputChange('academic_year')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-semester">Semestre *</Label>
              <Input id="edit-semester" placeholder="Ej: 2024-I" value={formData.semester} onChange={handleInputChange('semester')} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-program">Programa *</Label>
            <Select value={formData.program_id} onValueChange={handleSelectChange('program_id')}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar programa" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start-date">Fecha de Inicio *</Label>
              <Input id="edit-start-date" type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end-date">Fecha de Fin</Label>
              <Input id="edit-end-date" type="date" value={formData.end_date} onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-teacher">Profesor Principal *</Label>
            <Select value={formData.teacher_principal_id} onValueChange={handleSelectChange('teacher_principal_id')}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar profesor" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.first_name} {teacher.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profesores adicionales se gestionan desde course_teachers (Categoría B) */}

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> El horario del curso (días y horas) se gestiona desde la sección "Horario del Curso" en la página del curso.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" disabled={saving}>
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Modal Eliminar Curso */}
    <Dialog open={isDeleteModalOpen} onOpenChange={(open) => { setIsDeleteModalOpen(open); if (!open) setDeletingCourse(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>¿Estás seguro?</DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          Esta acción no se puede deshacer. Se eliminará el curso "{deletingCourse?.name}" permanentemente.
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button" disabled={saving}>Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDeleteCourse} disabled={saving}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </DashboardLayout>
  );
};

export default AdminCourseManagement;