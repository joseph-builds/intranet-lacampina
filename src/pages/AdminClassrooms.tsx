import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // <--- ESTO ES LO QUE FALTABA
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { School, Plus, Users, Shuffle, Loader2, Home, BookOpen, AlertCircle, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface Nivel { id: string; name: string; }
interface Grado { id: string; level_id: string; name: string; }
interface Seccion { id: string; grade_id: string; name: string; room_number: string; academic_year: number; alumno_count?: number; }
interface AlumnoPreMatriculado { id: string; first_name: string; last_name: string; email: string; }

const AdminClassrooms = () => {
  const { toast } = useToast();
  const navigate = useNavigate(); // <--- ESTO INICIALIZA LA NAVEGACIÓN
  
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [alumnosSinSalon, setAlumnosSinSalon] = useState<AlumnoPreMatriculado[]>([]);

  const [nivelActivo, setNivelActivo] = useState<string>('');
  const [gradoActivo, setGradoActivo] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [repartiendo, setRepartiendo] = useState(false);

  const [isSeccionModalOpen, setIsSeccionModalOpen] = useState(false);
  const [formSeccion, setFormSeccion] = useState({ name: '', room_number: '', academic_year: 2026 });

  useEffect(() => {
    initLoad();
  }, []);

  useEffect(() => {
    if (nivelActivo && grados.length > 0) {
      const filtered = grados.filter(g => g.level_id === nivelActivo);
      if (filtered.length > 0) setGradoActivo(filtered[0].id);
    }
  }, [nivelActivo, grados]);

  useEffect(() => {
    if (gradoActivo) fetchSeccionesYAlumnos(gradoActivo);
  }, [gradoActivo]);

  const initLoad = async () => {
    setLoading(true);
    try {
      const { data: dataNiveles } = await supabase.from('academic_levels').select('*').order('level_order');
      const { data: dataGrados } = await supabase.from('academic_grades').select('*').order('grade_order');
      setNiveles(dataNiveles || []);
      setGrados(dataGrados || []);
      if (dataNiveles && dataNiveles.length > 0) setNivelActivo(dataNiveles[0].id);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeccionesYAlumnos = async (gradeId: string) => {
    try {
      const { data: dataSecciones } = await supabase
        .from('sections')
        .select('*')
        .eq('grade_id', gradeId)
        .eq('academic_year', 2026)
        .order('name');

      const { data: dataMatriculados } = await supabase
        .from('student_sections')
        .select('student_id')
        .eq('academic_year', 2026);
      
      const idsConSalon = dataMatriculados?.map(m => m.student_id) || [];

      let queryAlumnos = supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'student')
        .eq('current_grade_id', gradeId);
      
      if (idsConSalon.length > 0) {
        queryAlumnos = queryAlumnos.not('id', 'in', `(${idsConSalon.join(',')})`);
      }

      const { data: dataAlumnos } = await queryAlumnos;

      const seccionesConConteo = await Promise.all((dataSecciones || []).map(async (sec) => {
        const { count } = await supabase
          .from('student_sections')
          .select('*', { count: 'exact', head: true })
          .eq('section_id', sec.id)
          .eq('academic_year', 2026);
        return { ...sec, alumno_count: count || 0 };
      }));

      setSecciones(seccionesConConteo);
      setAlumnosSinSalon(dataAlumnos || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearSeccion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradoActivo) return;

    const nombreNormalizado = formSeccion.name.trim().toLowerCase();
    const esDuplicado = secciones.some(s => s.name.trim().toLowerCase() === nombreNormalizado);

    if (esDuplicado) {
      toast({ title: "Nombre duplicado", description: `Ya existe "${formSeccion.name}" en este grado.`, variant: "destructive" });
      return;
    }

    try {
      const { data: nuevaSec, error: errSec } = await supabase
        .from('sections')
        .insert([{
          grade_id: gradoActivo,
          name: formSeccion.name.trim(),
          room_number: formSeccion.room_number,
          academic_year: formSeccion.academic_year
        }])
        .select()
        .single();

      if (errSec) throw errSec;

      const { data: cursosMalla } = await supabase
        .from('base_courses')
        .select('id')
        .eq('grade_id', gradoActivo);

      if (cursosMalla && cursosMalla.length > 0) {
        const instanciasCursos = cursosMalla.map(curso => ({
          section_id: nuevaSec.id,
          base_course_id: curso.id,
          schedule: []
        }));

        const { error: errCursos } = await supabase.from('section_courses').insert(instanciasCursos);
        if (errCursos) throw errCursos;
      }

      toast({ title: "Éxito", description: `Sección ${formSeccion.name} creada.` });
      setIsSeccionModalOpen(false);
      setFormSeccion({ name: '', room_number: '', academic_year: 2026 });
      fetchSeccionesYAlumnos(gradoActivo);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo crear.", variant: "destructive" });
    }
  };

  const handleEliminarSeccion = async (id: string) => {
    if (!confirm('¿Seguro? Se eliminará la sección y todos sus cursos asignados.')) return;
    try {
      const { error } = await supabase.from('sections').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Éxito", description: "Sección eliminada." });
      fetchSeccionesYAlumnos(gradoActivo);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const handleReparticionAleatoria = async () => {
    if (secciones.length === 0) {
      toast({ title: "Error", description: "Crea al menos una sección primero.", variant: "destructive" });
      return;
    }
    if (alumnosSinSalon.length === 0) {
      toast({ title: "Info", description: "No hay alumnos pendientes." });
      return;
    }

    setRepartiendo(true);
    try {
      const alumnosMezclados = [...alumnosSinSalon].sort(() => Math.random() - 0.5);
      const registros = alumnosMezclados.map((alumno, index) => ({
        student_id: alumno.id,
        section_id: secciones[index % secciones.length].id,
        academic_year: 2026
      }));

      const { error } = await supabase.from('student_sections').insert(registros);
      if (error) throw error;

      toast({ title: "Éxito", description: `Se repartieron ${registros.length} alumnos.` });
      fetchSeccionesYAlumnos(gradoActivo);
    } catch (error) {
      toast({ title: "Error", description: "Fallo al repartir alumnos.", variant: "destructive" });
    } finally {
      setRepartiendo(false);
    }
  };

  if (loading) return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
              <School className="h-8 w-8 text-primary" /> Aulas Virtuales
            </h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleReparticionAleatoria} disabled={repartiendo || alumnosSinSalon.length === 0} className="bg-purple-600">
              {repartiendo ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Shuffle className="w-4 h-4 mr-2" />}
              Repartir {alumnosSinSalon.length} alumnos
            </Button>
            <Dialog open={isSeccionModalOpen} onOpenChange={setIsSeccionModalOpen}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Abrir Sección</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nueva Sección</DialogTitle></DialogHeader>
                <form onSubmit={handleCrearSeccion} className="space-y-4">
                  <div>
                    <Label>Nombre de la Sección (Único)</Label>
                    <Input required value={formSeccion.name} onChange={e => setFormSeccion({...formSeccion, name: e.target.value})} placeholder="Ej: A, Leones, 4to-B" />
                  </div>
                  <div>
                    <Label>Ubicación</Label>
                    <Input value={formSeccion.room_number} onChange={e => setFormSeccion({...formSeccion, room_number: e.target.value})} placeholder="Ej: Aula 102" />
                  </div>
                  <Button type="submit" className="w-full">Crear Sección</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="p-4 flex gap-4">
           <div className="w-1/2">
             <Label>Nivel</Label>
             <Select value={nivelActivo} onValueChange={setNivelActivo}>
               <SelectTrigger><SelectValue/></SelectTrigger>
               <SelectContent>{niveles.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent>
             </Select>
           </div>
           <div className="w-1/2">
             <Label>Grado</Label>
             <Select value={gradoActivo} onValueChange={setGradoActivo}>
               <SelectTrigger><SelectValue/></SelectTrigger>
               <SelectContent>{grados.filter(g => g.level_id === nivelActivo).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
             </Select>
           </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {secciones.map((sec) => (
            <Card key={sec.id}>
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Sección "{sec.name}"</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => handleEliminarSeccion(sec.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></Button>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2"><Users className="text-primary"/> {sec.alumno_count} Alumnos</div>
                <p className="text-sm text-muted-foreground">{sec.room_number}</p>
                <Button 
                    variant="outline" 
                    className="w-full mt-4" 
                    onClick={() => navigate(`/admin/section/${sec.id}`)}
                >
                    Gestionar Cursos y Tutor
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminClassrooms;