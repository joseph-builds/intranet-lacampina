import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  Calendar,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
  FileCheck,
  TrendingUp,
  Award,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

// Convert letter grades to numeric scores
const convertLetterGrade = (score: string): number => {
  const numericScore = Number(score);
  if (!isNaN(numericScore)) return numericScore;

  const letterGrades: { [key: string]: number } = {
    AD: 18,
    A: 15,
    B: 12,
    C: 9,
  };

  return letterGrades[score.toUpperCase()] || 0;
};

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  last_name: string;
  last_name: string;
  student_code: string;
  email: string;
  phone?: string;
  document_number?: string;
  birth_date?: string;
}

interface CourseExam {
  course_id?: string;
  course_name: string;
  course_code: string;
  exam_title: string;
  score: number;
  max_score: number;
  submitted_at: string;
  status: 'Calificada' | 'Entregada' | 'No entregada';
}

interface CourseGrade {
  course_id?: string;
  course_name: string;
  course_code: string;
  assignment_title: string;
  score: number;
  max_score: number;
  submitted_at: string;
  graded_at: string;
  feedback?: string;
  status: 'Calificada' | 'Entregada' | 'No entregada';
}

interface CourseAttendance {
  course_name: string;
  course_code: string;
  date: string;
  status: string;
  notes?: string;
  recorded_at?: string;
}

interface StudentDetailDialogProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
}

