import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Award } from 'lucide-react';
import { getLetterGrade } from './GradesSpreadsheet';

interface StudentCourseGradesProps {
  courseId: string;
  studentId: string;
}

export default function StudentCourseGrades({ courseId, studentId }: StudentCourseGradesProps) {
  const [bimestres, setBimestres] = useState<any[]>([]);
  const [selectedBimestreId, setSelectedBimestreId] = useState<string>('');
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [manualGrades, setManualGrades] = useState<Record<string, number>>({});
  const [finalScore, setFinalScore] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBimestres();
  }, []);

  useEffect(() => {
    if (selectedBimestreId) {
      loadStudentGrades();
    }
  }, [selectedBimestreId, courseId, studentId]);

  const fetchBimestres = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('academic_bimestres')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) throw error;
      setBimestres(data || []);
      
      if (data && data.length > 0) {
        const today = new Date();
        const current = data.find(b => {
          const start = new Date(b.start_date);
          const end = new Date(b.end_date);
          return today >= start && today <= end;
        });
        
        setSelectedBimestreId(current ? current.id : data[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching bimestres:', error);
      toast.error('Error al cargar bimestres');
      setLoading(false);
    }
  };

  const loadStudentGrades = async () => {
    try {
      setLoading(true);
      
      // Fetch Configs
      const { data: configsData, error: configsError } = await supabase
        .from('grade_weight_configurations')
        .select('*, eval_type:grade_evaluation_types(*)')
        .eq('course_id', courseId)
        .eq('bimestre_id', selectedBimestreId)
        .order('created_at');
        
      if (configsError) throw configsError;
      setConfigs(configsData || []);

      // Fetch Manual Grades for this student
      const { data: recordsData, error: recordsError } = await supabase
        .from('grade_records')
        .select('*')
        .eq('course_id', courseId)
        .eq('bimestre_id', selectedBimestreId)
        .eq('student_id', studentId);
        
      if (recordsError) throw recordsError;
      
      const parsedManuals: Record<string, number> = {};
      recordsData?.forEach(record => {
        if (record.score_value !== null) {
          parsedManuals[record.evaluation_type_id] = record.score_value;
        }
      });
      setManualGrades(parsedManuals);

      // Fetch Consolidation for this student
      const { data: consData, error: consError } = await supabase
        .from('grade_consolidations')
        .select('*')
        .eq('course_id', courseId)
        .eq('bimestre_id', selectedBimestreId)
        .eq('student_id', studentId)
        .maybeSingle();
        
      if (consError) throw consError;
      
      if (consData) {
        setFinalScore(consData.manual_override_value !== null ? consData.manual_override_value : consData.calculated_score_value);
      } else {
        setFinalScore(null);
      }
      
    } catch (error: any) {
      console.error('Error loading grades:', error);
      toast.error('Error al cargar tus notas');
    } finally {
      setLoading(false);
    }
  };

  if (loading && bimestres.length === 0) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (bimestres.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No hay bimestres configurados por administración.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/30">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <span className="font-semibold whitespace-nowrap">Bimestre:</span>
            <Select value={selectedBimestreId} onValueChange={setSelectedBimestreId}>
              <SelectTrigger className="w-[200px] bg-background">
                <SelectValue placeholder="Selecciona un bimestre" />
              </SelectTrigger>
              <SelectContent>
                {bimestres.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.academic_year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">El profesor aún no ha configurado las notas para este bimestre.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Desglose de Notas</CardTitle>
                <CardDescription>Resumen de tus calificaciones por rubro</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rubro</TableHead>
                      <TableHead className="text-center">Peso</TableHead>
                      <TableHead className="text-right">Nota / Letra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map(config => {
                      // Here, we'll show both manual and automatic ones from `manualGrades` state 
                      // because GradesSpreadsheet now saves both into grade_records on "Guardar Notas".
                      const typeId = config.evaluation_type_id;
                      const isAutomatic = config.eval_type?.is_automatic;
                      const score = manualGrades[typeId];
                      
                      return (
                        <TableRow key={config.id}>
                          <TableCell className="font-medium">
                            {config.eval_type?.name}
                            {isAutomatic && <span className="block text-xs text-muted-foreground">Calculado de entregas</span>}
                          </TableCell>
                          <TableCell className="text-center">{config.weight_percentage}%</TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {score !== null && score !== undefined ? (
                              <span>{typeof score === 'number' ? score.toFixed(1) : score} <span className="text-muted-foreground font-normal ml-1">({getLetterGrade(score)})</span></span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="text-center pb-2">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Nota Final
                </CardTitle>
                <CardDescription>Promedio del bimestre</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6">
                {finalScore !== null && finalScore !== undefined ? (
                  <>
                    <span className="text-6xl font-bold text-primary mb-2">{getLetterGrade(finalScore)}</span>
                    <span className="text-2xl font-medium text-muted-foreground">{finalScore.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-lg text-muted-foreground italic">No disponible</span>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
