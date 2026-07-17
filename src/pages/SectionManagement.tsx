import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, User, BookOpen, Users, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';

const SectionManagement = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [tutors, setTutors] = useState<any[]>([]);

  useEffect(() => {
    if (sectionId) loadAllData();
  }, [sectionId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Sección
      const { data: secData, error: secErr } = await supabase
        .from('sections')
        .select('*, tutor:profiles!tutor_id(*)')
        .eq('id', sectionId)
        .single();
      if (secErr) throw secErr;
      setSection(secData);

      // 2. Cargar Profesores (Solo rol 'teacher')
      const { data: teachData } = await supabase.from('profiles').select('*').eq('role', 'teacher');
      setTeachers(teachData || []);

      // 3. Cargar Tutores (Solo rol 'tutor')
      const { data: tutorData } = await supabase.from('profiles').select('*').eq('role', 'tutor');
      setTutors(tutorData || []);

      // 4. Cargar Cursos
      const { data: coursesData } = await supabase
        .from('section_courses')
        .select('id, teacher_id, base:base_courses(name, area)')
        .eq('section_id', sectionId);
      setCourses(coursesData || []);

      // 5. Cargar Alumnos
      const { data: studData } = await supabase
        .from('student_sections')
        .select('student:profiles(*)')
        .eq('section_id', sectionId);
      setStudents(studData?.map(s => s.student) || []);
      
    } catch (err: any) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCursos = async () => {
    if (!section?.grade_id) {
      toast({ title: "Error", description: "No se pudo obtener el ID del grado.", variant: "destructive" });
      return;
    }

    console.log("Buscando cursos para el Grade ID:", section.grade_id);

    // 1. Obtener cursos de la Malla Maestra
    const { data: mallaCursos, error: mallaErr } = await supabase
      .from('base_courses')
      .select('id')
      .eq('grade_id', section.grade_id);

    if (mallaErr) {
      console.error("Error Malla:", mallaErr);
      return;
    }

    console.log("Cursos encontrados en Malla:", mallaCursos);

    if (!mallaCursos || mallaCursos.length === 0) {
      toast({ title: "Sin cursos", description: "No existen cursos en la Malla Maestra para este grado.", variant: "destructive" });
      return;
    }

    // 2. Insertar los cursos en section_courses
    const registros = mallaCursos.map(c => ({
      section_id: sectionId,
      base_course_id: c.id
    }));

    const { error: upsertErr } = await supabase
      .from('section_courses')
      .upsert(registros, { onConflict: 'section_id, base_course_id' });

    if (upsertErr) {
      console.error("Error Sincronizando:", upsertErr);
      toast({ title: "Error", description: "Fallo al sincronizar cursos.", variant: "destructive" });
    } else {
      toast({ title: "Éxito", description: "Cursos sincronizados." });
      loadAllData();
    }
  };

  const updateTutor = async (tutorId: string) => {
    await supabase.from('sections').update({ tutor_id: tutorId }).eq('id', sectionId);
    toast({ title: "Tutor actualizado" });
    loadAllData();
  };

  const updateTeacher = async (courseId: string, teacherId: string) => {
    await supabase.from('section_courses').update({ teacher_id: teacherId }).eq('id', courseId);
    toast({ title: "Profesor asignado" });
    loadAllData();
  };

  if (loading) return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin"/></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4"/> Volver</Button>
        <h1 className="text-3xl font-bold">Gestión de {section?.name}</h1>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><User/> Asignar Tutor</CardTitle></CardHeader>
          <CardContent>
            <Select value={section?.tutor_id || ''} onValueChange={updateTutor}>
              <SelectTrigger><SelectValue placeholder="Seleccionar Tutor..."/></SelectTrigger>
              <SelectContent>{tutors.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="flex items-center gap-2"><BookOpen/> Cursos</CardTitle>
            <Button onClick={handleSyncCursos} variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4"/> Sincronizar Cursos</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {courses.length === 0 ? <p className="text-sm text-muted-foreground text-center">Haz clic en Sincronizar para traer los cursos del grado.</p> : 
              courses.map(course => (
                <div key={course.id} className="grid grid-cols-2 gap-4 items-center p-4 border rounded-lg">
                  <span className="font-medium">{course.base?.name}</span>
                  <Select value={course.teacher_id || ''} onValueChange={(val) => updateTeacher(course.id, val)}>
                    <SelectTrigger><SelectValue placeholder="Asignar profesor..."/></SelectTrigger>
                    <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users/> Alumnos ({students.length})</CardTitle></CardHeader>
          <CardContent>
            {students.map(s => <div key={s.id} className="p-2 border-b">{s.first_name} {s.last_name}</div>)}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SectionManagement;