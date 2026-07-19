import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { School, Plus, Users, Shuffle, Loader2, ArrowRight, Trash2, GraduationCap, ShieldAlert, CheckSquare, UserX, UserMinus, AlertTriangle, UserCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

interface Nivel { id: string; name: string; }
interface Grado { id: string; level_id: string; name: string; }
interface Seccion { id: string; grade_id: string; name: string; room_number: string; academic_year: number; alumno_count?: number; tutor?: { first_name: string; last_name: string }; }
interface AlumnoEnGrado { id: string; first_name: string; last_name: string; email: string; section_id?: string; is_active: boolean; }

// MAGIA: El año ahora es dinámico y cambiará automáticamente en año nuevo
const CURRENT_YEAR = new Date().getFullYear();

const AdminClassrooms = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [alumnos, setAlumnos] = useState<AlumnoEnGrado[]>([]);
  
  const [nivelActivo, setNivelActivo] = useState<string>('');
  const [gradoActivo, setGradoActivo] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  
  const [isSeccionModalOpen, setIsSeccionModalOpen] = useState(false);
  const [formSeccion, setFormSeccion] = useState({ name: '', room_number: '' });

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedInactiveIds, setSelectedInactiveIds] = useState<string[]>([]);
  const [bulkTargetSection, setBulkTargetSection] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
  
  const [inactiveToDelete, setInactiveToDelete] = useState<AlumnoEnGrado | null>(null);

  useEffect(() => { initLoad(); }, []);

  useEffect(() => {
    if (nivelActivo && grados.length > 0) {
      const filtered = grados.filter(g => g.level_id === nivelActivo);
      setGradoActivo(filtered.length > 0 ? filtered[0].id : '');
    } else {
      setGradoActivo('');
    }
  }, [nivelActivo, grados]);

  useEffect(() => {
    if (gradoActivo) {
      fetchDataEstructura(gradoActivo);
      setSelectedStudentIds([]); 
      setSelectedInactiveIds([]);
    } else { 
      setSecciones([]); setAlumnos([]); 
    }
  }, [gradoActivo]);

  const initLoad = async () => {
    setLoading(true);
    try {
      const { data: dataNiveles } = await supabase.from('academic_levels').select('*').order('level_order');
      const { data: dataGrados } = await supabase.from('academic_grades').select('*').order('grade_order');
      setNiveles(dataNiveles || []);
      setGrados(dataGrados || []);
      if (dataNiveles?.length) setNivelActivo(dataNiveles[0].id);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataEstructura = async (gradeId: string) => {
    setLoading(true);
    try {
      const { data: dataSecciones } = await supabase.from('sections')
        .select('*, tutor:profiles!tutor_id(first_name, last_name)')
        .eq('grade_id', gradeId)
        .eq('academic_year', CURRENT_YEAR)
        .order('name');
      const secs = dataSecciones || [];

      const { data: dataAlumnos } = await supabase.from('profiles')
        .select('id, first_name, last_name, email, is_active')
        .eq('role', 'student')
        .eq('current_grade_id', gradeId)
        .order('last_name');
      const alums = dataAlumnos || [];

      const { data: matriculas } = await supabase.from('student_sections')
        .select('student_id, section_id')
        .eq('academic_year', CURRENT_YEAR)
        .in('section_id', secs.map(s => s.id));

      const alumnosConSeccion = alums.map(al => {
        const mat = matriculas?.find(m => m.student_id === al.id);
        return { ...al, section_id: mat?.section_id };
      });

      const seccionesConConteo = secs.map(sec => {
        const conteo = alumnosConSeccion.filter(a => a.section_id === sec.id && a.is_active).length;
        return { ...sec, alumno_count: conteo };
      });

      setAlumnos(alumnosConSeccion);
      setSecciones(seccionesConConteo as Seccion[]);
    } catch (error) {
      console.error("Error cargando estructura:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearSeccion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradoActivo) return;

    const duplicado = secciones.some(s => s.name.trim().toLowerCase() === formSeccion.name.trim().toLowerCase());
    if (duplicado) {
      toast({ title: "Nombre duplicado", description: "Ya existe un aula con ese nombre.", variant: "destructive" });
      return;
    }

    setProcesando(true);
    try {
      const { data: nuevaSec, error: errSec } = await supabase.from('sections').insert([{
        grade_id: gradoActivo, name: formSeccion.name.trim(), room_number: formSeccion.room_number, academic_year: CURRENT_YEAR
      }]).select().single();
      
      if (errSec) throw errSec;

      const { data: cursosMalla } = await supabase.from('base_courses').select('id').eq('grade_id', gradoActivo);
      if (cursosMalla && cursosMalla.length > 0) {
        const instanciasCursos = cursosMalla.map(curso => ({ section_id: nuevaSec.id, base_course_id: curso.id }));
        await supabase.from('section_courses').insert(instanciasCursos);
      }

      toast({ title: "Sección Creada", description: `Se configuró el aula e importó la malla.` });
      setIsSeccionModalOpen(false);
      setFormSeccion({ name: '', room_number: '' });
      fetchDataEstructura(gradoActivo);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcesando(false);
    }
  };

  const handleEliminarSeccion = async (id: string) => {
    if (!confirm('¿Seguro? Se eliminará la sección y los alumnos quedarán sin aula asignada.')) return;
    try {
      await supabase.from('sections').delete().eq('id', id);
      toast({ title: "Sección eliminada" });
      fetchDataEstructura(gradoActivo);
    } catch (error) {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const handleAsignacionIndividual = async (studentId: string, newSectionId: string) => {
    await procesarAsignacion([studentId], newSectionId);
  };

  const handleBulkAssign = async () => {
    if (selectedStudentIds.length === 0 || !bulkTargetSection) return;
    await procesarAsignacion(selectedStudentIds, bulkTargetSection);
    setSelectedStudentIds([]);
    setBulkTargetSection('');
  };

  const procesarAsignacion = async (studentIds: string[], newSectionId: string) => {
    setProcesando(true);
    try {
      await supabase.from('student_sections').delete().in('student_id', studentIds).eq('academic_year', CURRENT_YEAR);
      if (newSectionId !== 'unassigned') {
        const records = studentIds.map(id => ({ student_id: id, section_id: newSectionId, academic_year: CURRENT_YEAR }));
        await supabase.from('student_sections').insert(records);
      }
      toast({ title: "Asignación actualizada", description: `Se movieron ${studentIds.length} alumno(s).` });
      fetchDataEstructura(gradoActivo);
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setProcesando(false);
    }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
  };
  
  const toggleInactiveSelection = (id: string) => {
    setSelectedInactiveIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
  };

  const handleReparticionAleatoria = async () => {
    const sinAula = alumnosActivos.filter(a => !a.section_id);
    if (secciones.length === 0) return toast({ title: "Error", description: "Crea al menos una sección primero.", variant: "destructive" });
    if (sinAula.length === 0) return toast({ title: "Info", description: "Todos los alumnos activos ya tienen sección." });

    setProcesando(true);
    try {
      const mezclados = [...sinAula].sort(() => Math.random() - 0.5);
      const registros = mezclados.map((alumno, index) => ({
        student_id: alumno.id, section_id: secciones[index % secciones.length].id, academic_year: CURRENT_YEAR
      }));

      await supabase.from('student_sections').insert(registros);
      toast({ title: "Éxito", description: `Se repartieron ${registros.length} alumnos equitativamente.` });
      fetchDataEstructura(gradoActivo);
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setProcesando(false);
    }
  };

  // ----- ACCIONES PARA ESTADOS (ACTIVOS/INACTIVOS) -----
  const handleToggleStatus = async (studentId: string, currentStatus: boolean) => {
    setProcesando(true);
    try {
      await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', studentId);
      toast({ title: "Estado actualizado" });
      setSelectedStudentIds(prev => prev.filter(id => id !== studentId));
      setSelectedInactiveIds(prev => prev.filter(id => id !== studentId));
      fetchDataEstructura(gradoActivo);
    } catch (error: any) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setProcesando(false);
    }
  };

  // Desmatriculación Masiva de Alumnos Activos
  const handleBulkDesmatricular = async () => {
    if (!confirm(`¿Seguro que deseas desmatricular a ${selectedStudentIds.length} alumno(s) activos? Pasarán a la lista de Inactivos.`)) return;
    setProcesando(true);
    try {
      await supabase.from('profiles').update({ is_active: false }).in('id', selectedStudentIds);
      toast({ title: "Alumnos desmatriculados", description: "Fueron movidos a la lista de inactivos." });
      setSelectedStudentIds([]);
      fetchDataEstructura(gradoActivo);
    } catch (error) { toast({ title: "Error", variant: "destructive" }); } finally { setProcesando(false); }
  };

  const handleBulkReactivar = async () => {
    setProcesando(true);
    try {
      await supabase.from('profiles').update({ is_active: true }).in('id', selectedInactiveIds);
      toast({ title: "Alumnos reactivados", description: `Se volvieron a matricular ${selectedInactiveIds.length} alumno(s).` });
      setSelectedInactiveIds([]);
      fetchDataEstructura(gradoActivo);
    } catch (error) { toast({ title: "Error", variant: "destructive" }); } finally { setProcesando(false); }
  };

  const handleBulkDesvincular = async () => {
    if (!confirm(`¿Desvincular a los ${selectedInactiveIds.length} alumnos inactivos de este grado?`)) return;
    setProcesando(true);
    try {
      await supabase.from('profiles').update({ current_grade_id: null }).in('id', selectedInactiveIds);
      await supabase.from('student_sections').delete().in('student_id', selectedInactiveIds).eq('academic_year', CURRENT_YEAR);
      toast({ title: "Alumnos desvinculados" });
      setSelectedInactiveIds([]);
      fetchDataEstructura(gradoActivo);
    } catch (error) { toast({ title: "Error", variant: "destructive" }); } finally { setProcesando(false); }
  };

  const handleBulkDeleteInactive = async () => {
    if (!confirm(`¿Eliminar definitivamente a ${selectedInactiveIds.length} alumno(s) de la BD? Esta acción no se puede deshacer.`)) return;
    setProcesando(true);
    try {
      const studentsToDelete = alumnosInactivos.filter(a => selectedInactiveIds.includes(a.id));
      for (const student of studentsToDelete) {
        await supabase.rpc('delete_user_admin_v2', { target_user_id: student.id, target_email: student.email });
      }
      toast({ title: "Estudiantes eliminados" });
      setSelectedInactiveIds([]);
      fetchDataEstructura(gradoActivo);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setProcesando(false); }
  };

  const handleDesvincularInactivo = async (studentId: string) => {
    if (!confirm('¿Deseas desvincular a este alumno inactivo de este grado?')) return;
    try {
      await supabase.from('profiles').update({ current_grade_id: null }).eq('id', studentId);
      await supabase.from('student_sections').delete().eq('student_id', studentId).eq('academic_year', CURRENT_YEAR);
      toast({ title: "Desvinculado" });
      setSelectedInactiveIds(prev => prev.filter(id => id !== studentId));
      fetchDataEstructura(gradoActivo);
    } catch (error) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleEliminarDefinitivo = async () => {
    if (!inactiveToDelete) return;
    setProcesando(true);
    try {
      await supabase.rpc('delete_user_admin_v2', { target_user_id: inactiveToDelete.id, target_email: inactiveToDelete.email });
      toast({ title: "Eliminado" });
      setInactiveToDelete(null);
      setSelectedInactiveIds(prev => prev.filter(id => id !== inactiveToDelete.id));
      fetchDataEstructura(gradoActivo);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); } finally { setProcesando(false); }
  };

  const alumnosActivos = useMemo(() => alumnos.filter(a => a.is_active), [alumnos]);
  const alumnosInactivos = useMemo(() => alumnos.filter(a => !a.is_active), [alumnos]);
  
  const alumnosActivosFiltrados = useMemo(() => {
    if (filterStatus === 'assigned') return alumnosActivos.filter(a => a.section_id);
    if (filterStatus === 'unassigned') return alumnosActivos.filter(a => !a.section_id);
    return alumnosActivos;
  }, [alumnosActivos, filterStatus]);

  const alumnosSinAula = alumnosActivos.filter(a => !a.section_id).length;
  const allActiveSelected = alumnosActivosFiltrados.length > 0 && alumnosActivosFiltrados.every(a => selectedStudentIds.includes(a.id));
  const allInactiveSelected = alumnosInactivos.length > 0 && alumnosInactivos.every(a => selectedInactiveIds.includes(a.id));

  if (loading && niveles.length === 0) return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
              <School className="h-8 w-8 text-blue-600" /> Distribución de Aulas Virtuales
            </h1>
            <p className="text-muted-foreground mt-1">Crea las secciones y asigna a los alumnos matriculados en el grado para el año escolar actual.</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex gap-4">
            <div className="w-1/2">
              <Label className="text-gray-600 mb-1 block">Nivel Académico</Label>
              <Select value={nivelActivo} onValueChange={setNivelActivo}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{niveles.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-1/2">
              <Label className="text-gray-600 mb-1 block">Grado Académico</Label>
              <Select value={gradoActivo} onValueChange={setGradoActivo}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{grados.filter(g => g.level_id === nivelActivo).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* PARTE 1: SECCIONES */}
        {gradoActivo && (
          <div>
            <div className="flex justify-between items-end mb-4 mt-8">
              <h2 className="text-xl font-bold text-gray-800">Secciones Activas ({secciones.length})</h2>
              <Dialog open={isSeccionModalOpen} onOpenChange={setIsSeccionModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600"><Plus className="w-4 h-4 mr-2" /> Nueva Sección</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Aperturar Nueva Sección</DialogTitle></DialogHeader>
                  <form onSubmit={handleCrearSeccion} className="space-y-4">
                    <div><Label>Nombre identificador *</Label><Input required value={formSeccion.name} onChange={e => setFormSeccion({...formSeccion, name: e.target.value})} placeholder="Ej: A, Los Tigres, 4to-B" autoFocus/></div>
                    <div><Label>Ubicación / Pabellón (Opcional)</Label><Input value={formSeccion.room_number} onChange={e => setFormSeccion({...formSeccion, room_number: e.target.value})} placeholder="Ej: Aula 102 - 1er Piso" /></div>
                    <Button type="submit" className="w-full bg-blue-600" disabled={procesando}>{procesando ? 'Configurando...' : 'Crear Aula y Cargar Malla'}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {secciones.map((sec) => (
                <Card key={sec.id} className="hover:shadow-md transition-shadow border-t-4 border-t-blue-500 flex flex-col">
                  <CardHeader className="flex flex-row justify-between items-center pb-2">
                    <CardTitle className="text-xl">Aula "{sec.name}"</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => handleEliminarSeccion(sec.id)} className="text-red-400 hover:text-red-600 p-0 h-8 w-8"><Trash2 className="w-4 h-4"/></Button>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="text-3xl font-black text-gray-800 flex items-center gap-2 mb-1">
                      <Users className="text-blue-500 w-6 h-6"/> {sec.alumno_count} <span className="text-sm font-medium text-gray-500">Alumnos</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{sec.room_number || 'Ubicación no especificada'}</p>
                    <p className="text-xs font-medium text-gray-600 bg-gray-100 p-2 rounded-md mb-4 mt-auto">
                      Tutor: {sec.tutor ? `${sec.tutor.first_name} ${sec.tutor.last_name}` : <span className="text-red-500 italic">Sin tutor asignado</span>}
                    </p>
                    <Button variant="outline" className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 mt-auto" onClick={() => navigate(`/admin/section/${sec.id}`)}>
                      Gestionar Aula <ArrowRight className="w-4 h-4 ml-2"/>
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {secciones.length === 0 && !loading && (
                <div className="col-span-full text-center py-8 bg-white rounded-lg border border-dashed"><School className="w-12 h-12 mx-auto text-gray-300 mb-2"/><p className="text-gray-500 font-medium">Aún no has creado secciones para este grado.</p></div>
              )}
            </div>
          </div>
        )}

        {/* PARTE 2: ALUMNOS ACTIVOS */}
        {gradoActivo && (
          <Card className="mt-8 shadow-sm border-0 bg-white">
            <CardHeader className="border-b pb-4 space-y-4">
              <div className="flex flex-row justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="w-5 h-5 text-indigo-600"/> Padrón de Alumnos Activos</CardTitle>
                  <CardDescription>Asigna el aula virtual o actualiza el estado de la matrícula.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant={alumnosSinAula > 0 ? "destructive" : "secondary"} className="px-3 py-1 text-sm">{alumnosSinAula} Sin Asignar</Badge>
                  <Button onClick={handleReparticionAleatoria} disabled={procesando || alumnosSinAula === 0 || secciones.length === 0} size="sm" className="bg-indigo-600 hover:bg-indigo-700"><Shuffle className="w-4 h-4 mr-2" /> Repartir Pendientes</Button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50 p-2 rounded-md border gap-4">
                <div className="flex items-center gap-2">
                  <Button variant={filterStatus === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterStatus('all')} className="h-8">Todos</Button>
                  <Button variant={filterStatus === 'assigned' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterStatus('assigned')} className="h-8">Asignados</Button>
                  <Button variant={filterStatus === 'unassigned' ? 'default' : 'ghost'} size="sm" onClick={() => setFilterStatus('unassigned')} className="h-8">Sin Asignar</Button>
                </div>
                
                {selectedStudentIds.length > 0 && (
                  <div className="flex items-center gap-2 bg-blue-100 p-1.5 rounded-md border border-blue-200 animate-in fade-in">
                    <span className="text-xs font-bold text-blue-800 px-2 flex items-center"><CheckSquare className="w-4 h-4 mr-1"/> {selectedStudentIds.length} selec.</span>
                    <Select value={bulkTargetSection} onValueChange={setBulkTargetSection}>
                      <SelectTrigger className="w-[140px] h-8 text-xs bg-white"><SelectValue placeholder="Mover a..."/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-red-600 font-medium">Quitar del aula</SelectItem>
                        {secciones.map(s => <SelectItem key={s.id} value={s.id}>Aula "{s.name}"</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 bg-blue-600 text-xs" disabled={!bulkTargetSection || procesando} onClick={handleBulkAssign}>Aplicar</Button>
                    
                    <div className="w-px h-5 bg-blue-300 mx-1"></div>
                    <Button size="sm" variant="outline" className="h-8 text-xs text-red-700 border-red-200 hover:bg-red-50 bg-white" onClick={handleBulkDesmatricular} disabled={procesando}>
                      <UserMinus className="w-3 h-3 mr-1"/> Desmatricular
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-12 text-center"><Checkbox checked={allActiveSelected} onCheckedChange={(checked) => { if (checked) setSelectedStudentIds(alumnosActivosFiltrados.map(a => a.id)); else setSelectedStudentIds([]); }}/></TableHead>
                      <TableHead>Estudiante</TableHead>
                      <TableHead className="text-center w-32">Estado</TableHead>
                      <TableHead className="text-right pr-6">Mover a Sección</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alumnosActivosFiltrados.map((alumno) => (
                      <TableRow key={alumno.id} className={!alumno.section_id ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-gray-50'}>
                        <TableCell className="text-center"><Checkbox checked={selectedStudentIds.includes(alumno.id)} onCheckedChange={() => toggleStudentSelection(alumno.id)} /></TableCell>
                        <TableCell>
                          <div className="font-semibold text-gray-800">{alumno.last_name}, {alumno.first_name}</div>
                          <div className="text-xs text-gray-500">{alumno.email}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                             <Switch checked={alumno.is_active} disabled={procesando} onCheckedChange={() => handleToggleStatus(alumno.id, alumno.is_active)} />
                             <span className={`text-[11px] font-bold w-12 text-left text-green-600`}>ACTIVO</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-3">
                            {alumno.section_id ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aula {secciones.find(s => s.id === alumno.section_id)?.name || '?'}</Badge>
                            ) : (
                              <span className="text-xs font-bold text-red-500 flex items-center"><ShieldAlert className="w-3 h-3 mr-1"/> Faltante</span>
                            )}
                            <Select value={alumno.section_id || 'unassigned'} onValueChange={(val) => handleAsignacionIndividual(alumno.id, val)}>
                              <SelectTrigger className={`w-[140px] h-8 text-sm ${!alumno.section_id ? 'border-red-300 bg-red-50' : ''}`}><SelectValue placeholder="Asignar a..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned" className="text-red-600">Quitar del aula</SelectItem>
                                {secciones.map(s => <SelectItem key={s.id} value={s.id}>Aula "{s.name}"</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {alumnosActivosFiltrados.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-12 text-gray-500">No se encontraron alumnos activos con este filtro.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PARTE 3: ALUMNOS INACTIVOS */}
        {gradoActivo && alumnosInactivos.length > 0 && (
          <Card className="mt-6 border-0 shadow-sm bg-gray-50 opacity-95 border-t-2 border-t-gray-400">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base flex items-center gap-2 text-gray-600">
                <UserX className="w-4 h-4"/> Alumnos Inactivos / Egresados ({alumnosInactivos.length})
              </CardTitle>
              <CardDescription>Pertenecen al historial de este grado pero están desmatriculados. Puedes reactivarlos o limpiar el registro.</CardDescription>
              
              {selectedInactiveIds.length > 0 && (
                <div className="flex items-center gap-2 bg-gray-200 p-1.5 rounded-md border border-gray-300 animate-in fade-in mt-3">
                   <span className="text-xs font-bold text-gray-700 px-2">{selectedInactiveIds.length} selec.</span>
                   <Button size="sm" variant="outline" className="h-8 text-xs bg-white hover:text-green-700 hover:bg-green-50" disabled={procesando} onClick={handleBulkReactivar}>
                     <UserCheck className="w-3 h-3 mr-1"/> Reactivar
                   </Button>
                   <Button size="sm" variant="outline" className="h-8 text-xs bg-white hover:text-orange-700 hover:bg-orange-50" disabled={procesando} onClick={handleBulkDesvincular}>
                     <UserMinus className="w-3 h-3 mr-1"/> Desvincular
                   </Button>
                   <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={procesando} onClick={handleBulkDeleteInactive}>
                     <Trash2 className="w-3 h-3 mr-1"/> Eliminar
                   </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-gray-100/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center"><Checkbox checked={allInactiveSelected} onCheckedChange={(checked) => { if (checked) setSelectedInactiveIds(alumnosInactivos.map(a => a.id)); else setSelectedInactiveIds([]); }} /></TableHead>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Última Aula</TableHead>
                      <TableHead className="text-center w-32">Estado</TableHead>
                      <TableHead className="text-right pr-6">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alumnosInactivos.map(alumno => {
                      const aulaName = alumno.section_id ? secciones.find(s => s.id === alumno.section_id)?.name : null;
                      return (
                        <TableRow key={alumno.id}>
                          <TableCell className="text-center"><Checkbox checked={selectedInactiveIds.includes(alumno.id)} onCheckedChange={() => toggleInactiveSelection(alumno.id)} /></TableCell>
                          <TableCell className="text-gray-600 font-medium">{alumno.last_name}, {alumno.first_name} <span className="text-xs block font-normal">{alumno.email}</span></TableCell>
                          <TableCell>{aulaName ? <span className="text-xs text-gray-500">Aula {aulaName}</span> : <span className="text-xs text-gray-400 italic">Sin asignar</span>}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                               <Switch checked={alumno.is_active} disabled={procesando} onCheckedChange={() => handleToggleStatus(alumno.id, alumno.is_active)} />
                               <span className={`text-[11px] font-bold w-12 text-left text-gray-500`}>INACTIVO</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6 space-x-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs text-gray-600" onClick={() => handleDesvincularInactivo(alumno.id)} title="Quitar de este grado"><UserMinus className="w-3 h-3"/></Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setInactiveToDelete(alumno)} title="Eliminar estudiante por completo"><Trash2 className="w-3 h-3"/></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal Confirmar Eliminar Definitivamente */}
        <Dialog open={!!inactiveToDelete} onOpenChange={(open) => { if(!open) setInactiveToDelete(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Eliminar Definitivamente</DialogTitle>
              <DialogDescription>Estás a punto de borrar por completo a <strong>{inactiveToDelete?.first_name} {inactiveToDelete?.last_name}</strong> de la BD.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setInactiveToDelete(null)} disabled={procesando}>Cancelar</Button>
              <Button variant="destructive" onClick={handleEliminarDefinitivo} disabled={procesando}>{procesando ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Eliminar Registro'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default AdminClassrooms;