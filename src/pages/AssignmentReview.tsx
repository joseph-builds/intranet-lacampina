import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  FileText,
  Calendar,
  Download,
  ArrowLeft,
  User,
  CheckCircle,
  Edit,
  Trash2,
  X,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { EditAssignmentDialog } from '@/components/assignments/EditAssignmentDialog';
import { FileUpload } from '@/components/ui/file-upload';
import PdfAnnotator from '@/components/assignments/PdfAnnotator';

const VALID_GRADES = ['AD', 'A', 'B', 'C'] as const;
type Grade = typeof VALID_GRADES[number];

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  course: {
    id: string;
    name: string;
    code: string;
  };
}

interface FileInfo {
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

interface Submission {
  id: string;
  student_id: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  student_files: any;
  score: string | null;
  feedback: string | null;
  feedback_files: any;
  submitted_at: string;
  graded_at: string | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

type PreviewFile = {
  filePath: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

const AssignmentReview = () => {
  const { assignmentId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  const [score, setScore] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [grading, setGrading] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [feedbackFiles, setFeedbackFiles] = useState<File[]>([]);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  useEffect(() => {
    if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
      navigate('/assignments');
      return;
    }
    fetchAssignmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, profile]);

  const fetchAssignmentData = async () => {
    if (!assignmentId) return;

    try {
      setLoading(true);

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          *,
          course:courses (id, name, code)
        `)
        .eq('id', assignmentId)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);

      const { data: submissionsData, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select(`
          id, student_id, content, file_path, file_name, file_size, mime_type,
          student_files, score, feedback, feedback_files, submitted_at, graded_at,
          student:profiles!assignment_submissions_student_id_fkey (id, first_name, last_name, email)
        `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData || []);
    } catch (error) {
      console.error('Error fetching assignment data:', error);
      toast.error('Error al cargar la información de la tarea');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    
    let initialScore = '';
    if (submission.feedback_files && Array.isArray(submission.feedback_files)) {
      const meta = submission.feedback_files.find((f: any) => f.is_metadata);
      if (meta && meta.numeric_score !== undefined) {
        initialScore = String(meta.numeric_score);
      }
    }
    
    if (!initialScore && submission.score) {
      initialScore = submission.score;
      if (initialScore === 'AD') initialScore = '18';
      else if (initialScore === 'A') initialScore = '15';
      else if (initialScore === 'B') initialScore = '12';
      else if (initialScore === 'C') initialScore = '08';
    }
    
    setScore(initialScore);
    setFeedback(submission.feedback || '');
    setFeedbackFiles([]);
  };

  const formatKB = (bytes?: number | null) => {
    if (bytes === undefined || bytes === null || Number.isNaN(Number(bytes)) || Number(bytes) <= 0) {
      return 'Tamaño no disponible';
    }
    const numBytes = Number(bytes);
    const kb = numBytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const getStorageRelativePath = (pathOrUrl: string): string => {
    if (!pathOrUrl) return '';
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      const bucketMarker = '/student-submissions/';
      const idx = pathOrUrl.indexOf(bucketMarker);
      if (idx !== -1) {
        return decodeURIComponent(pathOrUrl.substring(idx + bucketMarker.length));
      }
    }
    return pathOrUrl;
  };

  const getSubmissionFiles = (sub: Submission | null) => {
    if (!sub) return [];
    const files: Array<{
      file_path: string;
      file_name: string;
      file_size: number;
      mime_type: string;
      file_url?: string;
    }> = [];

    if (sub.student_files && Array.isArray(sub.student_files) && sub.student_files.length > 0) {
      sub.student_files.forEach((f: any) => {
        if (!f) return;
        const path = f.file_path || f.filePath || f.path || f.fileUrl || f.file_url;
        const name = f.file_name || f.fileName || f.name || (path ? String(path).split('/').pop() : 'Archivo');
        const size = Number(f.file_size ?? f.fileSize ?? f.size ?? 0);
        const mime = f.mime_type || f.mimeType || f.type || '';
        const url = f.file_url || f.fileUrl || '';

        if (path) {
          files.push({
            file_path: String(path),
            file_name: String(name),
            file_size: size,
            mime_type: String(mime),
            file_url: String(url)
          });
        }
      });
    }

    if (files.length === 0 && sub.file_path) {
      files.push({
        file_path: sub.file_path,
        file_name: sub.file_name || sub.file_path.split('/').pop() || 'Archivo',
        file_size: Number(sub.file_size ?? 0),
        mime_type: sub.mime_type || '',
      });
    }

    return files;
  };

  const canPreview = (mimeType?: string | null, fileName?: string | null) => {
    const mt = (mimeType || '').toLowerCase();
    const fn = (fileName || '').toLowerCase();

    if (mt.startsWith('image/')) return true;
    if (mt.includes('pdf')) return true;
    if (fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.webp') || fn.endsWith('.gif')) return true;
    if (fn.endsWith('.pdf')) return true;

    return false;
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      if (!filePath) {
        toast.error("Error: No se encontró la ruta del archivo");
        return;
      }

      const cleanPath = getStorageRelativePath(filePath);

      const { data, error } = await supabase.storage
        .from('student-submissions')
        .createSignedUrl(cleanPath, 60);

      if (error) {
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
          window.open(filePath, '_blank');
          toast.success('Descarga iniciada');
          return;
        }
        throw error;
      }

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = fileName || 'archivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Descarga iniciada');
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast.error('No se pudo descargar: ' + (error.message || 'Error al obtener URL del archivo'));
    }
  };

  const handlePreviewFile = async (file: PreviewFile) => {
    try {
      setPreviewLoading(true);
      setPreviewFile(file);
      setPreviewUrl('');
      setPreviewOpen(true);

      const cleanPath = getStorageRelativePath(file.filePath);
      const { data, error } = await supabase.storage
        .from('student-submissions')
        .createSignedUrl(cleanPath, 3600);

      if (error) {
        if (file.filePath.startsWith('http://') || file.filePath.startsWith('https://')) {
          setPreviewUrl(file.filePath);
          return;
        }
        throw error;
      }
      setPreviewUrl(data.signedUrl);
    } catch (error: any) {
      console.error('Error previewing file:', error);
      toast.error('No se pudo abrir la vista previa');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGradeSubmission = async () => {
    if (!selectedSubmission) return;

    if (!score) {
      toast.error('Debes ingresar una calificación');
      return;
    }

    const numericScore = Number(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 20) {
      toast.error('La calificación debe ser un número entre 0 y 20');
      return;
    }

    let letterGrade = 'C';
    if (numericScore >= 18) letterGrade = 'AD';
    else if (numericScore >= 14) letterGrade = 'A';
    else if (numericScore >= 11) letterGrade = 'B';

    const maxSize = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = feedbackFiles.filter((file) => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      toast.error('Algunos archivos superan los 5MB.');
      return;
    }

    try {
      setGrading(true);
      let feedbackFilesData: any[] = [];

      if (selectedSubmission.feedback_files && Array.isArray(selectedSubmission.feedback_files)) {
        feedbackFilesData = selectedSubmission.feedback_files.filter((f: any) => !f.is_metadata);
      }

      feedbackFilesData.push({
        is_metadata: true,
        numeric_score: numericScore
      });

      if (feedbackFiles.length > 0) {
        for (const file of feedbackFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
          const filePath = `feedback/${selectedSubmission.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage.from('student-submissions').upload(filePath, file);

          if (uploadError) throw new Error(`Error al subir el archivo ${file.name}`);

          feedbackFilesData.push({
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type
          });
        }
      }

      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          score: letterGrade,
          feedback: feedback.trim() || null,
          feedback_files: feedbackFilesData as any,
          graded_at: new Date().toISOString()
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      toast.success('Calificación guardada exitosamente');
      fetchAssignmentData();
      setSelectedSubmission(null);
      setScore('');
      setFeedback('');
      setFeedbackFiles([]);
    } catch (error) {
      console.error('Error grading submission:', error);
      toast.error('Error al guardar la calificación');
    } finally {
      setGrading(false);
    }
  };

  const handleDelete = async () => {
    if (!assignmentId) return;
    try {
      setDeleting(true);
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
      if (error) throw error;
      toast.success('Tarea eliminada exitosamente');
      navigate('/assignments');
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Error al eliminar la tarea');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const removeFeedbackFile = (index: number) => {
    setFeedbackFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-24 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tarea no encontrada</h3>
              <Button onClick={() => navigate('/assignments')}>Volver a Tareas</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const gradedCount = submissions.filter((s) => s.score !== null).length;
  const pendingCount = submissions.length - gradedCount;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/assignments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{assignment.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{assignment.course.code}</Badge>
              <span className="text-sm text-muted-foreground">{assignment.course.name}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Assignment Info */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de entrega</p>
                  <p className="text-sm font-medium">
                    {format(new Date(assignment.due_date), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Entregas</p>
                  <p className="text-sm font-medium">{submissions.length} estudiantes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="text-sm font-medium">
                    {gradedCount} calificadas, {pendingCount} pendientes
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader>
                <CardTitle>Entregas de Estudiantes</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {submissions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay entregas aún</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {submissions.map((submission) => (
                      <button
                        key={submission.id}
                        onClick={() => handleSelectSubmission(submission)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          selectedSubmission?.id === submission.id
                            ? 'border-primary bg-accent'
                            : 'border-border hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {submission.student.first_name[0]}
                              {submission.student.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {submission.student.first_name} {submission.student.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(submission.submitted_at), 'd MMM, HH:mm', { locale: es })}
                            </p>
                            {submission.score !== null ? (
                              <Badge variant="default" className="text-xs mt-1">
                                {submission.score}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs mt-1">
                                Sin calificar
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Submission Detail & Grading */}
          <div className="lg:col-span-2">
            {selectedSubmission ? (
              <Card className="bg-gradient-card shadow-card border-0">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        {selectedSubmission.student.first_name} {selectedSubmission.student.last_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{selectedSubmission.student.email}</p>
                    </div>
                    <Badge variant={selectedSubmission.score !== null ? 'default' : 'secondary'}>
                      {selectedSubmission.score !== null ? 'Calificada' : 'Pendiente'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Submission Content */}
                  <div>
                    <Label className="text-base font-semibold">Contenido de la entrega</Label>
                    <div className="mt-2 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {selectedSubmission.content || 'Sin contenido de texto'}
                      </p>
                    </div>
                  </div>

                  {/* File Attachments */}
                  {(() => {
                    const files = getSubmissionFiles(selectedSubmission);
                    if (files.length === 0) return null;

                    return (
                      <div>
                        <Label className="text-base font-semibold">Archivos adjuntos del estudiante</Label>
                        <div className="mt-2 space-y-2">
                          {files.map((file, index) => {
                            const filePath = file.file_path;
                            const fileName = file.file_name;
                            const fileSize = file.file_size;
                            const mimeType = file.mime_type;

                            return (
                              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{fileName}</p>
                                  <p className="text-xs text-muted-foreground">{formatKB(fileSize)}</p>
                                </div>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (canPreview(mimeType, fileName) && (mimeType?.toLowerCase().includes('pdf') || fileName?.toLowerCase().endsWith('.pdf'))) {
                                      navigate(`/grading/${selectedSubmission.id}`);
                                    } else if (canPreview(mimeType, fileName)) {
                                      handlePreviewFile({ filePath, fileName, mimeType, fileSize });
                                    } else {
                                      toast.message('Este tipo de archivo no se puede previsualizar. Usa Descargar.');
                                    }
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  {(mimeType?.includes('pdf') || fileName?.endsWith('.pdf')) ? "Calificar" : "Ver"}
                                </Button>

                                <Button variant="outline" size="sm" onClick={() => handleDownloadFile(filePath, fileName)}>
                                  <Download className="w-4 h-4 mr-1" />
                                  Descargar
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Grading Section */}
                  <div className="space-y-4 border-t pt-6">
                    <Label className="text-base font-semibold">Calificación</Label>

                    <div>
                      <Label htmlFor="score">Calificación (0 - 20)</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Input
                          id="score"
                          type="number"
                          min={0}
                          max={20}
                          placeholder="Ingresa la nota"
                          value={score}
                          onChange={(e) => setScore(e.target.value)}
                          className="w-32"
                        />
                        {score && !isNaN(Number(score)) && (
                          <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border">
                            Equivale a: {(() => {
                              const num = Number(score);
                              if (num >= 18) return "AD (Destacado)";
                              if (num >= 14) return "A (Esperado)";
                              if (num >= 11) return "B (Proceso)";
                              return "C (Inicio)";
                            })()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="feedback">Retroalimentación</Label>
                      <Textarea
                        id="feedback"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Escribe comentarios para el estudiante..."
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    {/* File Upload for Feedback */}
                    <div>
                      <Label>Archivos adjuntos (opcional)</Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Máximo 5MB por archivo.
                      </p>

                      <div className="mt-2 space-y-2">
                        {/* Mostrar archivos existentes guardados */}
                        {selectedSubmission.feedback_files && selectedSubmission.feedback_files.filter((file: any) => !file.is_metadata).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Archivos ya guardados:</p>
                            {selectedSubmission.feedback_files
                              .filter((file: any) => !file.is_metadata)
                              .map((file: any, index: number) => {
                              
                              // 🔥 CORRECCIÓN: Aquí también buscamos todas las propiedades
                              const filePath = file.file_path || file.filePath || file.path;
                              const fileName = file.file_name || file.fileName;
                              const fileSize = file.file_size || file.fileSize;

                              return (
                                <div key={`existing-${index}`} className="flex items-center gap-2 p-2 border rounded-lg bg-green-50 dark:bg-green-950/20">
                                  <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{fileName}</p>
                                    {fileSize && <p className="text-xs text-muted-foreground">{formatKB(fileSize)}</p>}
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => handleDownloadFile(filePath, fileName)}>
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedSubmission.graded_at && (
                      <p className="text-xs text-muted-foreground">
                        Última calificación:{' '}
                        {format(new Date(selectedSubmission.graded_at), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
                      </p>
                    )}

                    <Button
                      onClick={handleGradeSubmission}
                      disabled={grading || !score}
                      className="w-full bg-gradient-primary shadow-glow"
                    >
                      {grading ? 'Guardando...' : 'Guardar Calificación'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-card shadow-card border-0">
                <CardContent className="p-12 text-center">
                  <User className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Selecciona una entrega</h3>
                  <p className="text-muted-foreground">Selecciona un estudiante de la lista para ver su entrega y calificarla</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE PREVISUALIZACIÓN */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span className="truncate">
                Vista previa: {previewFile?.fileName || 'Archivo'}
              </span>

              {previewFile?.filePath && previewFile?.fileName && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadFile(previewFile.filePath, previewFile.fileName)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="w-full">
            {previewLoading && (
              <div className="py-10 text-center text-muted-foreground">
                Cargando vista previa...
              </div>
            )}

            {!previewLoading && previewUrl && previewFile && (
              <div className="w-full">
                {canPreview(previewFile.mimeType || null, previewFile.fileName) &&
                ((previewFile.mimeType || '').toLowerCase().startsWith('image/') ||
                  previewFile.fileName.toLowerCase().match(/\.(png|jpg|jpeg|webp|gif)$/)) ? (
                  <div className="w-full flex justify-center">
                    <img
                      src={previewUrl}
                      alt={previewFile.fileName}
                      className="max-h-[70vh] w-auto rounded border"
                    />
                  </div>
                ) : null}

                {!canPreview(previewFile.mimeType || null, previewFile.fileName) ? (
                  <div className="py-10 text-center text-muted-foreground">
                    Este tipo de archivo no se puede previsualizar. Usa “Descargar”.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      {assignment && (
        <EditAssignmentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          assignment={assignment}
          onEditSuccess={() => {
            fetchAssignmentData();
            setEditDialogOpen(false);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la tarea y todas las entregas de los estudiantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AssignmentReview;
