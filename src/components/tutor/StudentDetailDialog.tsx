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
  course_name: string;
  course_code: string;
  exam_title: string;
  score: number;
  max_score: number;
  submitted_at: string;
  status: 'Calificada' | 'Entregada' | 'No entregada';
}

interface CourseGrade {
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

  useEffect(() => {
    if (student && open) {
      fetchStudentDetails();
    }
  }, [student, open]);

  const fetchStudentDetails = async () => {
    if (!student) return;

    try {
      setLoading(true);

      // 1. Get courses from the classroom (most reliable path for tutor)
      const { data: classroomCourses } = await supabase
        .from('courses')
        .select('id')
        .eq('classroom_id', classroomId);

      // 2. Also get courses from direct enrollments as fallback
      const { data: directEnroll } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('student_id', student.id);

      // 3. Merge all course IDs and deduplicate
      let courseIds: string[] = [
        ...(classroomCourses?.map(c => c.id) || []),
        ...(directEnroll?.map(d => d.course_id) || []),
      ];
      courseIds = [...new Set(courseIds)];

      console.log('📚 courseIds for student', student.first_name, ':', courseIds);

      if (courseIds.length > 0) {
        // Fetch all assignments for these courses
        const { data: allAssignments } = await supabase
          .from('assignments')
          .select('id, title, max_score, course_id, courses!inner(name, code)')
          .in('course_id', courseIds);

        const { data: submissionsData } = await supabase
          .from('assignment_submissions')
          .select('assignment_id, score, submitted_at, graded_at, feedback')
          .eq('student_id', student.id);

        console.log('📝 Assignments found:', allAssignments?.length, 'Submissions:', submissionsData?.length);

        const formattedGrades: CourseGrade[] = (allAssignments || []).map(a => {
          const sub = submissionsData?.find(s => s.assignment_id === a.id);
          const isGraded = sub && sub.score !== null && sub.score !== undefined;
          return {
            course_name: (a.courses as any).name,
            course_code: (a.courses as any).code,
            assignment_title: a.title,
            score: isGraded ? convertLetterGrade(sub.score) : 0,
            max_score: Number(a.max_score),
            submitted_at: sub?.submitted_at || "",
            graded_at: sub?.graded_at || "",
            feedback: sub?.feedback || undefined,
            status: sub ? (isGraded ? 'Calificada' : 'Entregada') : 'No entregada'
          };
        });
        setGrades(formattedGrades);

        // Fetch exams (quizzes)
        const { data: allQuizzes } = await supabase
          .from('quizzes')
          .select('id, title, course_id, courses!inner(name, code)')
          .in('course_id', courseIds);

        // Also fetch from exams table as fallback
        const { data: allExams } = await supabase
          .from('exams')
          .select('id, title, course_id, max_score, courses:courses!exams_modulo_id_fkey(name, code)')
          .in('course_id', courseIds);

        const { data: quizSubs } = await supabase
          .from('quiz_submissions')
          .select('quiz_id, score, submitted_at')
          .eq('student_id', student.id);

        console.log('🎓 Quizzes found:', allQuizzes?.length, 'Exams found:', allExams?.length, 'Quiz submissions:', quizSubs?.length);

        // Build exam list from quizzes
        const examList: CourseExam[] = [];
        const seenTitles = new Set<string>();

        (allQuizzes || []).forEach(q => {
          const sub = quizSubs?.find(s => s.quiz_id === q.id);
          const isGraded = sub && sub.score !== null && sub.score !== undefined;
          const key = `${q.title}-${q.course_id}`;
          seenTitles.add(key);
          examList.push({
            course_name: (q.courses as any).name,
            course_code: (q.courses as any).code,
            exam_title: q.title,
            score: isGraded ? convertLetterGrade(sub.score) : 0,
            max_score: 20,
            submitted_at: sub?.submitted_at || '',
            status: sub ? (isGraded ? 'Calificada' : 'Entregada') : 'No entregada'
          });
        });

        // Add exams that don't already exist from quizzes
        (allExams || []).forEach(e => {
          const key = `${e.title}-${e.course_id}`;
          if (!seenTitles.has(key) && e.courses) {
            seenTitles.add(key);
            examList.push({
              course_name: (e.courses as any).name,
              course_code: (e.courses as any).code,
              exam_title: e.title,
              score: 0,
              max_score: Number(e.max_score) || 20,
              submitted_at: '',
              status: 'No entregada'
            });
          }
        });

        setExams(examList);
      } else {
        setGrades([]);
        setExams([]);
      }

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
            {/* Performance Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Promedio General
                      </p>
                      <p className="text-3xl font-bold mt-1">
                        {averageScore.toFixed(1)}
                      </p>
                      <Badge variant="outline" className="mt-2">
                        {getGradeLetter(averageScore)}
                      </Badge>
                    </div>
                    <Award className="h-12 w-12 text-primary opacity-50" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {totalGrades}{" "}
                    {totalGrades === 1 ? "calificación" : "calificaciones"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Asistencia
                      </p>
                      <p className="text-3xl font-bold mt-1">
                        {attendanceRate.toFixed(1)}%
                      </p>
                      <Badge
                        variant={
                          attendanceRate >= 90
                            ? "default"
                            : attendanceRate >= 75
                              ? "secondary"
                              : "destructive"
                        }
                        className="mt-2"
                      >
                        {attendanceRate >= 90
                          ? "Excelente"
                          : attendanceRate >= 75
                            ? "Buena"
                            : "Regular"}
                      </Badge>
                    </div>
                    <BarChart3 className="h-12 w-12 text-green-600 opacity-50" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {totalAttendance}{" "}
                    {totalAttendance === 1 ? "registro" : "registros"}
                  </p>
                </CardContent>
              </Card>
            </div>

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
              <Tabs defaultValue="grades" className="space-y-4">
                <TabsList className="w-full">
                  <TabsTrigger value="grades" className="flex-1">
                    Calificaciones ({grades.length})
                  </TabsTrigger>
                  <TabsTrigger value="attendance" className="flex-1">
                    Asistencia ({attendance.length})
                  </TabsTrigger>
                  <TabsTrigger value="exams" className="flex-1">
                    Exámenes ({exams.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="grades" className="space-y-4">
                  {grades.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No hay calificaciones registradas
                      </CardContent>
                    </Card>
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
                      {grades.map((grade, index) => (
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

                <TabsContent value="exams" className="space-y-4">
                  {exams.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No hay exámenes registrados
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {exams.map((exam, index) => (
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
