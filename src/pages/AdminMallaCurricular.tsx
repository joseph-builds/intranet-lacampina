import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookOpen, Plus, Trash2, Layers, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface Nivel { id: string; name: string; level_order: number; }
interface Grado { id: string; level_id: string; name: string; grade_order: number; }
interface CursoCatalogo { id: string; name: string; code: string; }
interface CursoBase { id: string; grade_id: string; course_id: string; name: string; area: string; weekly_hours: number; is_mandatory: boolean; }

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
  const [formData, setFormData] = useState({ course_id: '', area: '', weekly_hours: 0, is_mandatory: true });

  useEffect(() => {
    fetchEstructura();
    fetchCatalogoCursos();
  }, []);

  useEffect(() => {
    if (nivelActivo && grados.length > 0) {
      const gradosDelNivel = grados.filter(g => g.level_id === nivelActivo).sort((a, b) => a.grade_order - b.grade_order);
      setGradoActivo(gradosDelNivel.length > 0 ? gradosDelNivel[0].id : '');
    }
  }, [nivelActivo, grados]);

  useEffect(() => {
    if (gradoActivo) fetchCursosPorGrado(gradoActivo);
    else setCursosMalla([]);
  }, [gradoActivo]);

  // Cargar Catálogo (Tus cursos existentes)
  const fetchCatalogoCursos = async () => {
    const { data, error } = await supabase.from('courses').select('id, name, code').eq('is_active', true).order('name');
    if (!error) setCatalogoCursos(data || []);
  };

  const fetchEstructura = async () => {
    setLoading(true);
    try {
      const { data: dataNiveles } = await supabase.from('academic_levels').select('*').order('level_order');
      const { data: dataGrados } = await supabase.from('academic_grades').select('*').order('grade_order');
      setNiveles(dataNiveles || []);
      setGrados(dataGrados || []);
      if (dataNiveles && dataNiveles.length > 0 && !nivelActivo) setNivelActivo(dataNiveles[0].id);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar la estructura", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCursosPorGrado = async (gradeId: string) => {
    const { data } = await supabase.from('base_courses').select('*').eq('grade_id', gradeId).order('name');
    setCursosMalla(data || []);
  };

  // ----- GESTIÓN DE GRADOS -----
  const handleCrearGrado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoGradoNombre || !nivelActivo) return;
    setSaving(true);
    try {
      const gradosActuales = grados.filter(g => g.level_id === nivelActivo);
      await supabase.from('academic_grades').insert([{
        level_id: nivelActivo,
        name: nuevoGradoNombre,
        grade_order: gradosActuales.length + 1
      }]);
      toast({ title: "Grado Creado", description: "El grado se añadió correctamente." });
      setIsGradoModalOpen(false);
      setNuevoGradoNombre('');
      fetchEstructura();
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarGrado = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro? Se eliminará este grado y TODOS los cursos asignados a su malla.')) return;
    await supabase.from('academic_grades').delete().eq('id', id);
    toast({ title: "Eliminado", description: "Grado removido exitosamente." });
    fetchEstructura();
  };

  // ----- GESTIÓN DE CURSOS EN LA MALLA -----
  const handleVincularCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradoActivo || !formData.course_id) return;

    const cursoSeleccionado = catalogoCursos.find(c => c.id === formData.course_id);
    if (!cursoSeleccionado) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('base_courses').insert([{
        grade_id: gradoActivo,
        course_id: cursoSeleccionado.id,
        name: cursoSeleccionado.name, // Guardamos el nombre para referencia rápida
        area: formData.area || 'General',
        weekly_hours: formData.weekly_hours,
        is_mandatory: formData.is_mandatory
      }]);

      if (error) throw error;
      toast({ title: "Éxito", description: "Curso asignado al grado." });
      fetchCursosPorGrado(gradoActivo);
      setIsCursoModalOpen(false);
      setFormData({ course_id: '', area: '', weekly_hours: 0, is_mandatory: true });
    } catch (error) {
      toast({ title: "Error", description: "El curso ya está en la malla o hubo un error.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarCursoMalla = async (id: string) => {
    if (!confirm('¿Quitar este curso de la malla del grado?')) return;
    await supabase.from('base_courses').delete().eq('id', id);
    toast({ title: "Removido", description: "Curso quitado de la malla." });
    fetchCursosPorGrado(gradoActivo);
  };

  if (loading) return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
            <Layers className="h-8 w-8 text-primary" /> Malla Curricular Maestra
          </h1>
          <p className="text-muted-foreground mt-2">Gestiona niveles, grados y vincula los cursos existentes a la currícula de cada grado.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* PANEL IZQUIERDO: NIVELES Y GRADOS */}
          <Card className="md:col-span-1 border-0 shadow-md bg-white h-fit">
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
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label>Grados de {niveles.find(n => n.id === nivelActivo)?.name}</Label>
                  {/* Modal para Crear Grado */}
                  <Dialog open={isGradoModalOpen} onOpenChange={setIsGradoModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"><Plus className="h-4 w-4" /></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Añadir Nuevo Grado</DialogTitle></DialogHeader>
                      <form onSubmit={handleCrearGrado} className="space-y-4">
                        <div>
                          <Label>Nombre del Grado</Label>
                          <Input required value={nuevoGradoNombre} onChange={e => setNuevoGradoNombre(e.target.value)} placeholder="Ej: 3 Años, 1ro, 7mo" />
                        </div>
                        <Button type="submit" disabled={saving} className="w-full">Guardar Grado</Button>
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
                        gradoActivo === grado.id ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200' : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <span>{grado.name}</span>
                      <Trash2 
                        className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity" 
                        onClick={(e) => handleEliminarGrado(grado.id, e)}
                      />
                    </div>
                  ))}
                  {grados.filter(g => g.level_id === nivelActivo).length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No hay grados. Crea uno en el botón (+).</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PANEL PRINCIPAL: CURSOS ASIGNADOS */}
          <Card className="md:col-span-3 border-0 shadow-md bg-white">
            <CardHeader className="flex flex-row items-start md:items-center justify-between border-b pb-4 gap-4">
              <div>
                <CardTitle className="text-xl">Malla de {grados.find(g => g.id === gradoActivo)?.name || '...'}</CardTitle>
                <CardDescription>Cursos asignados a los alumnos de este grado.</CardDescription>
              </div>
              
              {/* Modal para Vincular Curso Existente */}
              <Dialog open={isCursoModalOpen} onOpenChange={setIsCursoModalOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!gradoActivo} className="bg-blue-600 hover:bg-blue-700 shrink-0">
                    <Plus className="w-4 h-4 mr-2" /> Asignar Curso
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Vincular Curso a la Malla</DialogTitle></DialogHeader>
                  <form onSubmit={handleVincularCurso} className="space-y-4">
                    <div>
                      <Label>Seleccionar Curso del Catálogo General</Label>
                      <Select required value={formData.course_id} onValueChange={val => setFormData({...formData, course_id: val})}>
                        <SelectTrigger><SelectValue placeholder="Busca un curso ya creado..." /></SelectTrigger>
                        <SelectContent>
                          {catalogoCursos.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Área Curricular</Label>
                      <Input value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} placeholder="Ej: Ciencias Exactas" />
                    </div>
                    <div>
                      <Label>Horas Semanales Sugeridas</Label>
                      <Input type="number" min={0} value={formData.weekly_hours} onChange={e => setFormData({...formData, weekly_hours: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <Label className="font-bold">¿Es Obligatorio?</Label>
                        <p className="text-xs text-muted-foreground">Desmarcar para cursos exonerables (Ej: Religión).</p>
                      </div>
                      <Switch checked={formData.is_mandatory} onCheckedChange={checked => setFormData({...formData, is_mandatory: checked})} />
                    </div>
                    <Button type="submit" disabled={saving || !formData.course_id} className="w-full">Agregar a la Malla</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Asignatura</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead className="text-center">Hrs/Semana</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cursosMalla.map((curso) => (
                      <TableRow key={curso.id} className="hover:bg-gray-50/50">
                        <TableCell className="font-medium flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-gray-400" /> {curso.name}
                        </TableCell>
                        <TableCell className="text-gray-600">{curso.area}</TableCell>
                        <TableCell className="text-center">{curso.weekly_hours}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={curso.is_mandatory ? "default" : "secondary"} className={curso.is_mandatory ? "bg-blue-100 text-blue-800" : ""}>
                            {curso.is_mandatory ? 'Obligatorio' : 'Exonerable'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleEliminarCursoMalla(curso.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {cursosMalla.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                          Aún no has configurado los cursos para este grado.
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