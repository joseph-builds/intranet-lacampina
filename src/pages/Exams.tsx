import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Calendar,
  Clock,
  Plus,
  AlertCircle,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isAfter, isBefore, addMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useExamMonitor } from "@/hooks/useExamMonitor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Exam {
  id: string;
  title: string;
  description: string;
  start_time: string;
  duration_minutes: number;
  max_score: number;
  modulo_id: string;
  source: "exam" | "weekly_resource";
  course: {
    id: string;
    name: string;
    code: string;
  };
  submission?: {
    score: string; // Ahora es texto (AD, A, B, C)
    answers: any;
    submitted_at: string;
  } | null;
}

const Exams = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<string | null>(null);
  const [showClosedDialog, setShowClosedDialog] = useState(false);

  const { abandonCount, maxAbandonAttempts } = useExamMonitor({
    examId: activeExam || "",
    isActive: !!activeExam,
    onExamClosed: () => {
      setShowClosedDialog(true);
      setActiveExam(null);
    },
    userId: profile?.id || "",
  });

  const checkExamSubmission = async (
    examId: string,
    quizTitle: string,
    courseId: string,
  ) => {
    if (!profile?.id) return null;

    // Find quiz by exam title
    const { data: quizData } = await supabase
      .from("quizzes")
      .select("id")
      .eq("modulo_id", courseId)
      .eq("title", quizTitle)
      .maybeSingle();

    if (!quizData) return null;

    // Check if already submitted
    const { data: submission } = await supabase
      .from("quiz_submissions")
      .select("score, answers, submitted_at")
      .eq("quiz_id", quizData.id)
      .eq("student_id", profile.id)
      .maybeSingle();

    return submission;
  };

  useEffect(() => {
    fetchExams();
  }, [profile]);

  const fetchExams = async () => {
    if (!profile) return;

    try {
      // Fetch from exams table
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select(
          `
          *,
          course:courses (
            id,
            name,
            code
          )
        `,
        )
        .eq("is_published", true)
        .order("start_time", { ascending: true });

      if (examsError) throw examsError;

      // Fetch from weekly resources (exam type)
      const { data: weeklyExams, error: weeklyError } = await supabase
        .from("course_weekly_resources")
        .select(
          `
          *,
          section:course_weekly_sections!inner (
            course:courses (
              id,
              name,
              code
            )
          )
        `,
        )
        .eq("resource_type", "exam")
        .eq("is_published", true)
        .order("assignment_deadline", { ascending: true });

      if (weeklyError) throw weeklyError;

      // Combine both sources and check submissions for students
      const combinedExams: Exam[] = await Promise.all([
        ...(examsData || []).map(async (exam) => {
          const submission =
            profile?.role === "student"
              ? await checkExamSubmission(exam.id, exam.title, exam.modulo_id)
              : null;

          return {
            id: exam.id,
            title: exam.title,
            description: exam.description || "",
            start_time: exam.start_time,
            duration_minutes: exam.duration_minutes,
            max_score: exam.max_score,
            modulo_id: exam.modulo_id,
            source: "exam" as const,
            course: exam.course,
            submission,
          };
        }),
        ...(weeklyExams || []).map(async (resource) => {
          const submission =
            profile?.role === "student"
              ? await checkExamSubmission(
                  resource.id,
                  resource.title,
                  resource.section.course.id,
                )
              : null;

          return {
            id: resource.id,
            title: resource.title,
            description: resource.description || "",
            start_time:
              resource.assignment_deadline || new Date().toISOString(),
            duration_minutes: 60, // Default duration
            max_score: resource.max_score || 100,
            modulo_id: resource.section.course.id,
            source: "weekly_resource" as const,
            course: resource.section.course,
            submission,
          };
        }),
      ]);

      const sortedExams = combinedExams.sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );

      setExams(sortedExams);
    } catch (error) {
      console.error("Error fetching exams:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los exámenes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getExamStatus = (exam: Exam) => {
    const now = new Date();
    const startTime = new Date(exam.start_time);
    const endTime = addMinutes(startTime, exam.duration_minutes);

    if (isAfter(now, endTime)) {
      return {
        status: "completed",
        label: "Finalizado",
        variant: "secondary" as const,
        color: "text-muted-foreground",
      };
    }

    if (isBefore(now, startTime)) {
      return {
        status: "upcoming",
        label: "Próximo",
        variant: "default" as const,
        color: "text-primary",
      };
    }

    return {
      status: "in-progress",
      label: "En progreso",
      variant: "destructive" as const,
      color: "text-destructive",
    };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground">Exámenes</h1>
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="bg-gradient-card shadow-card border-0">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Exámenes</h1>
          {profile?.role === "teacher" && (
            <Button className="bg-gradient-primary shadow-glow">
              <Plus className="w-4 h-4 mr-2" />
              Crear Examen
            </Button>
          )}
        </div>

        {exams.length === 0 ? (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-8 text-center">
              <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay exámenes disponibles
              </h3>
              <p className="text-muted-foreground">
                {profile?.role === "student"
                  ? "No tienes exámenes programados en este momento."
                  : "Aún no has creado ningún examen para tus cursos."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {exams.map((exam) => {
              const status = getExamStatus(exam);

              return (
                <Card
                  key={`${exam.source}-${exam.id}`}
                  className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all duration-300"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg font-semibold text-foreground">
                            {exam.title}
                          </CardTitle>
                          <Badge variant={status.variant} className="text-xs">
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {exam.course.code}
                          </Badge>
                          <span>{exam.course.name}</span>
                        </div>
                      </div>
                      <ClipboardList className="w-6 h-6 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {exam.description || "Sin descripción disponible"}
                    </p>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(
                              new Date(exam.start_time),
                              "d 'de' MMMM, yyyy",
                              { locale: es },
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            {format(new Date(exam.start_time), "HH:mm")} (
                            {exam.duration_minutes} min)
                          </span>
                        </div>
                      </div>

                      <div className="text-sm font-medium text-foreground">
                        {exam.max_score} pts
                      </div>
                    </div>

                    {status.status === "in-progress" && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive font-medium">
                          ¡El examen está en progreso!
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button className="flex-1" variant="outline" asChild>
                        <Link to={`/courses/${exam.modulo_id}`}>Ver Curso</Link>
                      </Button>

                      {profile?.role === "student" && (
                        <>
                          {exam.submission ? (
                            <div className="flex-1 space-y-2">
                              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                                <CheckCircle className="w-5 h-5 text-primary mx-auto mb-1" />
                                <p className="text-sm font-medium text-primary">
                                  Completado - Nota: {exam.submission.score}
                                </p>
                              </div>
                              {(() => {
                                const answers = exam.submission.answers || {};
                                const hasUngradedQuestions = Object.values(
                                  answers,
                                ).some(
                                  (answer: any) =>
                                    answer.requires_grading === true &&
                                    answer.points_earned === undefined,
                                );

                                return hasUngradedQuestions ? (
                                  <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center gap-2">
                                    <Clock className="w-4 h-4 text-accent" />
                                    <span className="text-xs font-medium text-accent">
                                      Pendiente de revisión
                                    </span>
                                  </div>
                                ) : (
                                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-medium text-primary">
                                      Revisado por el profesor
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            status.status === "in-progress" && (
                              <Button
                                className="bg-gradient-primary shadow-glow flex-1"
                                asChild
                              >
                                <Link to={`/exams/${exam.id}/take`}>
                                  Iniciar Examen
                                </Link>
                              </Button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={showClosedDialog} onOpenChange={setShowClosedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Examen Cerrado
            </AlertDialogTitle>
            <AlertDialogDescription>
              El examen se ha cerrado automáticamente porque saliste de la
              página demasiadas veces. Esto ha sido registrado en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowClosedDialog(false)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Exams;
