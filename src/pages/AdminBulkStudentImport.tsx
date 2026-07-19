import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, ArrowRightLeft, AlertTriangle, GraduationCap, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface StudentPromotion {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const AdminBulkStudentImport = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<any[]>([]);

  // Estados para Promoción Masiva
  const [sourceGradeId, setSourceGradeId] = useState<string>('');
  const [targetGradeId, setTargetGradeId] = useState<string>('');
  const [studentsToPromote, setStudentsToPromote] = useState<StudentPromotion[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // Estados para Egreso (Graduación)
  const [graduateGradeId, setGraduateGradeId] = useState<string>('');
  const [studentsToGraduate, setStudentsToGraduate] = useState<StudentPromotion[]>([]);
  const [selectedGraduateIds, setSelectedGraduateIds] = useState<string[]>([]);

  // Seguridad de Modales
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [isGraduateModalOpen, setIsGraduateModalOpen] = useState(false);
  const [securityWord, setSecurityWord] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    setLoading(true);
    try {
      const { data: gradesData } = await supabase
        .from('academic_grades')
        .select('id, name, level:academic_levels(name)')
        .order('name');
      setGrades(gradesData || []);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los grados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE PROMOCIÓN ---
  useEffect(() => {
    if (sourceGradeId) {
      loadStudents(sourceGradeId, setStudentsToPromote, setSelectedStudentIds);
    } else {
      setStudentsToPromote([]);
      setSelectedStudentIds([]);
    }
  }, [sourceGradeId]);

  // --- LÓGICA DE EGRESO ---
  useEffect(() => {
    if (graduateGradeId) {
      loadStudents(graduateGradeId, setStudentsToGraduate, setSelectedGraduateIds);
    } else {
      setStudentsToGraduate([]);
      setSelectedGraduateIds([]);
    }
  }, [graduateGradeId]);

  // Función reutilizable para cargar alumnos por grado
  const loadStudents = async (gradeId: string, setList: any, setSelection: any) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('role', 'student')
      .eq('current_grade_id', gradeId)
      .eq('is_active', true)
      .order('last_name');
      
    setList(data || []);
    setSelection((data || []).map((s: any) => s.id));
  };

  const toggleSelection = (studentId: string, currentSelection: string[], setSelection: any) => {
    setSelection(
      currentSelection.includes(studentId) 
        ? currentSelection.filter(id => id !== studentId) 
        : [...currentSelection, studentId]
    );
  };

  const handleExecutePromotion = async () => {
    if (securityWord !== 'CONFIRMAR') return toast({ title: "Seguridad fallida", variant: "destructive" });
    
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('profiles').update({ current_grade_id: targetGradeId }).in('id', selectedStudentIds);
      if (error) throw error;

      toast({ title: "¡Promoción Exitosa!", description: `${selectedStudentIds.length} alumnos promovidos.` });
      setIsPromoteModalOpen(false);
      setSecurityWord('');
      setSourceGradeId('');
      setTargetGradeId('');
    } catch (error) {
      toast({ title: "Error", description: "Fallo al promover.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteGraduation = async () => {
    if (securityWord !== 'EGRESAR') return toast({ title: "Seguridad fallida", variant: "destructive" });
    
    setIsProcessing(true);
    try {
      // Pasamos a los alumnos a inactivos (egresados del sistema actual)
      const { error } = await supabase.from('profiles').update({ is_active: false }).in('id', selectedGraduateIds);
      if (error) throw error;

      toast({ title: "¡Egreso Exitoso!", description: `${selectedGraduateIds.length} alumnos han sido marcados como egresados.` });
      setIsGraduateModalOpen(false);
      setSecurityWord('');
      setGraduateGradeId('');
    } catch (error) {
      toast({ title: "Error", description: "Fallo al egresar alumnos.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- AGRUPACIÓN DE GRADOS PARA LOS SELECTS ---
  const groupedGrades = grades.reduce((acc, grade) => {
    const levelName = grade.level?.name || 'Sin Nivel';
    if (!acc[levelName]) acc[levelName] = [];
    acc[levelName].push(grade);
    return acc;
  }, {} as Record<string, any[]>);

  const orderConfig = ['Inicial', 'Primaria', 'Secundaria'];
  const sortedLevelKeys = Object.keys(groupedGrades).sort((a, b) => {
    const indexA = orderConfig.findIndex(l => a.toLowerCase().includes(l.toLowerCase()));
    const indexB = orderConfig.findIndex(l => b.toLowerCase().includes(l.toLowerCase()));
    return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
  });

  if (loading) return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3 text-gray-800">
            <Users className="h-8 w-8 text-blue-600" />
            Operaciones Masivas de Estudiantes
          </h1>
          <p className="text-muted-foreground">
            Central de procesos automáticos de fin de año: promueve alumnos al siguiente grado o registra el egreso de las promociones salientes.
          </p>
        </div>

        <Tabs defaultValue="promote" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-8">
            <TabsTrigger value="promote" className="font-medium"><ArrowRightLeft className="w-4 h-4 mr-2"/> Promoción de Grado</TabsTrigger>
            <TabsTrigger value="graduate" className="font-medium text-amber-700 data-[state=active]:text-amber-700 data-[state=active]:bg-amber-50"><GraduationCap className="w-5 h-5 mr-2"/> Egreso Escolar</TabsTrigger>
          </TabsList>

          {/* ==========================================
              PESTAÑA 1: PROMOCIÓN DE GRADO
             ========================================== */}
          <TabsContent value="promote" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-md shadow-sm">
              <div className="flex items-center gap-2 text-amber-800 font-bold mb-1">
                <AlertTriangle className="w-5 h-5" /> Importante: Orden de Promoción
              </div>
              <p className="text-sm text-amber-900">
                Para evitar errores en cadena, realiza las promociones <strong>desde el grado más alto hacia el más bajo</strong>. 
                Por ejemplo, primero promueve a los alumnos de 4to a 5to, luego a los de 3ro a 4to. 
                De lo contrario, los alumnos recién promovidos podrían mezclarse y volver a ser trasladados por accidente.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* CONTROLES PROMOCIÓN */}
              <div className="space-y-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-lg">Configuración de Traslado</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-gray-700">1. Grado de Origen (Actual)</label>
                      <Select value={sourceGradeId} onValueChange={setSourceGradeId}>
                        <SelectTrigger className="border-blue-200 bg-blue-50/50 focus:ring-blue-500">
                          <SelectValue placeholder="Selecciona el grado actual" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedLevelKeys.map(level => (
                            <SelectGroup key={level}>
                              <SelectLabel className="bg-gray-50/80 text-gray-500 font-bold uppercase text-[11px] py-1 tracking-wider">{level}</SelectLabel>
                              {groupedGrades[level].map(g => (
                                /* SOLUCIÓN AL NOMBRE: Mostramos "1ro (Secundaria)" */
                                <SelectItem key={g.id} value={g.id} className="pl-6 font-medium text-gray-700">
                                  {g.name} ({level})
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-center text-gray-300"><ArrowRightLeft className="w-6 h-6 rotate-90 md:rotate-0" /></div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-gray-700">2. Grado Destino (A promover)</label>
                      <Select value={targetGradeId} onValueChange={setTargetGradeId}>
                        <SelectTrigger className="border-green-200 bg-green-50/50 focus:ring-green-500">
                          <SelectValue placeholder="Selecciona a qué grado pasarán" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedLevelKeys.map(level => (
                            <SelectGroup key={level}>
                              <SelectLabel className="bg-gray-50/80 text-gray-500 font-bold uppercase text-[11px] py-1 tracking-wider">{level}</SelectLabel>
                              {groupedGrades[level].map(g => (
                                <SelectItem key={g.id} value={g.id} disabled={g.id === sourceGradeId} className="pl-6 font-medium text-gray-700">
                                  {g.name} ({level})
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md" disabled={!sourceGradeId || !targetGradeId || selectedStudentIds.length === 0} onClick={() => setIsPromoteModalOpen(true)}>
                      Promover {selectedStudentIds.length} Alumnos
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* LISTA PROMOCIÓN */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-lg">Alumnos del Grado de Origen</CardTitle>
                    <CardDescription>Desmarca a los alumnos que repiten o no continúan.</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1 bg-white border border-gray-200">{studentsToPromote.length}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[400px] overflow-y-auto">
                    {studentsToPromote.length === 0 ? (
                      <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                        <Users className="w-12 h-12 mb-3 text-gray-300" />
                        Selecciona un grado de origen para ver a los alumnos.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {studentsToPromote.map(student => (
                          <div key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div>
                              <div className="font-semibold text-gray-800">{student.last_name}, {student.first_name}</div>
                              <div className="text-xs text-gray-500">{student.email}</div>
                            </div>
                            <Checkbox checked={selectedStudentIds.includes(student.id)} onCheckedChange={() => toggleSelection(student.id, selectedStudentIds, setSelectedStudentIds)} className="w-5 h-5 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"/>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==========================================
              PESTAÑA 2: EGRESO MASIVO (NUEVO)
             ========================================== */}
          <TabsContent value="graduate" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* CONTROLES EGRESO */}
              <div className="space-y-6">
                <Card className="border-0 shadow-sm border-t-4 border-t-amber-500">
                  <CardHeader className="bg-amber-50/30 border-b">
                    <CardTitle className="text-lg text-amber-900 flex items-center gap-2"><GraduationCap className="w-5 h-5"/> Egresar Promoción</CardTitle>
                    <CardDescription>Pasa a estado inactivo a los alumnos que finalizan la secundaria.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-gray-700">Seleccionar Grado a Egresar (Ej: 5to Secundaria)</label>
                      <Select value={graduateGradeId} onValueChange={setGraduateGradeId}>
                        <SelectTrigger className="border-amber-200 bg-amber-50/50 focus:ring-amber-500">
                          <SelectValue placeholder="Elige el grado que se gradúa..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedLevelKeys.map(level => (
                            <SelectGroup key={level}>
                              <SelectLabel className="bg-gray-50/80 text-gray-500 font-bold uppercase text-[11px] py-1 tracking-wider">{level}</SelectLabel>
                              {groupedGrades[level].map(g => (
                                <SelectItem key={g.id} value={g.id} className="pl-6 font-medium text-gray-700">
                                  {g.name} ({level})
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white shadow-md" disabled={!graduateGradeId || selectedGraduateIds.length === 0} onClick={() => setIsGraduateModalOpen(true)}>
                      Egresar {selectedGraduateIds.length} Alumnos
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* LISTA EGRESO */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-lg">Candidatos a Egreso</CardTitle>
                    <CardDescription>Alumnos seleccionados pasarán al archivo histórico.</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1 bg-white border border-gray-200 text-amber-600">{studentsToGraduate.length}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[400px] overflow-y-auto">
                    {studentsToGraduate.length === 0 ? (
                      <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                        <CheckCircle2 className="w-12 h-12 mb-3 text-gray-300" />
                        Selecciona el grado saliente para ver a los alumnos a egresar.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {studentsToGraduate.map(student => (
                          <div key={student.id} className="p-4 flex items-center justify-between hover:bg-amber-50/30 transition-colors">
                            <div>
                              <div className="font-semibold text-gray-800">{student.last_name}, {student.first_name}</div>
                              <div className="text-xs text-gray-500">{student.email}</div>
                            </div>
                            <Checkbox checked={selectedGraduateIds.includes(student.id)} onCheckedChange={() => toggleSelection(student.id, selectedGraduateIds, setSelectedGraduateIds)} className="w-5 h-5 border-gray-300 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"/>
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

        {/* MODAL CONFIRMAR PROMOCIÓN */}
        <Dialog open={isPromoteModalOpen} onOpenChange={(open) => { if(!open) { setIsPromoteModalOpen(false); setSecurityWord(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="text-blue-600">Confirmar Promoción de Grado</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-gray-700 text-sm">Estás a punto de cambiar el grado actual de <strong>{selectedStudentIds.length} alumnos</strong>.</p>
              <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 border border-blue-200">
                Escribe <strong>CONFIRMAR</strong> para proceder con el traslado masivo.
              </div>
              <Input value={securityWord} onChange={e => setSecurityWord(e.target.value)} placeholder="CONFIRMAR" className="text-center font-bold tracking-widest uppercase" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPromoteModalOpen(false)} disabled={isProcessing}>Cancelar</Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={securityWord !== 'CONFIRMAR' || isProcessing} onClick={handleExecutePromotion}>
                {isProcessing ? 'Ejecutando...' : 'Ejecutar Promoción'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL CONFIRMAR EGRESO */}
        <Dialog open={isGraduateModalOpen} onOpenChange={(open) => { if(!open) { setIsGraduateModalOpen(false); setSecurityWord(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="text-amber-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Confirmar Egreso de Alumnos</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-gray-700 text-sm">Vas a egresar a <strong>{selectedGraduateIds.length} alumnos</strong>. Sus cuentas pasarán a estado inactivo (solo lectura para certificados).</p>
              <div className="bg-amber-50 p-3 rounded text-sm text-amber-800 border border-amber-200">
                Escribe <strong>EGRESAR</strong> para concluir su ciclo escolar en el sistema.
              </div>
              <Input value={securityWord} onChange={e => setSecurityWord(e.target.value)} placeholder="EGRESAR" className="text-center font-bold tracking-widest uppercase" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsGraduateModalOpen(false)} disabled={isProcessing}>Cancelar</Button>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white" disabled={securityWord !== 'EGRESAR' || isProcessing} onClick={handleExecuteGraduation}>
                {isProcessing ? 'Procesando...' : 'Egresar Alumnos'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default AdminBulkStudentImport;