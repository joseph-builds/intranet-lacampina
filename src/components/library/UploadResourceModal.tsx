import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { uploadLibraryResource, LibraryResource } from '@/services/libraryService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UploadResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (resource: LibraryResource) => void;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export function UploadResourceModal({ isOpen, onClose, onSuccess }: UploadResourceModalProps) {
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    resource_type: 'document',
    education_level: 'none',
    grade: 'none',
    classroom_id: 'none',
    subject: '',
    file_url: ''
  });

  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [curriculumSubjects, setCurriculumSubjects] = useState<string[]>([]);
  const [isOtherSubject, setIsOtherSubject] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchClassrooms();
      resetForm();
    }
  }, [isOpen]);

  // If level changes, reset grade and subject
  useEffect(() => {
    if (formData.education_level !== 'none') {
      setFormData(prev => ({ ...prev, grade: 'none', subject: '', classroom_id: 'none' }));
    }
  }, [formData.education_level]);

  // If grade changes, fetch curriculum subjects and reset subject
  useEffect(() => {
    if (formData.grade !== 'none') {
      setFormData(prev => ({ ...prev, subject: '', classroom_id: 'none' }));
      setIsOtherSubject(false);
      fetchCurriculumSubjects(formData.education_level, formData.grade);
    } else {
      setCurriculumSubjects([]);
    }
  }, [formData.grade, formData.education_level]);

  const fetchClassrooms = async () => {
    try {
      const { data } = await supabase
        .from('virtual_classrooms')
        .select('id, name, grade, education_level')
        .eq('is_active', true)
        .order('name');
      setClassrooms(data || []);
    } catch (err) {
      console.error('Error fetching classrooms', err);
    }
  };

  const fetchCurriculumSubjects = async (levelName: string, gradeName: string) => {
    try {
      // Find the level
      const { data: levelData } = await supabase.from('academic_levels').select('id').eq('name', levelName).single();
      if (!levelData) return;

      // Find the grade
      const { data: gradeData } = await supabase.from('academic_grades').select('id').eq('name', gradeName).eq('level_id', levelData.id).single();
      if (!gradeData) return;

      // Fetch base_courses
      const { data: coursesData } = await supabase.from('base_courses').select('name').eq('grade_id', gradeData.id).order('name');
      if (coursesData) {
        // Unique subject names
        const names = Array.from(new Set(coursesData.map(c => c.name)));
        setCurriculumSubjects(names);
      }
    } catch (err) {
      console.error('Error fetching curriculum subjects', err);
    }
  };

  const resetForm = () => {
    setUploadMode('file');
    setFile(null);
    setFormData({
      title: '',
      description: '',
      resource_type: 'document',
      education_level: 'none',
      grade: 'none',
      classroom_id: 'none',
      subject: '',
      file_url: ''
    });
    setError(null);
    setIsOtherSubject(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError('El archivo excede el límite máximo de 15 MB. Por favor, pega un enlace externo en lugar de subirlo directamente.');
        setFile(null);
        e.target.value = '';
      } else {
        setFile(selectedFile);
        setError(null);
        
        // Auto-detect type
        if (selectedFile.type.includes('pdf')) setFormData(prev => ({ ...prev, resource_type: 'pdf' }));
        else if (selectedFile.type.includes('image')) setFormData(prev => ({ ...prev, resource_type: 'image' }));
        else if (selectedFile.type.includes('video')) setFormData(prev => ({ ...prev, resource_type: 'video' }));
        else setFormData(prev => ({ ...prev, resource_type: 'document' }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!profile) return;
    
    if (uploadMode === 'file' && !file) {
      setError('Por favor selecciona un archivo para subir.');
      return;
    }

    if (uploadMode === 'link' && !formData.file_url) {
      setError('Por favor ingresa el enlace del recurso.');
      return;
    }

    if (formData.education_level === 'none') {
      setError('El Nivel es obligatorio.');
      return;
    }

    if (formData.grade === 'none') {
      setError('El Grado es obligatorio.');
      return;
    }

    if (isTeacher && !formData.subject.trim()) {
      setError('La Materia es obligatoria para los profesores.');
      return;
    }

    if (uploadMode === 'link') {
      formData.resource_type = 'link';
    }

    setLoading(true);

    try {
      const resourceData: Partial<LibraryResource> = {
        title: formData.title,
        description: formData.description,
        resource_type: formData.resource_type as any,
        education_level: formData.education_level as any,
        grade: formData.grade,
        classroom_id: formData.classroom_id === 'none' ? null : formData.classroom_id,
        subject: formData.subject.trim() || null,
        file_url: formData.file_url,
        uploaded_by: profile.id
      };

      const result = await uploadLibraryResource(resourceData, uploadMode === 'file' ? (file as File) : undefined);
      
      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al guardar el recurso');
    } finally {
      setLoading(false);
    }
  };

  // --- Dynamic Options Logic (Simplified) ---
  const availableNiveles = ['Inicial', 'Primaria', 'Secundaria'];

  const getGradosByNivel = (nivel: string) => {
    if (nivel === 'Inicial') return ['3 años', '4 años', '5 años'];
    if (nivel === 'Primaria') return ['1ro', '2do', '3ro', '4to', '5to', '6to'];
    if (nivel === 'Secundaria') return ['1ro', '2do', '3ro', '4to', '5to'];
    return [];
  };

  const availableGrados = formData.education_level !== 'none' ? getGradosByNivel(formData.education_level) : [];

  // Filter classrooms based on selected level and grade
  const filteredClassrooms = classrooms.filter(c => {
    if (formData.education_level !== 'none' && c.education_level !== formData.education_level) return false;
    if (formData.grade !== 'none' && c.grade !== formData.grade) return false;
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subir Recurso a la Biblioteca</DialogTitle>
          <DialogDescription>
            Agrega materiales de estudio para que los alumnos puedan acceder a ellos.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form id="upload-form" onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-4">
            {/* Modo de subida */}
            <div className="p-4 border rounded-lg bg-slate-50">
              <Label className="text-base font-semibold mb-3 block">Modo de subida</Label>
              <RadioGroup 
                value={uploadMode} 
                onValueChange={(v: 'file' | 'link') => setUploadMode(v)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="file" id="r1" />
                  <Label htmlFor="r1">Subir Archivo (Máx 15MB)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="link" id="r2" />
                  <Label htmlFor="r2">Pegar Enlace (Drive/YouTube)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Archivo o Enlace */}
            {uploadMode === 'file' ? (
              <div className="space-y-2">
                <Label htmlFor="file">Seleccionar Archivo <span className="text-red-500">*</span></Label>
                <Input 
                  id="file" 
                  type="file" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.mp4"
                />
                <p className="text-xs text-gray-500">Documentos, imágenes o videos muy cortos hasta 15MB.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="link">URL del Enlace <span className="text-red-500">*</span></Label>
                <Input 
                  id="link" 
                  type="url" 
                  placeholder="https://drive.google.com/..." 
                  value={formData.file_url}
                  onChange={(e) => setFormData({...formData, file_url: e.target.value})}
                  required
                />
              </div>
            )}

            {/* Info Básica */}
            <div className="space-y-2">
              <Label htmlFor="title">Título del Recurso <span className="text-red-500">*</span></Label>
              <Input 
                id="title" 
                placeholder="Ej. Guía Práctica de Álgebra" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="desc">Descripción (Opcional)</Label>
              <Textarea 
                id="desc" 
                placeholder="Breve explicación de qué contiene..." 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={2}
              />
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Nivel Educativo <span className="text-red-500">*</span></Label>
                <Select value={formData.education_level} onValueChange={(v) => setFormData({...formData, education_level: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccione el Nivel" /></SelectTrigger>
                  <SelectContent>
                    {availableNiveles.map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Grado <span className="text-red-500">*</span></Label>
                <Select 
                  value={formData.grade} 
                  onValueChange={(v) => setFormData({...formData, grade: v})}
                  disabled={formData.education_level === 'none'}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccione el Grado" /></SelectTrigger>
                  <SelectContent>
                    {availableGrados.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subject">Materia {isTeacher && <span className="text-red-500">*</span>}</Label>
                
                <Select 
                  value={isOtherSubject ? 'other' : (formData.subject || 'none')}
                  onValueChange={(v) => {
                    if (v === 'other') {
                      setIsOtherSubject(true);
                      setFormData({...formData, subject: ''});
                    } else if (v === 'none') {
                      setIsOtherSubject(false);
                      setFormData({...formData, subject: ''});
                    } else {
                      setIsOtherSubject(false);
                      setFormData({...formData, subject: v});
                    }
                  }}
                  disabled={formData.grade === 'none'}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccione la Materia" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Seleccione...</SelectItem>
                    {curriculumSubjects.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                    <SelectItem value="other">Otra materia...</SelectItem>
                  </SelectContent>
                </Select>
                
                {isOtherSubject && (
                  <Input 
                    id="subject" 
                    placeholder="Escriba el nombre de la materia" 
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="mt-2"
                    autoFocus
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Aula Específica (Opcional)</Label>
                <Select 
                  value={formData.classroom_id} 
                  onValueChange={(v) => setFormData({...formData, classroom_id: v})}
                  disabled={formData.grade === 'none'}
                >
                  <SelectTrigger><SelectValue placeholder="Para todas las aulas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Para todas las aulas</SelectItem>
                    {filteredClassrooms.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {isTeacher && (
              <p className="text-xs text-muted-foreground mt-2">
                * Por favor asegúrate de subir materiales que correspondan a las materias que dictas.
              </p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="upload-form" disabled={loading}>
            {loading ? 'Subiendo...' : 'Publicar Recurso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
