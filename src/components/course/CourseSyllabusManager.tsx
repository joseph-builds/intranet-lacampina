import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { FileText, Upload, RefreshCw, Eye, Download, AlertCircle, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Temario, TemarioEstado } from '@/types/temario';

interface CourseSyllabusManagerProps {
  courseId: string;
  teacherId?: string;
  canEdit: boolean;
}

export function CourseSyllabusManager({ courseId, teacherId, canEdit }: CourseSyllabusManagerProps) {
  const { profile } = useAuth();
  const [temario, setTemario] = useState<Temario | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showConfirmReupload, setShowConfirmReupload] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const reuploadInputRef = React.useRef<HTMLInputElement | null>(null);

  const effectiveTeacherId = teacherId || profile?.id;

  useEffect(() => {
    if (courseId) {
      fetchTemario();
    }
  }, [courseId, effectiveTeacherId]);

  const fetchTemario = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('temarios')
        .select('*')
        .eq('curso_id', courseId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching temario:', error);
      }

      setTemario(data as Temario | null);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (estado?: TemarioEstado) => {
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
            Pendiente de revisión
          </Badge>
        );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isReupload = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permite subir archivos en formato PDF');
      return;
    }

    if (file.size > 15 * 1024 * 1024) { // 15MB limit
      toast.error('El archivo PDF supera el tamaño máximo de 15MB');
      return;
    }

    if (isReupload) {
      setPendingFile(file);
      setShowConfirmReupload(true);
    } else {
      uploadSyllabus(file);
    }

    // Reset input
    e.target.value = '';
  };

  const uploadSyllabus = async (file: File) => {
    if (!profile?.id || !courseId) return;

    try {
      setUploading(true);
      const timestamp = Date.now();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${courseId}/${profile.id}_${timestamp}_${cleanFileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('temarios')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Delete previous file from storage if existing
      if (temario?.archivo_pdf) {
        await supabase.storage.from('temarios').remove([temario.archivo_pdf]).catch(() => {});
      }

      if (temario) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('temarios')
          .update({
            archivo_pdf: storagePath,
            nombre_original: file.name,
            estado: 'pendiente',
            retroalimentacion: null,
            revisado_por: null,
            revisado_en: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', temario.id);

        if (updateError) throw updateError;
        toast.success('Temario resubido exitosamente. En enviado a revisión.');
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('temarios')
          .insert({
            curso_id: courseId,
            profesor_id: profile.id,
            archivo_pdf: storagePath,
            nombre_original: file.name,
            estado: 'pendiente',
          });

        if (insertError) throw insertError;
        toast.success('Temario subido exitosamente');
      }

      await fetchTemario();
    } catch (err: any) {
      console.error('Error uploading temario:', err);
      toast.error('Error al subir el temario: ' + (err.message || 'Inténtalo de nuevo'));
    } finally {
      setUploading(false);
      setPendingFile(null);
      setShowConfirmReupload(false);
    }
  };

  const handleDownload = async () => {
    if (!temario?.archivo_pdf) return;
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
    } catch (err: any) {
      console.error('Error downloading temario:', err);
      toast.error('No se pudo descargar el temario');
    }
  };

  const handlePreview = async () => {
    if (!temario?.archivo_pdf) return;
    try {
      const { data, error } = await supabase.storage
        .from('temarios')
        .createSignedUrl(temario.archivo_pdf, 3600);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      console.error('Error opening temario preview:', err);
      toast.error('No se pudo previsualizar el temario');
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card shadow-card border-0 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Cargando temario...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Temario del Curso (Sílabo)
            </CardTitle>
            <CardDescription className="mt-1">
              Sube el plan de estudios en formato PDF (unidades y semanas) para la revisión de administración.
            </CardDescription>
          </div>
          {temario && getStatusBadge(temario.estado)}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!temario ? (
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-4 bg-muted/20">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground opacity-60" />
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-foreground">Aún no has subido el temario</h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Selecciona un archivo PDF con la programación académica de este curso.
              </p>
            </div>

            {canEdit && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, false)}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-gradient-primary shadow-glow"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Subir Temario (PDF)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* File Info Box */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/40 rounded-xl border border-border gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-3 rounded-lg bg-primary/10 text-primary shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold truncate max-w-[200px] sm:max-w-[280px] md:max-w-[340px]"
                    title={temario.nombre_original}
                  >
                    {temario.nombre_original}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Subido el {format(new Date(temario.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button variant="outline" size="sm" onClick={handlePreview}>
                  <Eye className="w-4 h-4 mr-1.5" />
                  Ver PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1.5" />
                  Descargar
                </Button>
              </div>
            </div>

            {/* Feedback alert if rejected */}
            {temario.estado === 'rechazado' && temario.retroalimentacion && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Retroalimentación de Administración (Motivo de rechazo):
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap pl-6">
                  {temario.retroalimentacion}
                </p>
              </div>
            )}

            {/* Reupload Option for Teacher */}
            {canEdit && (
              <div className="pt-2 border-t flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {temario.estado === 'aprobado'
                    ? 'El temario ya fue aprobado por administración. Si deseas actualizarlo, puedes resubirlo.'
                    : 'Puedes reemplazar este archivo por una versión actualizada.'}
                </p>
                <div>
                  <input
                    type="file"
                    ref={reuploadInputRef}
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, true)}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={uploading}
                    onClick={() => reuploadInputRef.current?.click()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resubir Temario
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog for Reupload */}
      <AlertDialog open={showConfirmReupload} onOpenChange={setShowConfirmReupload}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              ¿Sobrescribir Temario Actual?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el archivo PDF anterior de forma permanente y enviará la nueva versión a revisión por administración. La retroalimentación previa será reseteada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingFile) uploadSyllabus(pendingFile);
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Confirmar y Sobrescribir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
