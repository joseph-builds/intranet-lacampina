import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileText,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  Trash2,
  Edit,
  AlertTriangle,
  Loader2,
  Filter,
  User,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Temario, TemarioEstado } from '@/types/temario';

export default function AdminTemariosManagement() {
  const { profile } = useAuth();
  const [temarios, setTemarios] = useState<Temario[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');

  // Filter options lists
  const [coursesList, setCoursesList] = useState<{ id: string; name: string }[]>([]);
  const [teachersList, setTeachersList] = useState<{ id: string; name: string }[]>([]);

  // Selected Temario for detail review modal
  const [selectedTemario, setSelectedTemario] = useState<Temario | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Delete dialog
  const [temarioToDelete, setTemarioToDelete] = useState<Temario | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit feedback state
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);

  useEffect(() => {
    fetchTemarios();
  }, []);

  const fetchTemarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('temarios')
        .select(`
          *,
          course:courses (
            id,
            name,
            code,
            classroom:virtual_classrooms!courses_classroom_id_fkey (
              name,
              grade,
              education_level
            )
          ),
          profesor:profiles!temarios_profesor_id_fkey (
            id,
            first_name,
            last_name,
            email
          ),
          revisor:profiles!temarios_revisado_por_fkey (
            id,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []) as Temario[];
      setTemarios(formattedData);

      // Extract lists for filter selects
      const coursesMap = new Map<string, string>();
      const teachersMap = new Map<string, string>();

      formattedData.forEach((t) => {
        if (t.course) coursesMap.set(t.course.id, t.course.name);
        if (t.profesor) teachersMap.set(t.profesor.id, `${t.profesor.first_name} ${t.profesor.last_name}`);
      });

      setCoursesList(Array.from(coursesMap.entries()).map(([id, name]) => ({ id, name })));
      setTeachersList(Array.from(teachersMap.entries()).map(([id, name]) => ({ id, name })));
    } catch (err: any) {
      console.error('Error fetching temarios:', err);
      toast.error('Error al cargar la lista de temarios');
    } finally {
      setLoading(false);
    }
  };

  // Automatically trigger status update to 'en_revision' when Admin views a 'pendiente' syllabus
  const handleOpenReview = async (temario: Temario) => {
    setSelectedTemario(temario);
    setFeedbackText(temario.retroalimentacion || '');
    setIsEditingFeedback(false);
    setReviewDialogOpen(true);

    if (temario.estado === 'pendiente') {
      try {
        const { error } = await supabase
          .from('temarios')
          .update({
            estado: 'en_revision',
            updated_at: new Date().toISOString(),
          })
          .eq('id', temario.id);

        if (!error) {
          // Update local state
          const updated = { ...temario, estado: 'en_revision' as TemarioEstado };
          setSelectedTemario(updated);
          setTemarios((prev) =>
            prev.map((t) => (t.id === temario.id ? updated : t))
          );
        }
      } catch (err) {
        console.error('Error updating status to en_revision:', err);
      }
    }
  };

  const handleApprove = async () => {
    if (!selectedTemario || !profile?.id) return;

    try {
      setSubmittingAction(true);
      const { error } = await supabase
        .from('temarios')
        .update({
          estado: 'aprobado',
          revisado_por: profile.id,
          revisado_en: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTemario.id);

      if (error) throw error;

      toast.success('Temario aprobado exitosamente');
      setReviewDialogOpen(false);
      await fetchTemarios();
    } catch (err: any) {
      console.error('Error approving temario:', err);
      toast.error('Error al aprobar el temario');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTemario || !profile?.id) return;

    const trimmedFeedback = feedbackText.trim();
    if (!trimmedFeedback) {
      toast.error('La retroalimentación es obligatoria para rechazar el temario');
      return;
    }

    try {
      setSubmittingAction(true);
      const { error } = await supabase
        .from('temarios')
        .update({
          estado: 'rechazado',
          retroalimentacion: trimmedFeedback,
          revisado_por: profile.id,
          revisado_en: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTemario.id);

      if (error) throw error;

      toast.success('Temario rechazado con la retroalimentación registrada');
      setReviewDialogOpen(false);
      await fetchTemarios();
    } catch (err: any) {
      console.error('Error rejecting temario:', err);
      toast.error('Error al rechazar el temario');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSaveEditedFeedback = async () => {
    if (!selectedTemario) return;
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      toast.error('La retroalimentación no puede quedar vacía');
      return;
    }

    try {
      setSubmittingAction(true);
      const { error } = await supabase
        .from('temarios')
        .update({
          retroalimentacion: trimmed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTemario.id);

      if (error) throw error;

      toast.success('Retroalimentación actualizada exitosamente');
      setIsEditingFeedback(false);
      setSelectedTemario({ ...selectedTemario, retroalimentacion: trimmed });
      await fetchTemarios();
    } catch (err: any) {
      console.error('Error updating feedback:', err);
      toast.error('Error al actualizar la retroalimentación');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDeleteTemario = async () => {
    if (!temarioToDelete) return;

    try {
      setSubmittingAction(true);

      // 1. Remove file from storage
      if (temarioToDelete.archivo_pdf) {
        await supabase.storage
          .from('temarios')
          .remove([temarioToDelete.archivo_pdf])
          .catch((e) => console.warn('Could not remove file from storage:', e));
      }

      // 2. Delete row from DB
      const { error } = await supabase
        .from('temarios')
        .delete()
        .eq('id', temarioToDelete.id);

      if (error) throw error;

      toast.success('Temario eliminado definitivamente');
      setShowDeleteConfirm(false);
      setTemarioToDelete(null);
      if (selectedTemario?.id === temarioToDelete.id) {
        setReviewDialogOpen(false);
      }
      await fetchTemarios();
    } catch (err: any) {
      console.error('Error deleting temario:', err);
      toast.error('Error al eliminar el temario');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleOpenPdf = async (archivoPdf: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('temarios')
        .createSignedUrl(archivoPdf, 3600);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      toast.error('Error al abrir la vista previa del PDF');
    }
  };

  const handleDownloadPdf = async (temario: Temario) => {
    try {
      const { data, error } = await supabase.storage
        .from('temarios')
        .createSignedUrl(temario.archivo_pdf, 60);

      if (error) throw error;

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = temario.nombre_original || 'Temario.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error('Error al descargar el archivo PDF');
    }
  };

  const getStatusBadge = (estado: TemarioEstado) => {
    switch (estado) {
      case 'aprobado':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            Aprobado
          </Badge>
        );
      case 'en_revision':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-1">
            <Clock className="w-3.5 h-3.5" />
            En revisión
          </Badge>
        );
      case 'rechazado':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3.5 h-3.5" />
            Rechazado
          </Badge>
        );
      case 'pendiente':
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3.5 h-3.5" />
            Pendiente
          </Badge>
        );
    }
  };

  // Filtered temarios list
  const filteredTemarios = temarios.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.course?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.course?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.profesor?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.profesor?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.nombre_original.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.estado === statusFilter;
    const matchesCourse = courseFilter === 'all' || t.curso_id === courseFilter;
    const matchesTeacher = teacherFilter === 'all' || t.profesor_id === teacherFilter;

    return matchesSearch && matchesStatus && matchesCourse && matchesTeacher;
  });

  const pendingCount = temarios.filter((t) => t.estado === 'pendiente' || t.estado === 'en_revision').length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-8 h-8 text-primary" />
            Gestión de Temarios de Cursos
          </h1>
          <p className="text-muted-foreground">
            Revisa, aprueba, rechaza o administra los sílabos/temarios académicos cargados por los profesores.
          </p>
        </div>

        {/* Highlighted Section for Pending Review */}
        {pendingCount > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5 shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Pendientes de Revisión ({pendingCount})
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-amber-500/30 text-amber-700 dark:text-amber-400"
                  onClick={() => setStatusFilter('pendiente')}
                >
                  Ver todos los pendientes
                </Button>
              </div>
              <CardDescription>
                Temarios recién subidos o en proceso de evaluación por parte de la administración.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {temarios
                  .filter((t) => t.estado === 'pendiente' || t.estado === 'en_revision')
                  .slice(0, 6)
                  .map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleOpenReview(t)}
                      className="p-3.5 rounded-xl border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm line-clamp-1">{t.course?.name || 'Curso'}</span>
                        {getStatusBadge(t.estado)}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        Prof: {t.profesor?.first_name} {t.profesor?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{t.nombre_original}</p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters Bar */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por curso, profesor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_revision">En revisión</SelectItem>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>

              {/* Course Filter */}
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los cursos</SelectItem>
                  {coursesList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Teacher Filter */}
              <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Profesor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los profesores</SelectItem>
                  {teachersList.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Main List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredTemarios.length === 0 ? (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-10 text-center space-y-3">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold">No se encontraron temarios</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || courseFilter !== 'all' || teacherFilter !== 'all'
                  ? 'Prueba ajustando los filtros de búsqueda.'
                  : 'Aún ningún profesor ha registrado un temario.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemarios.map((temario) => (
              <Card
                key={temario.id}
                className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-bold line-clamp-1">
                        {temario.course?.name || 'Curso'}
                      </CardTitle>
                      {temario.course?.classroom && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {temario.course.classroom.grade} {temario.course.classroom.name}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(temario.estado)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  <div className="text-sm space-y-1.5 border-t border-border/50 pt-3">
                    <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span className="font-medium text-foreground">Profesor:</span>{' '}
                      {temario.profesor ? `${temario.profesor.first_name} ${temario.profesor.last_name}` : 'Sin asignar'}
                    </div>

                    <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="truncate">{temario.nombre_original}</span>
                    </div>

                    <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{format(new Date(temario.created_at), "d 'de' MMM, yyyy HH:mm", { locale: es })}</span>
                    </div>
                  </div>

                  {temario.estado === 'rechazado' && temario.retroalimentacion && (
                    <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs line-clamp-2">
                      <span className="font-semibold">Motivo: </span>
                      {temario.retroalimentacion}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      className="flex-1 bg-gradient-primary shadow-glow text-xs"
                      onClick={() => handleOpenReview(temario)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Revisar
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setTemarioToDelete(temario);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Review & Feedback Modal */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4 gap-2 flex-wrap sm:flex-nowrap">
              <DialogTitle className="text-xl flex items-center gap-2 min-w-0">
                <BookOpen className="w-5 h-5 text-primary shrink-0" />
                <span className="truncate">Revisión de Temario</span>
              </DialogTitle>
              {selectedTemario && getStatusBadge(selectedTemario.estado)}
            </div>
            <DialogDescription className="truncate">
              {selectedTemario?.course?.name} — Profesor:{' '}
              {selectedTemario?.profesor?.first_name} {selectedTemario?.profesor?.last_name}
            </DialogDescription>
          </DialogHeader>

          {selectedTemario && (
            <div className="space-y-5 py-2">
              {/* File Info Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/40 rounded-xl border border-border gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-semibold truncate max-w-[200px] sm:max-w-[260px] md:max-w-[300px]"
                      title={selectedTemario.nombre_original}
                    >
                      {selectedTemario.nombre_original}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Subido el{' '}
                      {format(new Date(selectedTemario.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button variant="outline" size="sm" onClick={() => handleOpenPdf(selectedTemario.archivo_pdf)}>
                    <Eye className="w-4 h-4 mr-1.5" />
                    Abrir PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(selectedTemario)}>
                    <Download className="w-4 h-4 mr-1.5" />
                    Descargar
                  </Button>
                </div>
              </div>

              {/* Feedback Textarea Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="feedback" className="text-sm font-semibold">
                    Retroalimentación / Observaciones
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      (Obligatoria al rechazar)
                    </span>
                  </Label>
                  {selectedTemario.estado === 'rechazado' && !isEditingFeedback && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-primary"
                      onClick={() => setIsEditingFeedback(true)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Editar retroalimentación
                    </Button>
                  )}
                </div>

                <Textarea
                  id="feedback"
                  placeholder="Escribe el motivo del rechazo u observaciones sobre el temario..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={4}
                  disabled={selectedTemario.estado === 'aprobado'}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setTemarioToDelete(selectedTemario);
                    setShowDeleteConfirm(true);
                  }}
                  disabled={submittingAction}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Eliminar Temario
                </Button>

                <div className="flex items-center gap-2">
                  {isEditingFeedback ? (
                    <Button
                      size="sm"
                      onClick={handleSaveEditedFeedback}
                      disabled={submittingAction}
                      className="bg-primary"
                    >
                      {submittingAction && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                      Guardar Cambios
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleReject}
                        disabled={submittingAction}
                      >
                        {submittingAction && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                        <XCircle className="w-4 h-4 mr-1.5" />
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApprove}
                        disabled={submittingAction}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {submittingAction && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        Aprobar Temario
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Strong Delete Confirmation Modal */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              ¿Eliminar Temario de Forma Definitiva?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará físicamente el archivo PDF del servidor y borrará el registro de la base de datos sin posibilidad de recuperación. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTemarioToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemario}
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={submittingAction}
            >
              {submittingAction ? 'Eliminando...' : 'Sí, Eliminar Definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
