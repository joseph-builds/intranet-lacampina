import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { BookOpen, Edit, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface CourseGroup {
  level: string;
  grades: string[];
}

interface Course {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  grades_taught?: CourseGroup[]; // <- Modificado para agrupar por niveles
}

interface CourseFormData {
  name: string;
  code: string;
  description: string;
}

const AdminCourseManagement = () => {
  const { toast } = useToast();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  
  const [formData, setFormData] = useState<CourseFormData>({ name: '', code: '', description: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [quickEditChanges, setQuickEditChanges] = useState<{ [id: string]: Partial<Course> }>({});

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      
      // OPTIMIZACIÓN: Cruzar con niveles académicos
      const { data, error } = await supabase
        .from('courses')
        .select(`
          id, name, code, description, is_active,
          base_courses (
            grade:academic_grades (
              name,
              level:academic_levels (name)
            )
          )
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // AGRUPACIÓN: Ordenar los grados por su Nivel respectivo
      const formattedCourses = (data || []).map((c: any) => {
        const grouped: Record<string, Set<string>> = {};
        
        if (c.base_courses) {
          c.base_courses.forEach((bc: any) => {
            if (bc.grade && bc.grade.level?.name && bc.grade.name) {
              const levelName = bc.grade.level.name;
              if (!grouped[levelName]) grouped[levelName] = new Set();
              grouped[levelName].add(bc.grade.name);
            }
          });
        }

        const grades_taught: CourseGroup[] = Object.keys(grouped).map(lvl => ({
          level: lvl,
          grades: Array.from(grouped[lvl]).sort() // Ordenar grados alfabéticamente
        }));

        return { ...c, grades_taught };
      });

      setCourses(formattedCourses as Course[]);
    } catch (error: any) {
      toast({ title: "Error", description: "No se pudieron cargar los cursos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = useCallback((field: keyof CourseFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

  const resetForm = useCallback(() => setFormData({ name: '', code: '', description: '' }), []);

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setFormData({ name: course.name, code: course.code, description: course.description || '' });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (course: Course) => {
    setDeletingCourse(course);
    setIsDeleteModalOpen(true);
  };

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = course.name.toLowerCase().includes(searchLower) || course.code.toLowerCase().includes(searchLower);
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && course.is_active) || (filterStatus === 'inactive' && !course.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [courses, searchTerm, filterStatus]);

  const handleQuickEditChange = (courseId: string, field: keyof Course, value: any) => {
    setQuickEditChanges(prev => ({ ...prev, [courseId]: { ...prev[courseId], [field]: value } }));
  };

  const clearQuickEditChanges = () => setQuickEditChanges({});

  const saveAllQuickEdits = async () => {
    const updates = Object.entries(quickEditChanges);
    if (updates.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(updates.map(([id, changes]) => supabase.from('courses').update(changes).eq('id', id)));
      toast({ title: 'Cambios guardados', description: 'Todos los cambios fueron guardados exitosamente.' });
      clearQuickEditChanges();
      setQuickEditMode(false);
      fetchCourses();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron guardar los cambios', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCourseStatus = async (course: Course, newStatus: boolean) => {
    try {
      const { error } = await supabase.from('courses').update({ is_active: newStatus }).eq('id', course.id);
      if (error) throw error;
      toast({ title: "Estado actualizado", description: `El curso ahora está ${newStatus ? 'activo' : 'inactivo'}.` });
      fetchCourses();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cambiar el estado.", variant: "destructive" });
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return toast({ title: "Campos requeridos", variant: "destructive" });
    setSaving(true);
    try {
      const { error } = await supabase.from('courses').insert([{ name: formData.name.trim(), code: formData.code.trim(), description: formData.description.trim(), is_active: true }]);
      if (error) throw error;
      toast({ title: "Curso creado", description: `El curso "${formData.name}" fue añadido al catálogo.` });
      setIsCreateModalOpen(false);
      resetForm();
      fetchCourses();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo crear.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('courses').update({ name: formData.name.trim(), code: formData.code.trim(), description: formData.description.trim() }).eq('id', editingCourse.id);
      if (error) throw error;
      toast({ title: "Curso actualizado", description: "Los cambios fueron guardados." });
      setIsEditModalOpen(false);
      setEditingCourse(null);
      resetForm();
      fetchCourses();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteCourse = async () => {
    if (!deletingCourse) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('courses').delete().eq('id', deletingCourse.id);
      if (error) throw error;
      toast({ title: "Curso eliminado" });
      fetchCourses();
    } catch (error) {
      toast({ title: "Error", description: "Es posible que esté asignado a una malla curricular.", variant: "destructive" });
    } finally {
      setSaving(false); setIsDeleteModalOpen(false); setDeletingCourse(null);
    }
  };

  if (loading && courses.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6"><div className="animate-pulse"><div className="h-8 bg-muted rounded w-1/3 mb-6"></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted rounded"></div>)}</div></div></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Catálogo General de Cursos</h1>
          <p className="text-gray-600 mb-6">Administra las asignaturas base. Luego podrás asignarlas a los diferentes grados en la Malla Curricular.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">Total en Catálogo <BookOpen className="inline h-5 w-5 text-blue-500" /></div>
                <div className="text-3xl font-bold text-gray-800">{courses.length}</div>
              </div>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">Cursos Activos <CheckCircle2 className="inline h-5 w-5 text-green-500" /></div>
                <div className="text-3xl font-bold text-gray-800">{courses.filter(c => c.is_active).length}</div>
              </div>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-gray-400">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-600 flex items-center justify-between">Cursos Inactivos <XCircle className="inline h-5 w-5 text-gray-400" /></div>
                <div className="text-3xl font-bold text-gray-800">{courses.filter(c => !c.is_active).length}</div>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex gap-4 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-full" />
            </div>
            <select className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
              <option value="all">Todos los estados</option>
              <option value="active">Solo Activos</option>
              <option value="inactive">Solo Inactivos</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <Button variant={quickEditMode ? 'default' : 'outline'} className={quickEditMode ? 'bg-blue-600 text-white hover:bg-blue-700' : ''} onClick={() => { if (quickEditMode && Object.keys(quickEditChanges).length > 0) { if (window.confirm('Tienes cambios sin guardar. ¿Descartarlos?')) { clearQuickEditChanges(); setQuickEditMode(false); } } else { setQuickEditMode(!quickEditMode); } }}>
              {quickEditMode ? 'Salir de Edición Rápida' : 'Edición Rápida'}
            </Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>+ Añadir Curso al Catálogo</Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Nombre de Asignatura</TableHead>
                    <TableHead>Grados donde se Imparte</TableHead>
                    <TableHead className="w-32 text-center">Estado</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCourses.map((course) => (
                    <TableRow key={course.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-mono text-sm text-gray-500">
                        {quickEditMode ? <Input value={quickEditChanges[course.id]?.code ?? course.code} onChange={e => handleQuickEditChange(course.id, 'code', e.target.value)} className="h-8 text-sm" /> : course.code}
                      </TableCell>
                      
                      <TableCell>
                        {quickEditMode ? <Input value={quickEditChanges[course.id]?.name ?? course.name} onChange={e => handleQuickEditChange(course.id, 'name', e.target.value)} className="h-8 font-medium" /> : <span className="font-medium text-gray-900">{course.name}</span>}
                      </TableCell>
                      
                      {/* CELDAS AGRUPADAS POR NIVEL */}
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {course.grades_taught && course.grades_taught.length > 0 ? (
                            course.grades_taught.map((group, idx) => (
                              <div key={idx} className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-bold text-gray-400 uppercase w-16 text-right mr-1">{group.level}:</span>
                                {group.grades.map(g => (
                                  <Badge key={g} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100">{g}</Badge>
                                ))}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">No asignado en mallas</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch checked={quickEditChanges[course.id]?.is_active ?? course.is_active} onCheckedChange={(val) => { if(quickEditMode) { handleQuickEditChange(course.id, 'is_active', val); } else { handleToggleCourseStatus(course, val); } }} />
                          <span className={`text-xs font-medium w-12 text-left ${(quickEditChanges[course.id]?.is_active ?? course.is_active) ? "text-green-600" : "text-gray-400"}`}>
                            {(quickEditChanges[course.id]?.is_active ?? course.is_active) ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(course)} disabled={quickEditMode} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-8 w-8 p-0"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteModal(course)} disabled={quickEditMode} className="text-red-600 hover:text-red-800 hover:bg-red-50 h-8 w-8 p-0"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCourses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No se encontraron asignaturas</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {quickEditMode && Object.keys(quickEditChanges).length > 0 && (
          <Button className="bg-green-600 text-white hover:bg-green-700 fixed bottom-8 right-8 z-50 shadow-xl rounded-full px-6 py-6" onClick={saveAllQuickEdits} disabled={saving}>Guardar Cambios ({Object.keys(quickEditChanges).length})</Button>
        )}
      </div>

      {/* Modales (Crear, Editar, Eliminar) se mantienen iguales */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Añadir Nueva Asignatura</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateCourse} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2"><Label>Nombre de Asignatura *</Label><Input placeholder="Ej: Álgebra" value={formData.name} onChange={handleInputChange('name')} autoFocus required /></div>
              <div className="space-y-2"><Label>Código *</Label><Input placeholder="ALG-01" value={formData.code} onChange={handleInputChange('code')} required /></div>
            </div>
            <div className="space-y-2"><Label>Descripción (Opcional)</Label><Textarea placeholder="Breve descripción del propósito de la asignatura..." value={formData.description} onChange={handleInputChange('description')} rows={3} /></div>
            <DialogFooter className="pt-4"><Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving} className="bg-blue-600 text-white">Guardar en Catálogo</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={(open) => { setIsEditModalOpen(open); if (!open) setEditingCourse(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Asignatura</DialogTitle></DialogHeader>
          <form onSubmit={handleEditCourse} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2"><Label>Nombre de Asignatura *</Label><Input value={formData.name} onChange={handleInputChange('name')} required /></div>
              <div className="space-y-2"><Label>Código *</Label><Input value={formData.code} onChange={handleInputChange('code')} required /></div>
            </div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={formData.description} onChange={handleInputChange('description')} rows={3} /></div>
            <DialogFooter className="pt-4"><Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={saving}>Cancelar</Button><Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" disabled={saving}>Guardar Cambios</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={(open) => { setIsDeleteModalOpen(open); if (!open) setDeletingCourse(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">Eliminar Asignatura</DialogTitle></DialogHeader>
          <div className="py-4 text-gray-600">¿Estás seguro que deseas eliminar <strong>{deletingCourse?.name}</strong> del catálogo general? Esta acción no se puede deshacer.</div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button" disabled={saving}>Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteCourse} disabled={saving}>Sí, Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminCourseManagement;