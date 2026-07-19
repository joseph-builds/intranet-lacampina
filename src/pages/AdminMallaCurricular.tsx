import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookOpen, Plus, Trash2, Layers, Loader2, Library, Tags, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface Nivel { id: string; name: string; level_order: number; }
interface Grado { id: string; level_id: string; name: string; grade_order: number; }
interface CursoCatalogo { id: string; name: string; code: string; course_type: string | null; }

// Modificamos la interfaz para incluir la relación con la tabla de cursos y saber si está activo
interface CursoBase { 
  id: string; 
  grade_id: string; 
  course_id: string; 
  name: string; 
  area: string; 
  is_mandatory: boolean; 
  courses?: { is_active: boolean }; 
}

const AdminMallaCurricular = () => {
  const { toast } = useToast();
  
  // Estados de BD
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [cursosMalla, setCursosMalla] = useState<CursoBase[]>([]);
  const [catalogoCursos, setCatalogoCursos] = useState<CursoCatalogo[]>([]);
  
  // Estados de UI
  const [nivelActivo, setNivelActivo] = useState<string>('');
  const [gradoActivo, setGradoActivo] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // Estados de Modales
  const [isCursoModalOpen, setIsCursoModalOpen] = useState(false);
  const [isGradoModalOpen, setIsGradoModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Formularios
  const [nuevoGradoNombre, setNuevoGradoNombre] = useState('');
  const [formData, setFormData] = useState({ course_id: '', is_mandatory: true });

  useEffect(() => {
    fetchEstructura();
    fetchCatalogoCursos();
  }, []);

  useEffect(() => {
    if (nivelActivo && grados.length > 0) {
      const gradosDelNivel = grados.filter(g => g.level_id === nivelActivo).sort((a, b) => a.grade_order - b.grade_order);
      setGradoActivo(gradosDelNivel.length > 0 ? gradosDelNivel[0].id : '');
    } else {
      setGradoActivo('');
    }
  }, [nivelActivo, grados]);

  useEffect(() => {
    if (gradoActivo) fetchCursosPorGrado(gradoActivo);
    else setCursosMalla([]);
  }, [gradoActivo]);

  const fetchCatalogoCursos = async () => {
    // Para agregar nuevos cursos, solo traemos los activos
    const { data, error } = await supabase.from('courses').select('id, name, code, course_type').eq('is_active', true).order('name');
    if (!error) {
      setCatalogoCursos(data || []);
    } else {
      console.error("Error cargando catálogo:", error);
    }
  };

  const fetchEstructura = async () => {
    setLoading(true);
    try {
      const { data: dataNiveles } = await supabase.from('academic_levels').select('*').order('level_order');
      const { data: dataGrados } = await supabase.from('academic_grades').select('*').order('grade_order');
      
      setNiveles(dataNiveles || []);
      setGrados(dataGrados || []);
      
      if (dataNiveles && dataNiveles.length > 0 && !nivelActivo) {
        setNivelActivo(dataNiveles[0].id);
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar la estructura", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCursosPorGrado = async (gradeId: string) => {
    // MEJORA: Hacemos un JOIN con la tabla 'courses' para traer la columna 'is_active' del catálogo general
    const { data, error } = await supabase
      .from('base_courses')
      .select(`
        *,
        courses ( is_active )
      `)
      .eq('grade_id', gradeId)
      .order('name');
      
    if (!error) {
      setCursosMalla(data || []);
    } else {
      console.error("Error cargando malla:", error);
    }
  };

  // ----- GESTIÓN DE GRADOS -----
  const handleCrearGrado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoGradoNombre.trim() || !nivelActivo) return;
    
    setSaving(true);
    try {
      const gradosActuales = grados.filter(g => g.level_id === nivelActivo);
      await supabase.from('academic_grades').insert([{
        level_id: nivelActivo,
        name: nuevoGradoNombre.trim(),
        grade_order: gradosActuales.length + 1
      }]);
      
      toast({ title: "Grado Creado", description: "El grado se añadió correctamente al nivel." });
      setIsGradoModalOpen(false);
      setNuevoGradoNombre('');
      fetchEstructura();
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarGrado = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro? Se eliminará este grado y TODOS los cursos asignados a su malla. Esta acción no se puede deshacer.')) return;
    
    try {
      const { error } = await supabase.from('academic_grades').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Grado Eliminado", description: "Grado removido exitosamente." });
      fetchEstructura();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el grado. Verifica que no tenga alumnos asignados.", variant: "destructive" });
    }
  };

  // ----- GESTIÓN DE CURSOS EN LA MALLA -----
  const handleVincularCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradoActivo || !formData.course_id) return;

    const cursoSeleccionado = catalogoCursos.find(c => c.id === formData.course_id);
    if (!cursoSeleccionado) return;

    setSaving(true);
    try {
      const etiquetaAutogenerada = cursoSeleccionado.course_type || '-';

      const { error } = await supabase.from('base_courses').insert([{
        grade_id: gradoActivo,
        course_id: cursoSeleccionado.id,
        name: cursoSeleccionado.name,
        area: etiquetaAutogenerada,
        is_mandatory: formData.is_mandatory
      }]);

      if (error) throw error;
      
      toast({ title: "Éxito", description: "Asignatura agregada a la malla curricular." });
      fetchCursosPorGrado(gradoActivo);
      setIsCursoModalOpen(false);
      setFormData({ course_id: '', is_mandatory: true });
    } catch (error) {
      toast({ title: "Error", description: "El curso ya existe en esta malla o hubo un problema.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarCursoMalla = async (id: string) => {
    if (!confirm('¿Quitar este curso de la malla de este grado?')) return;
    await supabase.from('base_courses').delete().eq('id', id);
    toast({ title: "Removido", description: "Curso quitado de la malla exitosamente." });
    fetchCursosPorGrado(gradoActivo);
  };

  const cursoActualmenteSeleccionado = catalogoCursos.find(c => c.id === formData.course_id);

  if (loading) return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800">
            <Layers className="h-8 w-8 text-blue-600" /> Malla Curricular Maestra
          </h1>
          <p className="text-muted-foreground mt-2">Crea los grados académicos y asígnales los cursos del catálogo general para armar su currícula.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* PANEL IZQUIERDO: NIVELES Y GRADOS */}
          <Card className="md:col-span-1 border-0 shadow-sm bg-white h-fit">
            <CardHeader className="bg-gray-50 border-b pb-4">
              <CardTitle className="text-lg">Estructura Escolar</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Nivel Educativo</Label>
                <Select value={nivelActivo} onValueChange={setNivelActivo}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar Nivel" /></SelectTrigger>
                  <SelectContent>
                    {niveles.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                    {niveles.length === 0 && <SelectItem value="none" disabled>No hay niveles creados</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-700">Grados Registrados</Label>
                  <Dialog open={isGradoModalOpen} onOpenChange={setIsGradoModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 bg-blue-50 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full" title="Añadir Grado">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Añadir Nuevo Grado</DialogTitle></DialogHeader>
                      <form onSubmit={handleCrearGrado} className="space-y-4">
                        <div>
                          <Label>Nombre del Grado</Label>
                          <Input required value={nuevoGradoNombre} onChange={e => setNuevoGradoNombre(e.target.value)} placeholder="Ej: 1er Grado, 3 Años, 5to Año" autoFocus />
                        </div>
                        <Button type="submit" disabled={saving} className="w-full bg-blue-600">Crear Grado</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="flex flex-col gap-1 mt-2">
                  {grados.filter(g => g.level_id === nivelActivo).map(grado => (
                    <div 
                      key={grado.id}
                      onClick={() => setGradoActivo(grado.id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                        gradoActivo === grado.id ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'hover:bg-gray-100 text-gray-600 font-medium'
                      }`}
                    >
                      <span>{grado.name}</span>
                      <Trash2 
                        className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity" 
                        onClick={(e) => handleEliminarGrado(grado.id, e)}
                        title="Eliminar Grado"
                      />
                    </div>
                  ))}
                  {grados.filter(g => g.level_id === nivelActivo).length === 0 && (
                    <div className="text-center py-4 bg-gray-50 rounded border border-dashed">
                      <span className="text-xs text-muted-foreground">Sin grados.<br/>Haz clic en el botón (+) para crear uno.</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PANEL PRINCIPAL: CURSOS ASIGNADOS */}
          <Card className="md:col-span-3 border-0 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-start md:items-center justify-between border-b pb-4 gap-4">
              <div>
                <CardTitle className="text-xl">
                  {gradoActivo ? `Malla Curricular: ${grados.find(g => g.id === gradoActivo)?.name}` : 'Selecciona un grado'}
                </CardTitle>
                <CardDescription>Cursos obligatorios y electivos asignados a este grado.</CardDescription>
              </div>
              
              <Dialog open={isCursoModalOpen} onOpenChange={(isOpen) => {
                setIsCursoModalOpen(isOpen);
                if (!isOpen) setFormData({ course_id: '', is_mandatory: true }); // Limpia al cerrar
              }}>
                <DialogTrigger asChild>
                  <Button disabled={!gradoActivo} className="bg-blue-600 hover:bg-blue-700 shrink-0 shadow-sm">
                    <Plus className="w-4 h-4 mr-2" /> Añadir Curso a Malla
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Añadir Curso a la Malla</DialogTitle></DialogHeader>
                  <form onSubmit={handleVincularCurso} className="space-y-5 mt-2">
                    
                    <div className="space-y-2">
                      <Label>Seleccionar Asignatura del Catálogo</Label>
                      <Select required value={formData.course_id} onValueChange={val => setFormData({...formData, course_id: val})}>
                        <SelectTrigger><SelectValue placeholder="Elige un curso del catálogo general..." /></SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {catalogoCursos.length > 0 ? (
                            catalogoCursos.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)
                          ) : (
                            <SelectItem value="none" disabled>No hay cursos activos registrados</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">Etiqueta / Tipo <Tags className="w-3 h-3 text-gray-400"/></Label>
                      <div className={`p-2.5 rounded-md border text-sm font-medium flex items-center h-10 ${cursoActualmenteSeleccionado ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-gray-50/50 border-dashed border-gray-200 text-gray-400'}`}>
                        {cursoActualmenteSeleccionado 
                          ? (cursoActualmenteSeleccionado.course_type ? cursoActualmenteSeleccionado.course_type : '-') 
                          : 'Selecciona un curso primero...'}
                      </div>
                      <p className="text-[10px] text-gray-400">Esta etiqueta se extrae automáticamente del catálogo. (Si no tiene, quedará en blanco)</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-lg">
                      <div>
                        <Label className="font-bold text-gray-800">Curso Obligatorio</Label>
                        <p className="text-xs text-gray-500 mt-1">Desactívalo si es un curso exonerable o electivo.</p>
                      </div>
                      <Switch checked={formData.is_mandatory} onCheckedChange={checked => setFormData({...formData, is_mandatory: checked})} />
                    </div>

                    <Button type="submit" disabled={saving || !formData.course_id} className="w-full bg-blue-600">Guardar Asignación</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="pl-6">Asignatura</TableHead>
                      <TableHead>Etiqueta / Tipo</TableHead>
                      <TableHead className="text-center">Tipo de Matrícula</TableHead>
                      <TableHead className="text-right pr-6">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cursosMalla.map((curso) => {
                      // VERIFICACIÓN: Comprobamos si el curso está inactivo o si fue eliminado físicamente
                      const esInactivo = curso.courses && curso.courses.is_active === false;
                      const fueEliminado = !curso.courses;

                      return (
                        <TableRow key={curso.id} className={`hover:bg-gray-50/50 ${esInactivo || fueEliminado ? 'bg-red-50/30' : ''}`}>
                          <TableCell className="pl-6">
                            <div className="flex flex-col gap-1">
                              <div className="font-semibold text-gray-800 flex items-center gap-2">
                                <BookOpen className={`h-4 w-4 ${esInactivo || fueEliminado ? 'text-gray-400' : 'text-blue-500'}`} /> 
                                {/* TEXTO TACHADO Y GRIS SI ESTÁ INACTIVO */}
                                <span className={esInactivo || fueEliminado ? 'line-through text-gray-400' : ''}>
                                  {curso.name}
                                </span>
                              </div>
                              {/* BADGE DE ALERTA DEBAJO DEL NOMBRE */}
                              {(esInactivo || fueEliminado) && (
                                <div className="flex items-center pl-6">
                                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px] py-0 h-5 px-1.5 flex items-center gap-1 shadow-sm">
                                    <AlertCircle className="w-3 h-3" /> 
                                    {fueEliminado ? 'Eliminado del catálogo' : 'Inactivo actualmente'}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            {!curso.area || curso.area === '-' ? (
                              <span className="text-xs text-gray-400">-</span>
                            ) : (
                              <Badge variant="outline" className={`border-slate-200 ${esInactivo || fueEliminado ? 'bg-gray-50 text-gray-400' : 'bg-slate-50 text-slate-600'}`}>
                                {curso.area}
                              </Badge>
                            )}
                          </TableCell>
                          
                          <TableCell className="text-center">
                            <Badge variant="outline" className={
                              esInactivo || fueEliminado
                                ? "bg-gray-50 text-gray-400 border-gray-200" // Opaco si está desactivado
                                : curso.is_mandatory 
                                  ? "bg-green-50 text-green-700 border-green-200" 
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                            }>
                              {curso.is_mandatory ? 'Obligatorio' : 'Electivo'}
                            </Badge>
                          </TableCell>
                          
                          <TableCell className="text-right pr-6">
                            <Button variant="ghost" size="sm" onClick={() => handleEliminarCursoMalla(curso.id)} className="text-red-600 hover:text-red-800 hover:bg-red-50 h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {cursosMalla.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-16">
                          <Library className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">Aún no has configurado los cursos para este grado.</p>
                          <p className="text-sm text-gray-400 mt-1">Usa el botón superior para empezar a armar la malla.</p>
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

export default AdminMallaCurricular;