export function StudentDetailDialog({
  student,
  open,
  onOpenChange,
  classroomId,
}: StudentDetailDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [grades, setGrades] = useState<CourseGrade[]>([]);
  const [exams, setExams] = useState<CourseExam[]>([]);
  const [attendance, setAttendance] = useState<CourseAttendance[]>([]);
  const [bimestres, setBimestres] = useState<CourseGrade[]>([]);
  const [coursesList, setCoursesList] = useState<{id: string, name: string}[]>([]);
  const [selectedBimestreCourse, setSelectedBimestreCourse] = useState<string>("all");
  const [selectedAssignmentCourse, setSelectedAssignmentCourse] = useState<string>("all");
  const [selectedExamCourse, setSelectedExamCourse] = useState<string>("all");

  useEffect(() => {
    if (student && open) {
      fetchStudentDetails();
    }
  }, [student, open]);

  const fetchStudentDetails = async () => {
    if (!student) return;

    try {
      setLoading(true);

      // Fetch grades and exams via RPC - bypasses all RLS chain issues
      const { data: detailData, error: detailError } = await supabase
        .rpc('get_tutor_student_detail', { p_student_id: student.id });

      if (detailError) throw detailError;

      // Extract unique courses
      const uniqueCourses = new Map();
      (detailData || []).forEach((r: any) => {
        if (r.course_id && !uniqueCourses.has(r.course_id)) {
          uniqueCourses.set(r.course_id, { id: r.course_id, name: r.course_name });
        }
      });
      setCoursesList(Array.from(uniqueCourses.values()));

      // Format bimestres
      const bimestreRows = (detailData || []).filter((r: any) => r.record_type === 'bimestre');
      const formattedBimestres: CourseGrade[] = bimestreRows
        .filter((r: any) => r.score_value !== null)
        .map((r: any) => ({
          course_id: r.course_id,
          course_name: r.course_name,
          course_code: r.course_code,
          assignment_title: `${r.evaluation_type_name} — ${r.bimestre_name}`,
          score: Number(r.score_value),
          max_score: Number(r.max_score) || 20,
          submitted_at: r.submitted_at || '',
          graded_at: r.graded_at || '',
          feedback: r.feedback || undefined,
          status: 'Calificada' as const,
        }));
      setBimestres(formattedBimestres);

      // Format assignments
      const assignmentRows = (detailData || []).filter((r: any) => r.record_type === 'assignment');
      const formattedAssignments: CourseGrade[] = assignmentRows.map((r: any) => {
         const isGraded = r.score_value !== null;
         return {
          course_id: r.course_id,
          course_name: r.course_name,
          course_code: r.course_code,
          assignment_title: r.item_title,
          score: isGraded ? convertLetterGrade(r.score_value) : 0,
          max_score: Number(r.max_score) || 20,
          submitted_at: r.submitted_at || '',
          graded_at: r.graded_at || '',
          feedback: r.feedback || undefined,
          status: isGraded ? 'Calificada' : (r.submitted_at ? 'Entregada' : 'No entregada'),
        }
      });
      setGrades(formattedAssignments);

      // Format exams
      const examRows = (detailData || []).filter((r: any) => r.record_type === 'exam');
      const formattedExams: CourseExam[] = examRows.map((r: any) => {
         const isGraded = r.score_value !== null;
         return {
          course_id: r.course_id,
          course_name: r.course_name,
          course_code: r.course_code,
          exam_title: r.item_title,
          score: isGraded ? convertLetterGrade(r.score_value) : 0,
          max_score: Number(r.max_score) || 20,
          submitted_at: r.submitted_at || '',
          status: isGraded ? 'Calificada' : (r.submitted_at ? 'Entregada' : 'No entregada'),
        }
      });
      setExams(formattedExams);

      // Fetch attendance - include classroom attendance and recorded_at
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select(
          `
          date,
          status,
          notes,
          recorded_at,
          course_id,
          classroom_id,
          courses(name, code)
        `,
        )
        .eq("student_id", student.id)
        .order("date", { ascending: false })
        .order("recorded_at", { ascending: false });

      if (attendanceError) throw attendanceError;

      const formattedAttendance: CourseAttendance[] = attendanceData
        .filter((a) => a.courses || a.classroom_id)
        .map((a) => ({
          course_name: a.courses ? (a.courses as any).name : "Aula Virtual",
          course_code: a.courses ? (a.courses as any).code : "General",
          date: a.date,
          status: a.status || "present",
          notes: a.notes || undefined,
          recorded_at: a.recorded_at || undefined,
        }));

      setAttendance(formattedAttendance);
    } catch (error) {
      console.error("Error fetching student details:", error);
      toast.error("Error al cargar los detalles del estudiante");
    } finally {
      setLoading(false);
    }
  };

  const getGradeLetter = (score: number): string => {
    if (score >= 18) return "AD";
    if (score >= 14) return "A";
    if (score >= 11) return "B";
    return "C";
  };

  const getGradeBadgeVariant = (
    score: number,
  ): "default" | "secondary" | "outline" | "destructive" => {
    if (score >= 18) return "default";
    if (score >= 14) return "secondary";
    if (score >= 11) return "outline";
    return "destructive";
  };

  const getAttendanceIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "absent":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "late":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "justified":
        return <FileCheck className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getAttendanceLabel = (status: string): string => {
    switch (status) {
      case "present":
        return "Presente";
      case "absent":
        return "Ausente";
      case "late":
        return "Tardanza";
      case "justified":
        return "Justificado";
      default:
        return "Presente";
    }
  };

  if (!student) return null;

  const gradedGrades = grades.filter(g => g.status === 'Calificada');
  const totalGrades = gradedGrades.length;
  const averageScore =
    totalGrades > 0
      ? gradedGrades.reduce((acc, g) => acc + g.score, 0) / totalGrades
      : 0;

  const gradeDistribution = gradedGrades.reduce(
    (acc, g) => {
      if (g.score >= 18) acc.ad++;
      else if (g.score >= 14) acc.a++;
      else if (g.score >= 11) acc.b++;
      else acc.c++;
      return acc;
    },
    { ad: 0, a: 0, b: 0, c: 0 },
  );

  const totalAttendance = attendance.length;
  const attendanceStats = attendance.reduce(
    (acc, a) => {
      if (a.status === "present") acc.present++;
      else if (a.status === "absent") acc.absent++;
      else if (a.status === "late") acc.late++;
      else if (a.status === "justified") acc.justified++;
      return acc;
    },
    { present: 0, absent: 0, late: 0, justified: 0 },
  );

  const attendanceRate =
    totalAttendance > 0
      ? ((attendanceStats.present + attendanceStats.late) / totalAttendance) *
        100
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>
                {student.last_name},{" "}
                {student.first_name}
              </DialogTitle>
              <DialogDescription>
                Información detallada del estudiante y su desempeño académico
              </DialogDescription>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                navigate(`/student/${student.id}`);
                onOpenChange(false);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Perfil Completo
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Información de Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{student.email}</span>
                </div>
                {student.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{student.phone}</span>
                  </div>
                )}
                {student.birth_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Fecha de nacimiento:{" "}
                      {format(new Date(student.birth_date), "dd/MM/yyyy")}
                    </span>
                  </div>
                )}
                {student.document_number && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      DNI: {student.document_number}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Código: {student.student_code}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Academic Details */}
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-32 bg-muted rounded"></div>
                <div className="h-32 bg-muted rounded"></div>
              </div>
            ) : (
              <Tabs defaultValue="bimestres" className="space-y-4">
                <TabsList className="flex flex-wrap w-full h-auto">
                  <TabsTrigger value="bimestres" className="flex-1 min-w-[100px]">
                    Bimestres ({bimestres.length})
                  </TabsTrigger>
                  <TabsTrigger value="grades" className="flex-1 min-w-[100px]">
                    Tareas ({grades.length})
                  </TabsTrigger>
                  <TabsTrigger value="exams" className="flex-1 min-w-[100px]">
                    Exámenes ({exams.length})
                  </TabsTrigger>
                  <TabsTrigger value="attendance" className="flex-1 min-w-[100px]">
                    Asistencia ({attendance.length})
                  </TabsTrigger>
                </TabsList>

                {/* BIMESTRES TAB */}
                <TabsContent value="bimestres" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Filtrar por curso</h3>
                    <Select value={selectedBimestreCourse} onValueChange={setSelectedBimestreCourse}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Todos los cursos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los cursos</SelectItem>
                        {coursesList.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {bimestres.filter(b => selectedBimestreCourse === 'all' || b.course_id === selectedBimestreCourse).length === 0 ? (
                    <Card><CardContent className="py-8 text-center text-muted-foreground">No hay notas bimestrales registradas para el curso seleccionado</CardContent></Card>
                  ) : (
                    <div className="space-y-4">
                      {bimestres
                        .filter(b => selectedBimestreCourse === 'all' || b.course_id === selectedBimestreCourse)
                        .map((grade, index) => (
                          <Card key={index}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="text-base">{grade.assignment_title}</CardTitle>
                                  <CardDescription>{grade.course_name} ({grade.course_code})</CardDescription>
                                </div>
                                <Badge variant={grade.status === 'Calificada' ? getGradeBadgeVariant(grade.score) : 'outline'}>
                                  {grade.status === 'Calificada' ? `${grade.score} - ${getGradeLetter(grade.score)}` : grade.status}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Puntuación</span>
                                <span className="font-medium">{grade.score} / {grade.max_score}</span>
                              </div>
                            </CardContent>
                          </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* TAREAS TAB */}
                <TabsContent value="grades" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Filtrar por curso</h3>
                    <Select value={selectedAssignmentCourse} onValueChange={setSelectedAssignmentCourse}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Todos los cursos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los cursos</SelectItem>
                        {coursesList.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {grades.filter(g => selectedAssignmentCourse === 'all' || g.course_id === selectedAssignmentCourse).length === 0 ? (
                    <Card><CardContent className="py-8 text-center text-muted-foreground">No hay tareas registradas para el curso seleccionado</CardContent></Card>
                  ) : (
                    <>
                      {/* Grade Distribution Summary */}
                      <Card className="bg-muted/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Distribución de Calificaciones
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="text-center p-2 bg-green-100 dark:bg-green-900/30 rounded">
                              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                                {gradeDistribution.ad}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                AD
                              </div>
                            </div>
                            <div className="text-center p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                {gradeDistribution.a}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                A
                              </div>
                            </div>
                            <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                                {gradeDistribution.b}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                B
                              </div>
                            </div>
                            <div className="text-center p-2 bg-red-100 dark:bg-red-900/30 rounded">
                              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                                {gradeDistribution.c}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                C
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Individual Grades */}
                      {grades.filter(g => selectedAssignmentCourse === "all" || g.course_id === selectedAssignmentCourse).map((grade, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base">
                                  {grade.assignment_title}
                                </CardTitle>
                                <CardDescription>
                                  {grade.course_name} ({grade.course_code})
                                </CardDescription>
                              </div>
                              <Badge
                                variant={grade.status === 'Calificada' ? getGradeBadgeVariant(grade.score) : 'outline'}
                              >
                                {grade.status === 'Calificada' ? `${grade.score} - ${getGradeLetter(grade.score)}` : grade.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Puntuación
                              </span>
                              <span className="font-medium">
                                {grade.score} / {grade.max_score}
                              </span>
                            </div>
                            {grade.status === 'Calificada' && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Calificado
                                </span>
                                <span>
                                  {format(
                                    new Date(grade.graded_at),
                                    "dd/MM/yyyy HH:mm",
                                  )}
                                </span>
                              </div>
                            )}
                            {grade.feedback && (
                              <div className="pt-2 border-t">
                                <p className="text-sm font-medium mb-1">
                                  Retroalimentación:
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {grade.feedback}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </TabsContent>

                {/* EXAMENES TAB */}
                <TabsContent value="exams" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Filtrar por curso</h3>
                    <Select value={selectedExamCourse} onValueChange={setSelectedExamCourse}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Todos los cursos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los cursos</SelectItem>
                        {coursesList.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {exams.filter(e => selectedExamCourse === 'all' || e.course_id === selectedExamCourse).length === 0 ? (
                    <Card><CardContent className="py-8 text-center text-muted-foreground">No hay exámenes registrados para el curso seleccionado</CardContent></Card>
                  ) : (
                    <>
                      {exams.filter(e => selectedExamCourse === "all" || e.course_id === selectedExamCourse).map((exam, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base">{exam.exam_title}</CardTitle>
                                <CardDescription>{exam.course_name} ({exam.course_code})</CardDescription>
                              </div>
                              <Badge variant={exam.status === 'Calificada' ? getGradeBadgeVariant(exam.score) : 'outline'}>
                                {exam.status === 'Calificada' ? `${exam.score} / 20` : exam.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Puntuación</span>
                              <span className="font-medium">{exam.score} / 20</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Entregado</span>
                              <span>{format(new Date(exam.submitted_at), 'dd/MM/yyyy HH:mm')}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="attendance" className="space-y-4">
                  {attendance.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No hay registros de asistencia
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Attendance Summary */}
                      <Card className="bg-muted/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Resumen de Asistencia
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Tasa de Asistencia
                            </span>
                            <span className="text-lg font-bold">
                              {attendanceRate.toFixed(1)}%
                            </span>
                          </div>
                          <Progress value={attendanceRate} className="h-2" />
                          <div className="grid grid-cols-4 gap-2 pt-2">
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">
                                {attendanceStats.present}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Presente
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-600">
                                {attendanceStats.absent}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Ausente
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-yellow-600">
                                {attendanceStats.late}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Tarde
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-600">
                                {attendanceStats.justified}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Justif.
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Individual Records */}
                      {attendance.map((record, index) => (
                        <Card key={index}>
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  {getAttendanceIcon(record.status)}
                                  <span className="font-medium">
                                    {getAttendanceLabel(record.status)}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {record.course_name} ({record.course_code})
                                </p>
                                {record.notes && (
                                  <p className="text-sm text-muted-foreground italic">
                                    📝 {record.notes}
                                  </p>
                                )}
                                {record.recorded_at && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Registrado:{" "}
                                    {format(
                                      new Date(record.recorded_at),
                                      "d MMM yyyy 'a las' HH:mm",
                                      { locale: es },
                                    )}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {format(new Date(record.date), "EEEE", {
                                    locale: es,
                                  })}
                                </p>
                                <p className="text-lg font-bold">
                                  {format(new Date(record.date), "d MMM", {
                                    locale: es,
                                  })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(record.date), "yyyy", {
                                    locale: es,
                                  })}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
