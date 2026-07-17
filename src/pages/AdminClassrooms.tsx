import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { School, Plus, Users, Shuffle, Loader2, ArrowRight, Trash2, GraduationCap, ShieldAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Nivel { id: string; name: string; }
interface Grado { id: string; level_id: string; name: string; }
interface Seccion { id: string; grade_id: string; name: string; room_number: string; academic_year: number; alumno_count?: number; }
interface AlumnoEnGrado { id: string; first_name: string; last_name: string; email: string; section_id?: string; }

const CURRENT_YEAR = 2026;

const AdminClassrooms = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Estados
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

  useEffect(() => {
    initLoad();
  }, []);

  useEffect(() => {
    if (nivelActivo && grados.length > 0) {
      const filtered = grados.filter(g => g.level_id === nivelActivo);
      setGradoActivo(filtered.length > 0 ? filtered[0].id : '');
    } else {
      setGradoActivo('');
    }
  }, [nivelActivo, grados]);

  useEffect(() => {
    if (gradoActivo) fetchDataEstructura(gradoActivo);
    else { setSecciones([]); setAlumnos([]); }
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

  // OPTIMIZACIÓN: 3 Consultas planas cruzadas en memoria (Ultra rápido)
  const fetchDataEstructura = async (gradeId: string) => {
    setLoading(true);
    try {
      // 1. Traer secciones del grado
      const { data: dataSecciones } = await supabase.from('sections')
        .select('*').eq('grade_id', gradeId).eq('academic_year', CURRENT_YEAR).order('name');
      const secs = dataSecciones || [];

      // 2. Traer todos los alumnos asignados a este grado
      const { data: dataAlumnos } = await supabase.from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'student').eq('current_grade_id', gradeId).order('first_name');
      const alums = dataAlumnos || [];

      // 3. Traer las matrículas (secciones) de este año
      const { data: matriculas } = await supabase.from('student_sections')
        .select('student_id, section_id')
        .eq('academic_year', CURRENT_YEAR)
        .in('section_id', secs.map(s => s.id));

      // Cruzar datos localmente
      const alumnosConSeccion = alums.map(al => {
        const mat = matriculas?.find(m => m.student_id === al.id);
        return { ...al, section_id: mat?.section_id };
      });

      const seccionesConConteo = secs.map(sec => {
        const conteo = matriculas?.filter(m => m.section_id === sec.id).length || 0;
        return { ...sec, alumno_count: conteo };
      });

      setAlumnos(alumnosConSeccion);
      setSecciones(seccionesConConteo);
    } catch (error) {
      console.error("Error cargando estructura:", error);
    } finally {
      setLoading(false);
    }
  };

  // ----- ACCIONES DE SECCIÓN -----
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
      // 1. Crear Sección
      const { data: nuevaSec, error: errSec } = await supabase.from('sections').insert([{
        grade_id: gradoActivo, name: formSeccion.name.trim(), room_number: formSeccion.room_number, academic_year: CURRENT_YEAR
      }]).select().single();
      
      if (errSec) throw errSec;

      // 2. Traer Malla y Copiar a la Sección automáticamente
      const { data: cursosMalla } = await supabase.from('base_courses').select('id').eq('grade_id', gradoActivo);
      if (cursosMalla && cursosMalla.length > 0) {
        const instanciasCursos = cursosMalla.map(curso => ({ section_id: nuevaSec.id, base_course_id: curso.id }));
        await supabase.from('section_courses').insert(instanciasCursos);
      }

      toast({ title: "Sección Creada", description: `Se configuró el aula y se importaron ${cursosMalla?.length || 0} cursos de la malla.` });
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

  // ----- ASIGNACIÓN DE ALUMNOS -----
  const handleAsignacionManual = async (studentId: string, newSectionId: string) => {
    try {
      // 1. Borrar cualquier asignación previa de este año
      await supabase.from('student_sections').delete().eq('student_id', studentId).eq('academic_year', CURRENT_YEAR);
      
      // 2. Insertar la nueva (si no seleccionó "Sin asignar")
      if (newSectionId !== 'unassigned') {
        await supabase.from('student_sections').insert([{ student_id: studentId, section_id: newSectionId, academic_year: CURRENT_YEAR }]);
      }
      toast({ title: "Aula actualizada", description: "El alumno fue movido exitosamente." });
      fetchDataEstructura(gradoActivo);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cambiar el aula.", variant: "destructive" });
    }
  };

  const handleReparticionAleatoria = async () => {
    const sinAula = alumnos.filter(a => !a.section_id);
    if (secciones.length === 0) return toast({ title: "Error", description: "Crea al menos una sección primero.", variant: "destructive" });
    if (sinAula.length === 0) return toast({ title: "Info", description: "Todos los alumnos ya tienen sección." });

    setProcesando(true);
    try {
      const mezclados = [...sinAula].sort(() => Math.random() - 0.5);
      const registros = mezclados.map((alumno, index) => ({
        student_id: alumno.id, section_id: secciones[index % secciones.length].id, academic_year: CURRENT_YEAR
      }));

      await supabase.from('student_sections').insert(registros);
      toast({ title: "Éxito", description: `Se repartieron ${registros.length} alumnos pendientes equitativamente.` });
      fetchDataEstructura(gradoActivo);
    } catch (error) {
      toast({ title: "Error", description: "Fallo al repartir alumnos.", variant: "destructive" });
    } finally {
      setProcesando(false);
    }
  };

  const alumnosSinAula = useMemo(() => alumnos.filter(a => !a.section_id).length, [alumnos]);

  if (loading && niveles.length === 0) return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        
        {/* CABECERA Y FILTROS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
              <School className="h-8 w-8 text-blue-600" /> Distribución de Aulas Virtuales
            </h1>
            <p className="text-muted-foreground mt-1">Crea las secciones (Ej: "A", "B") y asigna a los alumnos matriculados en el grado.</p>
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

        {/* PARTE 1: GESTIÓN DE SECCIONES (TARJETAS) */}
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
                  <div>
                    <Label>Nombre identificador *</Label>
                    <Input required value={formSeccion.name} onChange={e => setFormSeccion({...formSeccion, name: e.target.value})} placeholder="Ej: A, Los Tigres, 4to-B" autoFocus/>
                  </div>
                  <div>
                    <Label>Ubicación / Pabellón (Opcional)</Label>
                    <Input value={formSeccion.room_number} onChange={e => setFormSeccion({...formSeccion, room_number: e.target.value})} placeholder="Ej: Aula 102 - 1er Piso" />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600" disabled={procesando}>
                    {procesando ? 'Configurando...' : 'Crear Aula y Cargar Malla'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {secciones.map((sec) => (
              <Card key={sec.id} className="hover:shadow-md transition-shadow border-t-4 border-t-blue-500">
                <CardHeader className="flex flex-row justify-between items-center pb-2">
                  <CardTitle className="text-xl">Aula "{sec.name}"</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => handleEliminarSeccion(sec.id)} className="text-red-400 hover:text-red-600 p-0 h-8 w-8"><Trash2 className="w-4 h-4"/></Button>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-gray-800 flex items-center gap-2 mb-1">
                    <Users className="text-blue-500 w-6 h-6"/> {sec.alumno_count} <span className="text-sm font-medium text-gray-500">Alumnos</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{sec.room_number || 'Ubicación no especificada'}</p>
                  
                  <Button variant="outline" className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" onClick={() => navigate(`/admin/section/${sec.id}`)}>
                    Gestionar Profesores <ArrowRight className="w-4 h-4 ml-2"/>
                  </Button>
                </CardContent>
              </Card>
            ))}
            {secciones.length === 0 && !loading && (
              <div className="col-span-full text-center py-8 bg-white rounded-lg border border-dashed">
                <School className="w-12 h-12 mx-auto text-gray-300 mb-2"/>
                <p className="text-gray-500 font-medium">Aún no has creado secciones para este grado.</p>
              </div>
            )}
          </div>
        </div>

        {/* PARTE 2: GESTIÓN MANUAL DE ALUMNOS (TABLA) */}
        {gradoActivo && (
          <Card className="mt-8 shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600"/> Padrón de Alumnos del Grado
                </CardTitle>
                <CardDescription>Asigna en qué aula estudiará cada alumno matriculado en este grado.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant={alumnosSinAula > 0 ? "destructive" : "secondary"} className="px-3 text-sm">
                  {alumnosSinAula} Sin Asignar
                </Badge>
                <Button onClick={handleReparticionAleatoria} disabled={procesando || alumnosSinAula === 0 || secciones.length === 0} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                  <Shuffle className="w-4 h-4 mr-2" /> Repartir Pendientes
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="pl-6">Estudiante</TableHead>
                      <TableHead>Estado Actual</TableHead>
                      <TableHead className="text-right pr-6">Mover a Sección</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alumnos.map((alumno) => (
                      <TableRow key={alumno.id} className={!alumno.section_id ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                        <TableCell className="pl-6">
                          <div className="font-semibold text-gray-800">{alumno.first_name} {alumno.last_name}</div>
                          <div className="text-xs text-gray-500">{alumno.email}</div>
                        </TableCell>
                        <TableCell>
                          {alumno.section_id ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Aula {secciones.find(s => s.id === alumno.section_id)?.name || 'Error'}
                            </Badge>
                          ) : (
                            <span className="text-xs font-medium text-red-500 flex items-center"><ShieldAlert className="w-3 h-3 mr-1"/> Faltante</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Select 
                            value={alumno.section_id || 'unassigned'} 
                            onValueChange={(val) => handleAsignacionManual(alumno.id, val)}
                          >
                            <SelectTrigger className={`w-[180px] ml-auto h-8 text-sm ${!alumno.section_id ? 'border-red-300' : ''}`}>
                              <SelectValue placeholder="Asignar a..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" className="text-red-600">Quitar del aula</SelectItem>
                              {secciones.map(s => <SelectItem key={s.id} value={s.id}>Aula {s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                    {alumnos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-gray-500">
                          No hay alumnos registrados en la base de datos para este grado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminClassrooms;