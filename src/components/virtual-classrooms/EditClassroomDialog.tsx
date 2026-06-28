import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VirtualClassroom {
  id: string;
  name: string;
  grade: string;
  education_level: 'primaria' | 'secundaria';
  academic_year: string;
  section: string;
  teacher_principal_id: string;
  tutor_id?: string | null;
  is_active: boolean;
  teacher?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
}

interface Tutor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface EditClassroomDialogProps {
  classroom: VirtualClassroom | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  teachers: Teacher[];
  tutors: Tutor[];
  isAdmin: boolean;
}

const grades = {
  primaria: ['1ro', '2do', '3ro', '4to', '5to', '6to'],
  secundaria: ['1ro', '2do', '3ro', '4to', '5to']
};

export function EditClassroomDialog({ 
  classroom, 
  open, 
  onOpenChange, 
  onSuccess, 
  teachers,
  tutors,
  isAdmin 
}: EditClassroomDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    grade: '',
    education_level: '' as 'primaria' | 'secundaria' | '',
    academic_year: '',
    teacher_principal_id: '',
    tutor_id: '',
    section: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (classroom) {
      setFormData({
        name: classroom.name,
        grade: classroom.grade,
        education_level: classroom.education_level,
        academic_year: classroom.academic_year,
        teacher_principal_id: classroom.teacher_principal_id,
        tutor_id: classroom.tutor_id || '',
        section: classroom.section,
        is_active: classroom.is_active
      });
    }
  }, [classroom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classroom) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No estás autenticado');
      }

      const response = await supabase.functions.invoke('update-virtual-classroom', {
        body: {
          id: classroom.id,
          name: formData.name,
          grade: formData.grade,
          education_level: formData.education_level,
          academic_year: formData.academic_year,
          section: formData.section,
          is_active: formData.is_active,
          ...(isAdmin && { teacher_principal_id: formData.teacher_principal_id }),
          ...(isAdmin && { tutor_id: formData.tutor_id || null })
        }
      });

      if (response.error) throw response.error;
      
      const result = response.data;
      
      if (!result?.success) {
        throw new Error(result?.error || 'Error al actualizar el aula virtual');
      }

      toast.success('Aula virtual actualizada exitosamente');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating classroom:', error);
      toast.error(`Error al actualizar el aula: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!classroom) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Aula Virtual</DialogTitle>
          <DialogDescription>
            Modifica los datos del aula virtual
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Nombre del Aula</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Aula 1ro A"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="edit-education-level">Nivel Educativo</Label>
            <Select 
              value={formData.education_level} 
              onValueChange={(value: 'primaria' | 'secundaria') => 
                setFormData({ ...formData, education_level: value, grade: '' })
              }
            >
              <SelectTrigger id="edit-education-level">
                <SelectValue placeholder="Seleccionar nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primaria">Primaria</SelectItem>
                <SelectItem value="secundaria">Secundaria</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.education_level && (
            <div>
              <Label htmlFor="edit-grade">Grado</Label>
              <Select 
                value={formData.grade} 
                onValueChange={(value) => setFormData({ ...formData, grade: value })}
              >
                <SelectTrigger id="edit-grade">
                  <SelectValue placeholder="Seleccionar grado" />
                </SelectTrigger>
                <SelectContent>
                  {grades[formData.education_level].map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="edit-section">Sección</Label>
            <Input
              id="edit-section"
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
              placeholder="A, B, C, etc."
              maxLength={1}
              pattern="[A-Z]"
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-academic-year">Año Académico</Label>
            <Input
              id="edit-academic-year"
              value={formData.academic_year}
              onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
              placeholder="2025"
              required
            />
          </div>

          {isAdmin && (
            <div>
              <Label htmlFor="edit-teacher">Profesor Responsable</Label>
              <Select 
                value={formData.teacher_principal_id} 
                onValueChange={(value) => setFormData({ ...formData, teacher_principal_id: value })}
              >
                <SelectTrigger id="edit-teacher">
                  <SelectValue placeholder="Seleccionar profesor" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.first_name} {teacher.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isAdmin && (
            <div>
              <Label htmlFor="edit-tutor">Tutor (Opcional)</Label>
              <Select 
                value={formData.tutor_id || undefined} 
                onValueChange={(value) => setFormData({ ...formData, tutor_id: value })}
              >
                <SelectTrigger id="edit-tutor">
                  <SelectValue placeholder="Seleccionar tutor (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {tutors.map((tutor) => (
                    <SelectItem key={tutor.id} value={tutor.id}>
                      {tutor.first_name} {tutor.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="edit-is-active">Aula Activa</Label>
            <Switch
              id="edit-is-active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
