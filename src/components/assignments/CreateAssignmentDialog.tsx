import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileUpload } from '@/components/ui/file-upload';
import { CalendarIcon, Clock, Upload, X, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CreateAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface WeeklySection {
  id: string;
  week_number: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
}

interface UploadedFile {
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

export function CreateAssignmentDialog({ open, onOpenChange, onSuccess }: CreateAssignmentDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [weeks, setWeeks] = useState<WeeklySection[]>([]);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  const [formData, setFormData] = useState({
    course_id: '',
    week_id: '',
    title: '',
    description: '',
    due_date: null as Date | null,
    max_score: 100,
    is_published: false
  });

  useEffect(() => {
    if (open && profile) {
      fetchTeacherCourses();
    }
  }, [open, profile]);

  useEffect(() => {
    if (formData.course_id) {
      fetchCourseWeeks(formData.course_id);
    } else {
      setWeeks([]);
      setFormData(prev => ({ ...prev, week_id: '' }));
    }
  }, [formData.course_id]);

  const fetchTeacherCourses = async () => {
    if (!profile?.id) return;

    try {
      setLoadingCourses(true);
      
      // Fetch courses where the user is the teacher
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, code')
        .eq('teacher_principal_id', profile.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setCourses(data || []);
      
      // Auto-select if only one course
      if (data && data.length === 1) {
        setFormData(prev => ({ ...prev, course_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Error al cargar los cursos');
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchCourseWeeks = async (courseId: string) => {
    try {
      setLoadingWeeks(true);
      
      const { data, error } = await supabase
        .from('course_weekly_sections')
        .select('id, week_number, title, start_date, end_date')
        .eq('course_id', courseId)
        .order('week_number');

      if (error) throw error;

      setWeeks(data || []);
      
      // Auto-select first week if available
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, week_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching weeks:', error);
      toast.error('Error al cargar las semanas del curso');
    } finally {
      setLoadingWeeks(false);
    }
  };

  const getSelectedWeek = (): WeeklySection | null => {
    return weeks.find(w => w.id === formData.week_id) || null;
  };

  const isDateWithinWeek = (date: Date | null): boolean => {
    if (!date) return true;
    
    const selectedWeek = getSelectedWeek();
    if (!selectedWeek) return true;
    
    if (selectedWeek.start_date && selectedWeek.end_date) {
      const weekStart = new Date(selectedWeek.start_date);
      const weekEnd = new Date(selectedWeek.end_date);
      weekEnd.setHours(23, 59, 59, 999); // Incluir todo el último día
      
      return date >= weekStart && date <= weekEnd;
    }
    
    return true;
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      const newFiles: UploadedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `assignments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('course-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        newFiles.push({
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream'
        });
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} archivo(s) subido(s) exitosamente`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error al subir archivos');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.course_id) {
      toast.error('Debes seleccionar un curso');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    if (!isDateWithinWeek(formData.due_date)) {
      const selectedWeek = getSelectedWeek();
      if (selectedWeek?.start_date && selectedWeek?.end_date) {
        toast.error(
          `La fecha límite debe estar entre ${format(new Date(selectedWeek.start_date), "d 'de' MMMM", { locale: es })} y ${format(new Date(selectedWeek.end_date), "d 'de' MMMM", { locale: es })}`
        );
      } else {
        toast.error('La fecha límite no está dentro del rango de la semana seleccionada');
      }
      return;
    }

    if (!formData.due_date) {
      toast.error('Debes seleccionar una fecha límite');
      return;
    }

    try {
      setLoading(true);

      // Create the assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .insert({
          course_id: formData.course_id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          due_date: formData.due_date.toISOString(),
          max_score: formData.max_score,
          is_published: formData.is_published
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      // Create a course_weekly_resource entry linked to the selected week
      if (assignmentData) {
        await supabase
          .from('course_weekly_resources')
          .insert({
            section_id: formData.week_id,
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            resource_type: 'assignment',
            assignment_id: assignmentData.id,
            assignment_deadline: formData.due_date.toISOString(),
            is_published: formData.is_published,
            position: 0,
            teacher_files: uploadedFiles
          });
      }

      toast.success('Tarea creada exitosamente');
      
      // Reset form
      setFormData({
        course_id: '',
        week_id: '',
        title: '',
        description: '',
        due_date: null,
        max_score: 100,
        is_published: false
      });
      setUploadedFiles([]);
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Error al crear la tarea');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nueva Tarea</DialogTitle>
          <DialogDescription>
            Completa los datos para crear una tarea para tus estudiantes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Course Selection */}
          <div className="space-y-2">
            <Label htmlFor="course_id" className="required">Curso</Label>
            {loadingCourses ? (
              <div className="h-10 bg-muted rounded animate-pulse" />
            ) : courses.length === 0 ? (
              <div className="p-4 bg-muted rounded text-sm text-muted-foreground">
                No tienes cursos asignados. Contacta al administrador.
              </div>
            ) : (
              <Select
                value={formData.course_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, course_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un curso" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} - {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Week Selection */}
          {formData.course_id && (
            <div className="space-y-2">
              <Label htmlFor="week_id" className="required">Semana del Curso</Label>
              {loadingWeeks ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : weeks.length === 0 ? (
                <div className="p-4 bg-muted rounded text-sm text-muted-foreground">
                  Este curso no tiene semanas configuradas. Contacta al administrador.
                </div>
              ) : (
                <>
                  <Select
                    value={formData.week_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, week_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una semana" />
                    </SelectTrigger>
                    <SelectContent>
                      {weeks.map((week) => (
                        <SelectItem key={week.id} value={week.id}>
                          Semana {week.week_number}: {week.title}
                          {week.start_date && week.end_date && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({format(new Date(week.start_date), "d MMM", { locale: es })} - {format(new Date(week.end_date), "d MMM", { locale: es })})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.week_id && getSelectedWeek()?.start_date && getSelectedWeek()?.end_date && (
                    <p className="text-xs text-muted-foreground">
                      📅 Esta semana va desde el <strong>{format(new Date(getSelectedWeek()!.start_date!), "d 'de' MMMM", { locale: es })}</strong> hasta el <strong>{format(new Date(getSelectedWeek()!.end_date!), "d 'de' MMMM", { locale: es })}</strong>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* </Select>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="required">Título de la Tarea</Label>
            <Input
              id="title"
              placeholder="Ej: Resolver ejercicios de matemáticas"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción e Instrucciones</Label>
            <Textarea
              id="description"
              placeholder="Describe la tarea y proporciona instrucciones claras para los estudiantes..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={5}
            />
          </div>

          {/* Due Date and Max Score */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="required">Fecha y Hora Límite</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {formData.week_id && getSelectedWeek()?.start_date && getSelectedWeek()?.end_date
                  ? `Debe estar entre el ${format(new Date(getSelectedWeek()!.start_date!), "d/MM", { locale: es })} y ${format(new Date(getSelectedWeek()!.end_date!), "d/MM/yyyy", { locale: es })}`
                  : 'Los estudiantes no podrán entregar después de esta fecha'
                }
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={`w-full justify-start text-left font-normal h-auto py-3 ${
                      !formData.due_date && 'text-muted-foreground'
                    } ${formData.due_date && !isDateWithinWeek(formData.due_date) && 'border-destructive'}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <div className="flex flex-col items-start">
                      {formData.due_date ? (
                        <>
                          <span className="font-semibold">
                            {format(formData.due_date, "EEEE, d 'de' MMMM", { locale: es })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(formData.due_date, "yyyy 'a las' HH:mm", { locale: es })}
                          </span>
                        </>
                      ) : (
                        <span>Selecciona fecha y hora</span>
                      )}
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b bg-muted/50">
                    <p className="text-sm font-medium">Selecciona la fecha límite</p>
                  </div>
                  <Calendar
                    mode="single"
                    selected={formData.due_date || undefined}
                    defaultMonth={formData.week_id && getSelectedWeek()?.start_date 
                      ? new Date(getSelectedWeek()!.start_date!) 
                      : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const newDate = formData.due_date ? new Date(formData.due_date) : new Date();
                        newDate.setFullYear(date.getFullYear());
                        newDate.setMonth(date.getMonth());
                        newDate.setDate(date.getDate());
                        if (!formData.due_date) {
                          newDate.setHours(23, 59, 0, 0);
                        }
                        setFormData(prev => ({ ...prev, due_date: newDate }));
                      }
                    }}
                    disabled={(date) => {
                      // Si hay una semana seleccionada, solo permitir fechas dentro del rango de la semana
                      const selectedWeek = getSelectedWeek();
                      if (selectedWeek?.start_date && selectedWeek?.end_date) {
                        const weekStart = new Date(selectedWeek.start_date);
                        weekStart.setHours(0, 0, 0, 0);
                        const weekEnd = new Date(selectedWeek.end_date);
                        weekEnd.setHours(23, 59, 59, 999);
                        
                        return date < weekStart || date > weekEnd;
                      }
                      
                      // Si no hay semana seleccionada, no permitir fechas pasadas
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                    initialFocus
                  />
                  <div className="p-3 border-t bg-muted/50">
                    <Label className="text-sm font-medium mb-2 block">Hora límite</Label>
                    <div className="flex gap-2 items-center">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <Input
                        type="time"
                        className="flex-1"
                        value={formData.due_date ? format(formData.due_date, 'HH:mm') : '23:59'}
                        onChange={(e) => {
                          if (e.target.value) {
                            const [hours, minutes] = e.target.value.split(':');
                            const newDate = formData.due_date ? new Date(formData.due_date) : new Date();
                            newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                            setFormData(prev => ({ ...prev, due_date: newDate }));
                          }
                        }}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_score">Puntuación Máxima</Label>
              <Input
                id="max_score"
                type="number"
                min="1"
                max="1000"
                value={formData.max_score}
                onChange={(e) => setFormData(prev => ({ ...prev, max_score: parseInt(e.target.value) || 100 }))}
              />
              <p className="text-xs text-muted-foreground">
                Esta puntuación es referencial. La calificación final será en escala literal (AD, A, B, C).
              </p>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Archivos de Apoyo (Opcional)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Sube documentos, PDFs, imágenes u otros archivos que ayuden a los estudiantes
            </p>
            
            <FileUpload
              onFileSelect={handleFileUpload}
              disabled={uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar"
              multiple
            />

            {uploading && (
              <div className="text-sm text-muted-foreground">
                Subiendo archivos...
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="space-y-2 mt-3">
                <Label className="text-sm">Archivos Subidos:</Label>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate">{file.file_name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({formatFileSize(file.file_size)})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publish Toggle */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
              />
              <Label htmlFor="is_published" className="cursor-pointer">
                Publicar inmediatamente
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {formData.is_published 
                ? 'La tarea será visible para los estudiantes inmediatamente' 
                : 'La tarea quedará en borrador. Podrás publicarla más tarde'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || uploading || courses.length === 0 || !formData.week_id}
              className="bg-gradient-primary shadow-glow"
            >
              {loading ? 'Creando...' : 'Crear Tarea'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
