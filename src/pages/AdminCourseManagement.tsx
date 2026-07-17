import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { BookOpen, Edit, Trash2, Search, CheckCircle2, XCircle, Download, UploadCloud, FileSpreadsheet, Loader2, Info, AlertTriangle, CheckSquare, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CourseGroup {
  level: string;
  grades: string[];
}

interface Course {
  id: string;
  name: string;
  code: string;
  description?: string;
  course_type?: string;
  is_active: boolean;
  grades_taught?: CourseGroup[];
}

interface CourseFormData {
  name: string;
  code: string;
  description: string;
  course_type: string;
}

const AdminCourseManagement = () => {
  const { toast } = useToast();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Opciones para los filtros
  const [dbLevels, setDbLevels] = useState<string[]>([]);
  const [dbGrades, setDbGrades] = useState<{name: string, level: string}[]>([]);
  
  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkTypeModalOpen, setIsBulkTypeModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  
  // Estados de edición y eliminación
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourses, setDeletingCourses] = useState<Course[]>([]); 
  
  const [formData, setFormData] = useState<CourseFormData>({ name: '', code: '', description: '', course_type: '' });
  
  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTypeValue, setBulkTypeValue] = useState('');
  const [bulkStatusValue, setBulkStatusValue] = useState<'active' | 'inactive'>('active');
  
  // Filtros y Paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [quickEditChanges, setQuickEditChanges] = useState<{ [id: string]: Partial<Course> }>({});

  useEffect(() => {
    fetchCourses();
    fetchFiltersData();
  }, []);

  useEffect(() => {
    setFilterGrade('all');
  }, [filterLevel]);

  const fetchFiltersData = async () => {
    try {
      const { data: levelsData } = await supabase.from('academic_levels').select('name').order('name');
      if (levelsData) setDbLevels(levelsData.map(l => l.name));

      const { data: gradesData } = await supabase.from('academic_grades').select('name, level:academic_levels(name)').order('name');
      if (gradesData) setDbGrades(gradesData.map((g: any) => ({ name: g.name, level: g.level?.name })));
    } catch (error) {
      console.error("Error cargando filtros", error);
    }
  };

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select(`
          id, name, code, description, is_active, course_type,
          base_courses (
            grade:academic_grades (name, level:academic_levels (name))
          )
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      
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
          grades: Array.from(grouped[lvl]).sort()
        }));
        return { ...c, grades_taught };
      });

      setCourses(formattedCourses as Course[]);
      setSelectedIds([]); 
    } catch (error: any) {
      toast({ title: "Error", description: "Fallo al cargar cursos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = useCallback((field: keyof CourseFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

  const resetForm = useCallback(() => setFormData({ name: '', code: '', description: '', course_type: '' }), []);

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setFormData({ name: course.name, code: course.code, description: course.description || '', course_type: course.course_type || '' });
    setIsEditModalOpen(true);
  };

  // FILTRADO
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = course.name.toLowerCase().includes(searchLower) || course.code.toLowerCase().includes(searchLower) || (course.course_type && course.course_type.toLowerCase().includes(searchLower));
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && course.is_active) || (filterStatus === 'inactive' && !course.is_active);
      const matchesLevel = filterLevel === 'all' || (course.grades_taught && course.grades_taught.some(g => g.level === filterLevel));
      const matchesGrade = filterGrade === 'all' || (course.grades_taught && course.grades_taught.some(g => g.level === filterLevel && g.grades.includes(filterGrade)));

      return matchesSearch && matchesStatus && matchesLevel && matchesGrade;
    });
  }, [courses, searchTerm, filterStatus, filterLevel, filterGrade]);

  // PAGINACIÓN
  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCourses.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCourses, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterLevel, filterGrade, itemsPerPage]);

  // SELECCIÓN MÚLTIPLE
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageIds = paginatedCourses.map(c => c.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = paginatedCourses.map(c => c.id);
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const isAllPageSelected = paginatedCourses.length > 0 && paginatedCourses.every(c => selectedIds.includes(c.id));

  // --- LÓGICA SEGURA DE ELIMINACIÓN MASIVA/INDIVIDUAL ---
  // Estos memos calculan en tiempo real si de los cursos seleccionados para borrar, alguno está bloqueado.
  const blockedFromDeletion = useMemo(() => {
    return deletingCourses.filter(c => c.grades_taught && c.grades_taught.length > 0);
  }, [deletingCourses]);

  const safeToDelete = useMemo(() => {
    return deletingCourses.filter(c => !c.grades_taught || c.grades_taught.length === 0);
  }, [deletingCourses]);

  const handleBulkDelete = async () => {
    if (safeToDelete.length === 0) return;
    setSaving(true);
    try {
      const idsToDelete = safeToDelete.map(c => c.id);
      const { error } = await supabase.from('courses').delete().in('id', idsToDelete);
      if (error) throw error;
      
      toast({ title: "Cursos eliminados", description: `Se eliminaron ${idsToDelete.length} curso(s) correctamente.` });
      setIsDeleteModalOpen(false);
      setDeletingCourses([]);
      fetchCourses();
    } catch (error) {
      toast({ title: "Error al eliminar", description: "Ocurrió un error en la base de datos.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkType = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const typeToSave = bulkTypeValue.trim() || null;
      const { error } = await supabase.from('courses').update({ course_type: typeToSave }).in('id', selectedIds);
      if (error) throw error;
      
      toast({ title: "Tipos actualizados", description: `Se actualizó la etiqueta de ${selectedIds.length} curso(s).` });
      setIsBulkTypeModalOpen(false);
      setBulkTypeValue('');
      fetchCourses();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkStatus = async () => {
    setSaving(true);
    try {
      const isActive = bulkStatusValue === 'active';
      const { error } = await supabase.from('courses').update({ is_active: isActive }).in('id', selectedIds);
      if (error) throw error;
      
      toast({ title: "Estados actualizados", description: `Se modificó el estado de ${selectedIds.length} curso(s).` });
      setIsBulkStatusModalOpen(false);
      fetchCourses();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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

  const checkDuplicates = (name: string, code: string, excludeId?: string) => {
    const nameLower = name.trim().toLowerCase();
    const codeLower = code.trim().toLowerCase();
    return courses.some(c => c.id !== excludeId && (c.name.toLowerCase() === nameLower || c.code.toLowerCase() === codeLower));
  };

  const handleToggleCourseStatus = async (course: Course, newStatus: boolean) => {
    try {
      const { error } = await supabase.from('courses').update({ is_active: newStatus }).eq('id', course.id);
      if (error) throw error;
      toast({ title: "Estado actualizado", description: `El curso ahora está ${newStatus ? 'activo' : 'inactivo'}.` });
      fetchCourses();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return toast({ title: "Campos requeridos", variant: "destructive" });
    if (checkDuplicates(formData.name, formData.code)) return toast({ title: "Curso Duplicado", description: "Ya existe un curso con este nombre o código en el catálogo.", variant: "destructive" });

    setSaving(true);
    try {
      const { error } = await supabase.from('courses').insert([{ 
        name: formData.name.trim(), code: formData.code.trim(), description: formData.description.trim() || null, 
        course_type: formData.course_type.trim() || null, is_active: true 
      }]);
      if (error) throw error;
      toast({ title: "Curso creado", description: `El curso "${formData.name}" fue añadido.` });
      setIsCreateModalOpen(false);
      resetForm();
      fetchCourses();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    if (checkDuplicates(formData.name, formData.code, editingCourse.id)) return toast({ title: "Curso Duplicado", variant: "destructive" });

    setSaving(true);
    try {
      const { error } = await supabase.from('courses').update({ 
        name: formData.name.trim(), code: formData.code.trim(), description: formData.description.trim() || null,
        course_type: formData.course_type.trim() || null 
      }).eq('id', editingCourse.id);
      if (error) throw error;
      toast({ title: "Curso actualizado" });
      setIsEditModalOpen(false);
      setEditingCourse(null);
      resetForm();
      fetchCourses();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally { setSaving(false); }
  };

  // PLANTILLA EXCEL
  const downloadTemplate = () => {
    const headers = "Nombre de Asignatura;Código;Descripción;Tipo de Curso\n";
    const example1 = "Álgebra Avanzada;ALG-02;Curso enfocado en ecuaciones;Matemática\n";
    const blob = new Blob(['\uFEFF' + headers + example1], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "plantilla_importacion_cursos.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length <= 1) throw new Error("El archivo está vacío.");

        const toInsert = [];
        const duplicates = [];
        const separator = rows[0].includes(';') ? ';' : ',';

        for (let i = 1; i < rows.length; i++) {
          const regex = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
          const cols = rows[i].split(regex).map(col => col.replace(/^"|"$/g, '').trim());
          if (cols.length < 2) continue;

          const name = cols[0], code = cols[1], description = cols[2] || null, course_type = cols[3] || null;
          if (!name || !code) continue;

          const isDup = courses.some(c => c.name.toLowerCase() === name.toLowerCase() || c.code.toLowerCase() === code.toLowerCase()) || 
                        toInsert.some(c => c.name.toLowerCase() === name.toLowerCase() || c.code.toLowerCase() === code.toLowerCase());

          if (isDup) duplicates.push(code);
          else toInsert.push({ name, code, description, course_type, is_active: true });
        }

        if (toInsert.length > 0) {
          const { error } = await supabase.from('courses').insert(toInsert);
          if (error) throw error;
        }

        toast({ title: "Importación finalizada", description: `Se agregaron ${toInsert.length} cursos. Se omitieron ${duplicates.length} duplicados.` });
        fetchCourses();
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setIsUploading(false);
        e.target.value = ''; 
      }
    };
    reader.readAsText(file);
  };

  if (loading && courses.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6"><div className="animate-pulse"><div className="h-8 bg-muted rounded w-1/3 mb-6"></div></div></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        
        {/* DASHBOARD HEADER */}
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-blue-600"/> Catálogo General de Cursos
          </h1>
          <p className="text-gray-600 mb-6">Administra las asignaturas base y clasifícalas por tipo. Luego podrás asignarlas a los diferentes grados.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
              <div className="p-4"><div className="text-sm font-medium text-gray-600">Total en Catálogo</div><div className="text-3xl font-bold text-gray-800">{courses.length}</div></div>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
              <div className="p-4"><div className="text-sm font-medium text-gray-600">Cursos Activos</div><div className="text-3xl font-bold text-gray-800">{courses.filter(c => c.is_active).length}</div></div>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-gray-400">
              <div className="p-4"><div className="text-sm font-medium text-gray-600">Cursos Inactivos</div><div className="text-3xl font-bold text-gray-800">{courses.filter(c => !c.is_active).length}</div></div>
            </Card>
          </div>
        </div>

        {/* BARRA DE FILTROS SUPERIOR */}
        <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar por curso, código o tipo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-full" />
              </div>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Niveles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Niveles</SelectItem>
                  {dbLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterGrade} onValueChange={setFilterGrade} disabled={filterLevel === 'all'}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Grados" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Grados</SelectItem>
                  {dbGrades.filter(g => g.level === filterLevel).map(g => <SelectItem key={g.name} value={g.name}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Mostrar</span>
                <Select value={String(itemsPerPage)} onValueChange={val => setItemsPerPage(Number(val))}>
                  <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant={quickEditMode ? 'default' : 'outline'} className={quickEditMode ? 'bg-blue-600 text-white' : ''} onClick={() => { if (quickEditMode && Object.keys(quickEditChanges).length > 0) { if (window.confirm('¿Descartar cambios?')) { clearQuickEditChanges(); setQuickEditMode(false); } } else { setQuickEditMode(!quickEditMode); } }}>
                {quickEditMode ? 'Salir Edición Rápida' : 'Edición Rápida'}
              </Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-md" onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>
                + Añadir Curso
              </Button>
            </div>
          </div>

          {/* BARRA DE ACCIONES EN MASA */}
          {selectedIds.length > 0 && (
            <div className="bg-blue-50/50 p-3 flex flex-wrap items-center justify-between rounded-md border border-blue-200 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-blue-700 font-medium">
                <CheckSquare className="w-5 h-5" />
                {selectedIds.length} curso(s) seleccionado(s)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="bg-white border-blue-200 hover:bg-blue-50" onClick={() => setIsBulkStatusModalOpen(true)}>Cambiar Estado</Button>
                <Button variant="outline" size="sm" className="bg-white border-blue-200 hover:bg-blue-50" onClick={() => setIsBulkTypeModalOpen(true)}>Asignar Tipo</Button>
                <Button variant="destructive" size="sm" onClick={() => { 
                  setDeletingCourses(courses.filter(c => selectedIds.includes(c.id))); 
                  setIsDeleteModalOpen(true); 
                }}>
                  Eliminar Seleccionados
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* TABLA PRINCIPAL */}
        <Card className="border-0 shadow-sm rounded-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={isAllPageSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableHead>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Asignatura</TableHead>
                    <TableHead>Etiqueta / Tipo</TableHead>
                    <TableHead>Grados Asignados</TableHead>
                    <TableHead className="w-28 text-center">Estado</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCourses.map((course) => (
                    <TableRow key={course.id} className={`hover:bg-gray-50/50 ${selectedIds.includes(course.id) ? 'bg-blue-50/30' : ''}`}>
                      <TableCell className="text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={selectedIds.includes(course.id)}
                          onChange={(e) => handleSelectOne(course.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-500">
                        {quickEditMode ? <Input value={quickEditChanges[course.id]?.code ?? course.code} onChange={e => handleQuickEditChange(course.id, 'code', e.target.value)} className="h-8 text-sm w-20" /> : course.code}
                      </TableCell>
                      <TableCell>
                        {quickEditMode ? (
                          <Input value={quickEditChanges[course.id]?.name ?? course.name} onChange={e => handleQuickEditChange(course.id, 'name', e.target.value)} className="h-8 font-medium" />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{course.name}</span>
                            {course.description && (
                              <div title={course.description} className="cursor-help flex items-center justify-center rounded-full bg-blue-50 p-1 hover:bg-blue-100 transition-colors shrink-0">
                                <Info className="w-4 h-4 text-blue-500" />
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {quickEditMode ? (
                          <Input value={quickEditChanges[course.id]?.course_type ?? course.course_type ?? ''} onChange={e => handleQuickEditChange(course.id, 'course_type', e.target.value)} className="h-8 text-xs w-28" placeholder="Ej: Ciencias" />
                        ) : (
                          course.course_type ? <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">{course.course_type}</Badge> : <span className="text-xs text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          {course.grades_taught && course.grades_taught.length > 0 ? (
                            course.grades_taught.map((group, idx) => (
                              <div key={idx} className="flex flex-wrap items-center gap-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase w-20 text-right mr-1">{group.level}:</span>
                                {group.grades.map(g => (
                                  <Badge key={g} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] py-0">{g}</Badge>
                                ))}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">No asignado</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch checked={quickEditChanges[course.id]?.is_active ?? course.is_active} onCheckedChange={(val) => { if(quickEditMode) { handleQuickEditChange(course.id, 'is_active', val); } else { handleToggleCourseStatus(course, val); } }} />
                          <span className={`text-[11px] font-bold w-10 text-left ${(quickEditChanges[course.id]?.is_active ?? course.is_active) ? "text-green-600" : "text-gray-400"}`}>
                            {(quickEditChanges[course.id]?.is_active ?? course.is_active) ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(course)} disabled={quickEditMode} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-8 w-8 p-0"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setDeletingCourses([course]); setIsDeleteModalOpen(true); }} disabled={quickEditMode} className="text-red-600 hover:text-red-800 hover:bg-red-50 h-8 w-8 p-0"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedCourses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No se encontraron asignaturas con estos filtros</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white border-t">
              <div className="text-sm text-gray-500 mb-4 sm:mb-0">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredCourses.length)} de {filteredCourses.length} cursos
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-gray-600">Anterior</Button>
                <div className="flex items-center px-4 py-2 text-sm font-medium bg-white rounded-md border text-gray-700">
                  Página {currentPage} de {Math.max(1, totalPages)}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="text-gray-600">Siguiente</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ZONA IMPORTACIÓN */}
        <div className="pt-6">
          <Card className="border border-blue-100 bg-blue-50/20 shadow-sm">
            <CardHeader className="pb-3 border-b bg-white rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800"><FileSpreadsheet className="w-5 h-5" /> Importación Masiva de Cursos</CardTitle>
              <CardDescription>Sube un archivo CSV para registrar decenas de cursos en un solo clic.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                    <div>
                      <h4 className="font-semibold text-gray-800">Descarga la Plantilla Base</h4>
                      <p className="text-sm text-gray-500 mb-2">Usa nuestro formato exacto para evitar errores.</p>
                      <Button variant="outline" size="sm" onClick={downloadTemplate} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                        <Download className="w-4 h-4 mr-2" /> Descargar Plantilla .CSV
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                    <div>
                      <h4 className="font-semibold text-gray-800">Sube tu archivo completado</h4>
                      <p className="text-sm text-gray-500">El sistema omitirá automáticamente los cursos duplicados.</p>
                    </div>
                  </div>
                </div>
                <div className="relative border-2 border-dashed border-blue-200 rounded-xl p-8 text-center bg-white hover:bg-blue-50/50 transition-colors cursor-pointer">
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-4">
                      <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
                      <p className="text-sm font-medium text-gray-700">Procesando archivo...</p>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-12 h-12 mx-auto text-blue-400 mb-3" />
                      <p className="text-sm font-medium text-gray-700">Haz clic para buscar un archivo CSV</p>
                      <Input type="file" accept=".csv" className="hidden" id="file-upload" onChange={handleFileUpload} disabled={isUploading} />
                      <label htmlFor="file-upload" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md text-sm cursor-pointer hover:bg-blue-700 shadow-sm transition-colors">
                        Seleccionar Archivo
                      </label>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {quickEditMode && Object.keys(quickEditChanges).length > 0 && (
          <Button className="bg-green-600 text-white hover:bg-green-700 fixed bottom-8 right-8 z-50 shadow-xl rounded-full px-6 py-6" onClick={saveAllQuickEdits} disabled={saving}>
            Guardar Cambios ({Object.keys(quickEditChanges).length})
          </Button>
        )}
      </div>

      {/* --- MODALES --- */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Añadir Nueva Asignatura</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateCourse} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2"><Label>Nombre de Asignatura *</Label><Input placeholder="Ej: Álgebra" value={formData.name} onChange={handleInputChange('name')} autoFocus required /></div>
              <div className="space-y-2"><Label>Código *</Label><Input placeholder="ALG-01" value={formData.code} onChange={handleInputChange('code')} required /></div>
            </div>
            <div className="space-y-2"><Label>Etiqueta / Tipo (Opcional)</Label><Input placeholder="Ej: Ciencias, Letras, Taller..." value={formData.course_type} onChange={handleInputChange('course_type')} /></div>
            <div className="space-y-2"><Label>Descripción (Opcional)</Label><Textarea placeholder="Breve descripción del propósito de la asignatura..." value={formData.description} onChange={handleInputChange('description')} rows={3} /></div>
            <DialogFooter className="pt-4"><Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving} className="bg-blue-600 text-white shadow-md">Guardar en Catálogo</Button></DialogFooter>
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
            <div className="space-y-2"><Label>Etiqueta / Tipo (Opcional)</Label><Input placeholder="Ej: Ciencias" value={formData.course_type} onChange={handleInputChange('course_type')} /></div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={formData.description} onChange={handleInputChange('description')} rows={3} /></div>
            <DialogFooter className="pt-4"><Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={saving}>Cancelar</Button><Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 shadow-md" disabled={saving}>Guardar Cambios</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ELIMINACIÓN SEGURA (Escudo de Malla Curricular) */}
      <Dialog open={isDeleteModalOpen} onOpenChange={(open) => { setIsDeleteModalOpen(open); if (!open) setDeletingCourses([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5"/> Advertencia de Eliminación
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-gray-700">
            {blockedFromDeletion.length > 0 ? (
              <div className="mb-4">
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
                  <div className="flex items-center gap-2 text-red-800 font-bold mb-2">
                    <ShieldAlert className="w-5 h-5" />
                    ACCIÓN BLOQUEADA
                  </div>
                  <p className="text-sm text-red-700 mb-2">
                    No puedes eliminar los siguientes cursos porque <strong>están asignados a una malla curricular</strong>. Quítalos de la malla (o desactívalos) primero:
                  </p>
                  <ul className="list-disc list-inside text-xs font-semibold text-red-900 max-h-32 overflow-y-auto pl-2">
                    {blockedFromDeletion.map(c => <li key={c.id}>{c.name} ({c.code})</li>)}
                  </ul>
                </div>
                {safeToDelete.length > 0 && (
                  <p className="mt-4 text-sm font-medium">Los otros {safeToDelete.length} curso(s) sí pueden ser eliminados.</p>
                )}
              </div>
            ) : (
              <p className="mb-3">¿Estás absolutamente seguro que deseas eliminar {deletingCourses.length > 1 ? `estos ${deletingCourses.length} cursos` : 'este curso'} del catálogo general?</p>
            )}
            
            {safeToDelete.length > 0 && blockedFromDeletion.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 max-h-32 overflow-y-auto mb-3">
                <ul className="list-disc list-inside text-sm font-medium text-gray-800 space-y-1">
                  {safeToDelete.map(c => <li key={c.id}>{c.name} <span className="text-gray-500 font-normal">({c.code})</span></li>)}
                </ul>
              </div>
            )}
            
            {safeToDelete.length > 0 && (
               <p className="text-sm text-gray-500">Esta acción no se puede deshacer y borrará permanentemente los datos.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button" disabled={saving}>Cancelar</Button></DialogClose>
            {safeToDelete.length > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {blockedFromDeletion.length > 0 ? `Eliminar solo los ${safeToDelete.length} permitidos` : 'Sí, Eliminar Definitivamente'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkTypeModalOpen} onOpenChange={setIsBulkTypeModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Asignar Etiqueta / Tipo</DialogTitle></DialogHeader>
          <form onSubmit={handleBulkType} className="space-y-4 py-2">
            <p className="text-sm text-gray-600">Se aplicará esta etiqueta a los <strong>{selectedIds.length}</strong> cursos seleccionados.</p>
            <div className="space-y-2">
              <Label>Nueva Etiqueta (Ej: Ciencias, Talleres, etc.)</Label>
              <Input autoFocus value={bulkTypeValue} onChange={(e) => setBulkTypeValue(e.target.value)} placeholder="Escribe el tipo de curso..." />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsBulkTypeModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 text-white">Aplicar a Todos</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkStatusModalOpen} onOpenChange={setIsBulkStatusModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cambiar Estado de Cursos</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">Selecciona el nuevo estado para los <strong>{selectedIds.length}</strong> cursos seleccionados.</p>
            <Select value={bulkStatusValue} onValueChange={(val: any) => setBulkStatusValue(val)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Establecer como Activos</SelectItem>
                <SelectItem value="inactive">Establecer como Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkStatusModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkStatus} disabled={saving} className="bg-blue-600 text-white">Aplicar Cambio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
};

export default AdminCourseManagement;