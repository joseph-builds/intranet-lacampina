import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Save, Info, Calculator } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface GradesSpreadsheetProps {
  courseId: string;
  bimestreId: string;
  isClosed: boolean;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

// Helper to convert numeric score to letter grade
export const getLetterGrade = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return '-';
  if (score >= 18) return 'AD';
  if (score >= 14) return 'A';
  if (score >= 11) return 'B';
  return 'C';
};

// Helper to parse a score (which might be a letter) to a number 0-20
export const parseScoreToNumeric = (val: string | null | undefined): number | null => {
  if (!val) return null;
  const str = val.toString().trim().toUpperCase();
  if (str === 'AD') return 20;
  if (str === 'A') return 17;
  if (str === 'B') return 13;
  if (str === 'C') return 10;
  
  const parsed = parseFloat(str);
  if (!isNaN(parsed)) return parsed;
  return null;
};

export default function GradesSpreadsheet({ courseId, bimestreId, isClosed }: GradesSpreadsheetProps) {
  const { profile } = useAuth();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  
  // Data state: studentId -> { typeId: score }
  const [manualGrades, setManualGrades] = useState<Record<string, Record<string, string>>>({});
  const [automaticGrades, setAutomaticGrades] = useState<Record<string, Record<string, number>>>({});
  const [initialManualGrades, setInitialManualGrades] = useState<Record<string, Record<string, string>>>({});
  const [consolidations, setConsolidations] = useState<Record<string, number>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    loadSpreadsheetData();
  }, [courseId, bimestreId]);

  const loadSpreadsheetData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Students
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('student:profiles!course_enrollments_student_id_fkey1(id, first_name, last_name)')
        .eq('course_id', courseId);
        
      const { data: sectionCourses, error: scError } = await supabase
        .from('section_courses')
        .select('section_id, base_course:base_courses!inner(course_id)')
        .eq('base_courses.course_id', courseId);
        
      let allStudents: Student[] = enrollments?.map(e => e.student as unknown as Student) || [];
      
      if (sectionCourses && sectionCourses.length > 0) {
        const { data: secStudents } = await supabase
          .from('student_sections')
          .select('student:profiles!student_sections_student_id_fkey(id, first_name, last_name)')
          .in('section_id', sectionCourses.map(sc => sc.section_id))
          .eq("is_active", true);
          
        if (secStudents) {
          const mapped = secStudents.map(ss => ss.student as unknown as Student);
          // Merge avoiding duplicates
          mapped.forEach(s => {
            if (!allStudents.find(existing => existing.id === s.id)) {
              allStudents.push(s);
            }
          });
        }
      }
      
      // Sort students alphabetically
      allStudents.sort((a, b) => a.last_name.localeCompare(b.last_name));
      setStudents(allStudents);

      // 2. Fetch Configs (Active columns for this course and bimestre)
      const { data: configsData, error: configsError } = await supabase
        .from('grade_weight_configurations')
        .select('*, eval_type:grade_evaluation_types(*)')
        .eq('course_id', courseId)
        .eq('bimestre_id', bimestreId)
        .order('created_at');
        
      if (configsError) throw configsError;
      setConfigs(configsData || []);

      // 3. Fetch Manual Grades
      const { data: recordsData, error: recordsError } = await supabase
        .from('grade_records')
        .select('*')
        .eq('course_id', courseId)
        .eq('bimestre_id', bimestreId);
        
      if (recordsError) throw recordsError;
      
      const parsedManuals: Record<string, Record<string, string>> = {};
      const parsedInitials: Record<string, Record<string, string>> = {};
      
      recordsData?.forEach(record => {
        if (!parsedManuals[record.student_id]) {
          parsedManuals[record.student_id] = {};
          parsedInitials[record.student_id] = {};
        }
        const val = record.score_value !== null ? record.score_value.toString() : '0';
        parsedManuals[record.student_id][record.evaluation_type_id] = val;
        parsedInitials[record.student_id][record.evaluation_type_id] = val;
      });
      setManualGrades(parsedManuals);
      setInitialManualGrades(parsedInitials);

      // 4. Fetch Consolidations
      const { data: consData, error: consError } = await supabase
        .from('grade_consolidations')
        .select('*')
        .eq('course_id', courseId)
        .eq('bimestre_id', bimestreId);
        
      if (consError) throw consError;
      
      const parsedCons: Record<string, number> = {};
      consData?.forEach(c => {
        parsedCons[c.student_id] = c.manual_override_value !== null ? c.manual_override_value : c.calculated_score_value;
      });
      setConsolidations(parsedCons);
      
      // 5. Fetch automatic scores
      const { data: selectedAssignments } = await supabase
        .from('grade_selected_assignments')
        .select('*')
        .eq('course_id', courseId)
        .eq('bimestre_id', bimestreId);

      const assignmentIds = selectedAssignments?.filter(s => s.assignment_id).map(s => s.assignment_id) || [];
      const examIds = selectedAssignments?.filter(s => s.exam_id).map(s => s.exam_id) || [];

      let asuData: any[] = [];
      let assignmentsData: any[] = [];
      if (assignmentIds.length > 0) {
        const { data: aData } = await supabase.from('assignments').select('id, max_score').in('id', assignmentIds);
        if (aData) assignmentsData = aData;
        
        const { data } = await supabase.from('assignment_submissions').select('student_id, score, assignment_id').in('assignment_id', assignmentIds);
        if (data) asuData = data;
      }

      let qsuData: any[] = [];
      let examsData: any[] = [];
      if (examIds.length > 0) {
        const { data: exams } = await supabase.from('exams').select('id, title, course_id, max_score').in('id', examIds);
        if (exams && exams.length > 0) {
          examsData = exams;
          const titles = exams.map(e => e.title);
          const { data: quizzes } = await supabase.from('quizzes').select('id, title').eq('course_id', courseId).in('title', titles);
          if (quizzes && quizzes.length > 0) {
            const quizIds = quizzes.map(q => q.id);
            const { data: qSubs } = await supabase.from('quiz_submissions').select('student_id, score, quiz_id').in('quiz_id', quizIds);
            
            if (qSubs) {
              qsuData = qSubs.map(qs => {
                const quiz = quizzes.find(q => q.id === qs.quiz_id);
                const exam = exams.find(e => e.title === quiz?.title);
                return { ...qs, exam_id: exam?.id };
              });
            }
          }
        }
      }
      
      const autoScores: Record<string, Record<string, number>> = {};
      
      // Calculate averages for automatic columns
      allStudents.forEach(student => {
        autoScores[student.id] = {};
        
        configsData?.forEach(config => {
          if (config.eval_type?.is_automatic) {
            const typeId = config.evaluation_type_id;
            let total = 0;
            let count = 0;
            
            if (config.eval_type.source_module === 'assignments') {
              const relevantAsg = selectedAssignments?.filter(sa => sa.evaluation_type_id === typeId && sa.assignment_id) || [];
              count = relevantAsg.length;
              relevantAsg.forEach(sa => {
                const sub = asuData.find(s => s.student_id === student.id && s.assignment_id === sa.assignment_id);
                const asg = assignmentsData.find(a => a.id === sa.assignment_id);
                const maxScore = asg?.max_score ? parseFloat(asg.max_score) : 20;
                
                if (sub && sub.score !== null) {
                  const s = parseScoreToNumeric(sub.score);
                  if (s !== null) {
                    const isLetter = ['AD', 'A', 'B', 'C'].includes(sub.score.toString().trim().toUpperCase());
                    if (isLetter) {
                      total += s;
                    } else {
                      total += (s / maxScore) * 20;
                    }
                  }
                }
              });
            } else if (config.eval_type.source_module === 'exams') {
              const relevantExams = selectedAssignments?.filter(sa => sa.evaluation_type_id === typeId && sa.exam_id) || [];
              count = relevantExams.length;
              relevantExams.forEach(sa => {
                const sub = qsuData.find(s => s.student_id === student.id && s.exam_id === sa.exam_id);
                const exm = examsData.find(e => e.id === sa.exam_id);
                const maxScore = exm?.max_score ? parseFloat(exm.max_score) : 20;
                
                if (sub && sub.score !== null) {
                  const s = parseScoreToNumeric(sub.score);
                  if (s !== null) {
                    const isLetter = ['AD', 'A', 'B', 'C'].includes(sub.score.toString().trim().toUpperCase());
                    if (isLetter) {
                      total += s;
                    } else {
                      total += (s / maxScore) * 20;
                    }
                  }
                }
              });
            }
            
            autoScores[student.id][typeId] = count > 0 ? total / count : 0;
          }
        });
      });
      
      setAutomaticGrades(autoScores);

    } catch (error: any) {
      console.error('Error loading spreadsheet:', error);
      toast.error('Error al cargar la planilla');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (studentId: string, typeId: string, value: string) => {
    // Basic validation for 0-20
    if (value !== '' && (Number(value) < 0 || Number(value) > 20)) return;
    
    setManualGrades(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [typeId]: value
      }
    }));
  };

  const saveGrades = async () => {
    if (isClosed) return;
    
    try {
      setSaving(true);
      
      // Prepare records to upsert using a Map to deduplicate
      const upsertMap = new Map<string, any>();
      
      Object.entries(manualGrades).forEach(([studentId, types]) => {
        Object.entries(types).forEach(([typeId, scoreStr]) => {
          const score = scoreStr !== '' ? parseFloat(scoreStr) : 0;
          const key = `${studentId}_${typeId}`;
          upsertMap.set(key, {
            student_id: studentId,
            course_id: courseId,
            bimestre_id: bimestreId,
            evaluation_type_id: typeId,
            score_value: score,
            recorded_by: profile?.id,
            updated_at: new Date().toISOString()
          });
        });
      });
      
      // Also save automatic grades so the student can view the calculated number.
      // This will overwrite any existing manual entries for automatic columns in the Map.
      Object.entries(automaticGrades).forEach(([studentId, types]) => {
        Object.entries(types).forEach(([typeId, scoreNum]) => {
          const key = `${studentId}_${typeId}`;
          upsertMap.set(key, {
            student_id: studentId,
            course_id: courseId,
            bimestre_id: bimestreId,
            evaluation_type_id: typeId,
            score_value: scoreNum,
            recorded_by: profile?.id,
            updated_at: new Date().toISOString()
          });
        });
      });

      const recordsToUpsert = Array.from(upsertMap.values());

      if (recordsToUpsert.length > 0) {
        const { error } = await supabase
          .from('grade_records')
          .upsert(recordsToUpsert, { onConflict: 'student_id, course_id, bimestre_id, evaluation_type_id' });
          
        if (error) throw error;
      }
      
      // Calculate and save consolidations dynamically
      const consToUpsert: any[] = [];
      students.forEach(student => {
        let finalScore = 0;
        configs.forEach(config => {
          const typeId = config.evaluation_type_id;
          let val = 0;
          if (config.eval_type?.is_automatic) {
            val = automaticGrades[student.id]?.[typeId] || 0;
          } else {
            const manualStr = manualGrades[student.id]?.[typeId];
            val = manualStr && manualStr !== '' ? parseFloat(manualStr) : 0;
            if (isNaN(val)) val = 0;
          }
          finalScore += val * (config.weight_percentage / 100);
        });
        
        consToUpsert.push({
          student_id: student.id,
          course_id: courseId,
          bimestre_id: bimestreId,
          calculated_score_value: finalScore,
          updated_at: new Date().toISOString()
        });
      });
      
      if (consToUpsert.length > 0) {
        const { error } = await supabase
          .from('grade_consolidations')
          .upsert(consToUpsert, { onConflict: 'student_id, course_id, bimestre_id' });
          
        if (error) throw error;
      }
      
      toast.success('Notas guardadas exitosamente');
      
      // Refresh to get latest consolidations from DB
      await loadSpreadsheetData();
      
    } catch (error: any) {
      console.error('Error saving grades:', error);
      toast.error('Error al guardar notas');
    } finally {
      setSaving(false);
    }
  };

  const calculateConsolidated = async () => {
    if (isClosed) return;
    try {
      setCalculating(true);
      await loadSpreadsheetData();
      toast.success('Datos recargados y promedios actualizados');
    } catch (error: any) {
      console.error('Error calculating:', error);
      toast.error('Error al recalcular promedios');
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (configs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Primero debes configurar los rubros y pesos en la pestaña "Configuración".</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle>Planilla de Notas</CardTitle>
            <CardDescription>Ingresa las notas (0-20). El sistema las convertirá a letras automáticamente para los estudiantes.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={calculateConsolidated} disabled={calculating || isClosed}>
              {calculating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
              Recalcular Promedios
            </Button>
            <Button onClick={saveGrades} disabled={saving || isClosed}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar Notas
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Escala de Notas:</strong> Ingresa números del 0 al 20. El sistema muestra la letra correspondiente: <br/>
            <span className="font-mono text-xs">0-10 = C | 11-13 = B | 14-17 = A | 18-20 = AD</span>
          </AlertDescription>
        </Alert>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] sticky left-0 bg-background z-10 border-r">Estudiante</TableHead>
                {configs.map(config => (
                  <TableHead key={config.id} className="min-w-[120px] text-center">
                    {config.eval_type?.name}
                    <div className="text-xs font-normal text-muted-foreground">{config.weight_percentage}%</div>
                  </TableHead>
                ))}
                <TableHead className="min-w-[120px] text-center font-bold sticky right-0 bg-background shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] border-l">
                  PROMEDIO
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(student => {
                // Front-end dynamic final score calculation
                let finalScore = 0;
                configs.forEach(config => {
                  const typeId = config.evaluation_type_id;
                  let val = 0;
                  if (config.eval_type?.is_automatic) {
                    val = automaticGrades[student.id]?.[typeId] || 0;
                  } else {
                    const newValStr = manualGrades[student.id]?.[typeId];
                    val = newValStr && newValStr !== '' ? parseFloat(newValStr) : 0;
                    if (isNaN(val)) val = 0;
                  }
                  finalScore += val * (config.weight_percentage / 100);
                });
                
                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">
                      {student.last_name}, {student.first_name}
                    </TableCell>
                    
                    {configs.map(config => {
                      const typeId = config.evaluation_type_id;
                      const isAutomatic = config.eval_type?.is_automatic;
                      
                      const manualValue = manualGrades[student.id]?.[typeId] ?? '';
                      const displayLetter = manualValue !== '' ? getLetterGrade(Number(manualValue)) : '-';
                      
                      return (
                        <TableCell key={config.id} className="text-center p-2">
                          {isAutomatic ? (
                            <div className="flex flex-col items-center justify-center text-sm text-muted-foreground italic h-10 bg-slate-50 rounded">
                              {automaticGrades[student.id]?.[typeId] !== undefined ? (
                                <span className="text-foreground font-semibold">{automaticGrades[student.id][typeId].toFixed(1)}</span>
                              ) : (
                                "Automático"
                              )}
                            </div>
                          ) : (
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                max="20"
                                className="w-16 mx-auto text-center pr-6 h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={manualValue !== undefined ? manualValue : '0'}
                                onChange={(e) => handleGradeChange(student.id, typeId, e.target.value)}
                                disabled={isClosed}
                              />
                              {(manualValue !== '' && manualValue !== undefined) && (
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-bold text-primary opacity-50 pointer-events-none pr-3">
                                  {displayLetter}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                    
                    <TableCell className="text-center font-bold text-lg sticky right-0 bg-background shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] border-l">
                      <div className="flex flex-col items-center">
                        <span>{getLetterGrade(finalScore)}</span>
                        <span className="text-xs text-muted-foreground font-normal">{Math.max(0, Math.min(20, finalScore)).toFixed(1)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={configs.length + 2} className="text-center py-8 text-muted-foreground">
                    No hay estudiantes matriculados en este curso.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
