import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BulkStudentImport } from '@/components/students/BulkStudentImport'; 
import { Loader2, School, Users, FileSpreadsheet, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// --- INTERFACES ---
interface VirtualClassroom {
  id: string;
  name: string;
  grade: string;
  level: string;
  is_active: boolean;
  room_number: string;
  tutor?: { first_name: string; last_name: string };
  enrollmentCount: number;
}

interface StudentPromotion {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const AdminBulkStudentImport = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  // Estados para Importación Excel
  const [classrooms, setClassrooms] = useState<VirtualClassroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState<VirtualClassroom | null>(null);

  // Estados para Promoción Masiva
  const [grades, setGrades] = useState<any[]>([]);
  const [sourceGradeId, setSourceGradeId] = useState<string>('');
  const [targetGradeId, setTargetGradeId] = useState<string>('');
  const [studentsToPromote, setStudentsToPromote] = useState<StudentPromotion[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // Seguridad de Promoción
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [securityWord, setSecurityWord] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  if (profile?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center text-red-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
              <div className="text-lg font-bold">Acceso Denegado</div>
              <p>Solo los administradores pueden acceder a procesos masivos.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. CARGAR AULAS (SECTIONS) REALES DE LA NUEVA BD
      // CORRECCIÓN: Eliminamos la búsqueda de 'is_active' porque no existe en la tabla sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('sections')
        .select(`
          id, name, room_number,
          tutor:profiles!tutor_id(first_name, last_name),
          grade:academic_grades(name, level:academic_levels(name))
        `)
        .order('name');

      if (sectionsError) throw sectionsError;

      // 2. OBTENER CONTEO DE ALUMNOS POR AULA
      const { data: enrollmentsData } = await supabase
        .from('student_sections')
        .select('section_id');

      const enrollmentCounts: Record<string, number> = {};
      enrollmentsData?.forEach(e => {
        enrollmentCounts[e.section_id] = (enrollmentCounts[e.section_id] || 0) + 1;
      });

      // Mapear al formato que espera tu componente BulkStudentImport
      const formattedClassrooms = sectionsData?.map(sec => ({
        id: sec.id,
        name: sec.name,
        is_active: true, // Lo fijamos en true visualmente para no romper tu diseño de UI
        room_number: sec.room_number || 'No asignado',
        grade: sec.grade?.name || 'Sin Grado',
        level: sec.grade?.level?.name || 'Sin Nivel',
        tutor: sec.tutor as any,
        enrollmentCount: enrollmentCounts[sec.id] || 0
      }));
      setClassrooms(formattedClassrooms || []);

      // 3. CARGAR GRADOS PARA LA PESTAÑA DE PROMOCIÓN
      const { data: gradesData } = await supabase
        .from('academic_grades')
        .select('id, name, level:academic_levels(name)')
        .order('name');
      setGrades(gradesData || []);

    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE PROMOCIÓN MASIVA ---
  
  // Buscar alumnos cuando se selecciona un grado de origen
  useEffect(() => {
    if (sourceGradeId) {
      loadStudentsForPromotion(sourceGradeId);
    } else {
      setStudentsToPromote([]);
      setSelectedStudentIds([]);
    }
  }, [sourceGradeId]);

  const loadStudentsForPromotion = async (gradeId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('role', 'student')
      .eq('current_grade_id', gradeId)
      .eq('is_active', true)
      .order('last_name');
      
    setStudentsToPromote(data || []);
    // Por defecto, seleccionamos a todos para que sea más rápido
    setSelectedStudentIds((data || []).map(s => s.id));
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleExecutePromotion = async () => {
    if (securityWord !== 'CONFIRMAR') {
      return toast({ title: "Seguridad fallida", description: "Escribe CONFIRMAR exactamente para continuar.", variant: "destructive" });
    }
    
    setIsPromoting(true);
    try {
      // Actualizamos masivamente el grado actual de los alumnos seleccionados
      const { error } = await supabase
        .from('profiles')
        .update({ current_grade_id: targetGradeId })
        .in('id', selectedStudentIds);

      if (error) throw error;

      toast({ title: "¡Promoción Exitosa!", description: `${selectedStudentIds.length} alumnos han sido promovidos de grado correctamente.` });
      
      // Limpiar estados
      setIsConfirmModalOpen(false);
      setSecurityWord('');
      setSourceGradeId('');
      setTargetGradeId('');
      
    } catch (error) {
      toast({ title: "Error crítico", description: "No se pudo realizar la promoción masiva.", variant: "destructive" });
    } finally {
      setIsPromoting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3 text-gray-800">
            <Users className="h-8 w-8 text-blue-600" />
            Operaciones Masivas de Estudiantes
          </h1>
          <p className="text-muted-foreground">
            Central de procesos automáticos: importa matrículas desde Excel o promueve alumnos al siguiente año escolar.
          </p>
        </div>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-8">
            <TabsTrigger value="import" className="font-medium"><FileSpreadsheet className="w-4 h-4 mr-2"/> Importar Excel</TabsTrigger>
            <TabsTrigger value="promote" className="font-medium"><ArrowRightLeft className="w-4 h-4 mr-2"/> Promoción de Grado</TabsTrigger>
          </TabsList>

          {/* ==========================================
              PESTAÑA 1: IMPORTACIÓN DESDE EXCEL
             ========================================== */}
          <TabsContent value="import" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-blue-100 bg-blue-50/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-blue-800">1. Selecciona el Aula Destino</CardTitle>
                <CardDescription>Elige a qué aula (sección) pertenecerán los alumnos del Excel.</CardDescription>
              </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {classrooms.map((classroom) => (
                <Card
                  key={classroom.id}
                  className={`cursor-pointer transition-all hover:shadow-md border-t-4 ${
                    selectedClassroom?.id === classroom.id ? 'border-t-blue-600 shadow-md ring-1 ring-blue-200 bg-blue-50/10' : 'border-t-gray-200'
                  }`}
                  onClick={() => setSelectedClassroom(classroom)}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 font-bold text-lg text-gray-800">
                        <School className="h-5 w-5 text-gray-500" /> {classroom.name}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Grado:</span><span className="font-medium">{classroom.grade}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Nivel:</span><span className="font-medium">{classroom.level}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Salón:</span><span className="font-medium">{classroom.room_number}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Alumnos Inscritos:</span><span className="font-bold text-blue-600">{classroom.enrollmentCount}</span></div>
                    </div>

                    {classroom.tutor && (
                      <div className="text-xs text-gray-500 pt-3 border-t mt-3 flex items-center gap-1">
                         Tutor: {classroom.tutor.first_name} {classroom.tutor.last_name}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {classrooms.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                <School className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">No hay aulas virtuales. Debes crear una sección primero.</p>
              </div>
            )}

            {selectedClassroom && (
              <div className="mt-8 border-t pt-8">
                <BulkStudentImport classroom={selectedClassroom} onImportComplete={fetchInitialData} />
              </div>
            )}
          </TabsContent>

          {/* ==========================================
              PESTAÑA 2: PROMOCIÓN MASIVA (NUEVA)
             ========================================== */}
          <TabsContent value="promote" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* CONTROLES */}
              <div className="space-y-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-lg">Configuración de Traslado</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-gray-700">1. Grado de Origen (Actual)</label>
                      <Select value={sourceGradeId} onValueChange={setSourceGradeId}>
                        <SelectTrigger className="border-blue-200 bg-blue-50/50 focus:ring-blue-500"><SelectValue placeholder="Selecciona el grado actual de los alumnos" /></SelectTrigger>
                        <SelectContent>
                          {grades.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name} ({g.level?.name})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-center text-gray-300"><ArrowRightLeft className="w-6 h-6 rotate-90 md:rotate-0" /></div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-gray-700">2. Grado Destino (A promover)</label>
                      <Select value={targetGradeId} onValueChange={setTargetGradeId}>
                        <SelectTrigger className="border-green-200 bg-green-50/50 focus:ring-green-500"><SelectValue placeholder="Selecciona a qué grado pasarán" /></SelectTrigger>
                        <SelectContent>
                          {grades.map(g => (
                            <SelectItem key={g.id} value={g.id} disabled={g.id === sourceGradeId}>{g.name} ({g.level?.name})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={!sourceGradeId || !targetGradeId || selectedStudentIds.length === 0}
                      onClick={() => setIsConfirmModalOpen(true)}
                    >
                      Promover {selectedStudentIds.length} Alumnos
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* LISTA DE ALUMNOS */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-lg">Alumnos del Grado de Origen</CardTitle>
                    <CardDescription>Desmarca a los alumnos que repiten o no continúan.</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1 bg-white">{studentsToPromote.length}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    {studentsToPromote.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">Selecciona un grado de origen para ver a los alumnos.</div>
                    ) : (
                      <div className="divide-y">
                        {studentsToPromote.map(student => (
                          <div key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div>
                              <div className="font-semibold text-gray-800">{student.last_name}, {student.first_name}</div>
                              <div className="text-xs text-gray-500">{student.email}</div>
                            </div>
                            <Checkbox 
                              checked={selectedStudentIds.includes(student.id)} 
                              onCheckedChange={() => toggleStudentSelection(student.id)}
                              className="w-5 h-5 border-gray-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>

        {/* MODAL DE SEGURIDAD PARA PROMOCIÓN */}
        <Dialog open={isConfirmModalOpen} onOpenChange={(open) => { if(!open) { setIsConfirmModalOpen(false); setSecurityWord(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5"/> Advertencia de Seguridad
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-gray-700 text-sm">
                Estás a punto de cambiar el grado actual de <strong>{selectedStudentIds.length} alumnos</strong>. 
                Esta acción modificará sus mallas curriculares y estado en el sistema.
              </p>
              <div className="bg-red-50 p-3 rounded text-sm text-red-800 border border-red-200">
                Para confirmar la promoción masiva, escribe la palabra <strong>CONFIRMAR</strong> (en mayúsculas) en la caja de abajo.
              </div>
              <Input 
                value={securityWord} 
                onChange={e => setSecurityWord(e.target.value)} 
                placeholder="Escribe CONFIRMAR" 
                className="text-center font-bold tracking-widest border-red-300 focus-visible:ring-red-500"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsConfirmModalOpen(false)} disabled={isPromoting}>Cancelar</Button>
              <Button 
                type="button" 
                className="bg-red-600 hover:bg-red-700 text-white" 
                disabled={securityWord !== 'CONFIRMAR' || isPromoting}
                onClick={handleExecutePromotion}
              >
                {isPromoting ? 'Ejecutando...' : 'Ejecutar Promoción Masiva'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default AdminBulkStudentImport;