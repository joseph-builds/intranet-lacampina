import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Users, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  missing_courses_count?: number;
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface BulkStudentEnrollmentProps {
  classroomId: string;
  courses: Course[];
  onUpdate: () => void;
}

export function BulkStudentEnrollment({ classroomId, courses, onUpdate }: BulkStudentEnrollmentProps) {
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isDialogOpen) {
      fetchAvailableStudents();
    }
  }, [isDialogOpen, classroomId]);

  const fetchAvailableStudents = async () => {
    try {
      // Get all students
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, is_active')
        .eq('role', 'student')
        .eq('is_active', true)
        .order('last_name', { ascending: true });

      if (studentsError) throw studentsError;

      // Get existing enrollments for these courses
      const courseIds = courses.map(c => c.id);
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('student_id, course_id')
        .in('course_id', courseIds);

      if (enrollError) throw enrollError;

      console.log('📚 Courses:', courses.length, courseIds);
      console.log('📋 All enrollments:', enrollments);
      console.log('👥 All students:', students);

      // Add missing courses count to each student
      const studentsWithInfo = students?.map(student => {
        const studentEnrollments = enrollments?.filter(e => e.student_id === student.id) || [];
        const missingCoursesCount = courses.length - studentEnrollments.length;
        
        console.log(`👤 ${student.first_name} ${student.last_name}: ${studentEnrollments.length}/${courses.length} cursos (falta ${missingCoursesCount})`);
        
        return {
          ...student,
          missing_courses_count: missingCoursesCount
        };
      }).filter(s => s.missing_courses_count > 0) || [];

      console.log('✅ Students to show:', studentsWithInfo.map(s => `${s.first_name} ${s.last_name}`));
      setAvailableStudents(studentsWithInfo);
    } catch (error) {
      console.error('Error fetching available students:', error);
      toast.error('Error al cargar estudiantes disponibles');
    }
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    const filteredStudents = availableStudents.filter(student =>
      `${student.first_name} ${student.last_name} ${student.email}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
    
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const handleBulkEnroll = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Selecciona al menos un estudiante');
      return;
    }

    if (courses.length === 0) {
      toast.error('No hay cursos disponibles en esta aula virtual');
      return;
    }

    setLoading(true);
    try {
      // Get all course IDs from the classroom
      const courseIds = courses.map(c => c.id);

      // Check for existing enrollments for all courses
      const { data: existingEnrollments } = await supabase
        .from('course_enrollments')
        .select('student_id, course_id')
        .in('course_id', courseIds)
        .in('student_id', selectedStudents);

      // Create enrollment records for all students in all courses (excluding existing ones)
      const enrollmentData = [];
      for (const studentId of selectedStudents) {
        for (const courseId of courseIds) {
          const alreadyEnrolled = existingEnrollments?.some(
            e => e.student_id === studentId && e.course_id === courseId
          );
          
          if (!alreadyEnrolled) {
            enrollmentData.push({
              student_id: studentId,
              course_id: courseId
            });
          }
        }
      }

      if (enrollmentData.length === 0) {
        toast.error('Todos los estudiantes seleccionados ya están inscritos en todos los cursos');
        return;
      }

      // Insert new enrollments
      const { error } = await supabase
        .from('course_enrollments')
        .insert(enrollmentData);

      if (error) throw error;

      const studentsCount = selectedStudents.length;
      const coursesCount = courses.length;
      toast.success(`${studentsCount} estudiante${studentsCount !== 1 ? 's' : ''} inscrito${studentsCount !== 1 ? 's' : ''} en ${coursesCount} curso${coursesCount !== 1 ? 's' : ''} exitosamente`);
      
      setIsDialogOpen(false);
      setSelectedStudents([]);
      setSearchTerm('');
      onUpdate();
    } catch (error) {
      console.error('Error enrolling students:', error);
      toast.error('Error al inscribir estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = availableStudents.filter(student =>
    `${student.first_name} ${student.last_name} ${student.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const allFilteredSelected = filteredStudents.length > 0 && 
    filteredStudents.every(student => selectedStudents.includes(student.id));

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Inscripción Masiva
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscripción Masiva de Estudiantes</DialogTitle>
          <DialogDescription>
            Selecciona los estudiantes que deseas inscribir en todos los cursos de esta aula virtual ({courses.length} curso{courses.length !== 1 ? 's' : ''})
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Course Info */}
          {courses.length > 0 && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium mb-1">Cursos del aula virtual:</p>
              <ul className="text-sm text-muted-foreground">
                {courses.slice(0, 3).map(course => (
                  <li key={course.id}>• {course.name} ({course.code})</li>
                ))}
                {courses.length > 3 && (
                  <li>• ... y {courses.length - 3} curso{courses.length - 3 !== 1 ? 's' : ''} más</li>
                )}
              </ul>
            </div>
          )}

          {/* Search and Select All */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar Estudiantes</Label>
            <Input
              id="search"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={filteredStudents.length === 0}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {allFilteredSelected ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedStudents.length} de {filteredStudents.length} seleccionados
              </span>
            </div>
          </div>

          {/* Students List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Estudiantes Disponibles ({filteredStudents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              {filteredStudents.length > 0 ? (
                <div className="space-y-2">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded">
                      <Checkbox
                        id={student.id}
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={() => handleStudentToggle(student.id)}
                      />
                      <label htmlFor={student.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {student.email}
                            </p>
                          </div>
                          {student.missing_courses_count !== undefined && student.missing_courses_count > 0 && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {student.missing_courses_count} curso{student.missing_courses_count !== 1 ? 's' : ''} pendiente{student.missing_courses_count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    {searchTerm ? 'No se encontraron estudiantes' : 'No hay estudiantes disponibles'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button 
              onClick={handleBulkEnroll}
              disabled={selectedStudents.length === 0 || loading || courses.length === 0}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? 'Inscribiendo...' : `Inscribir ${selectedStudents.length} Estudiante${selectedStudents.length !== 1 ? 's' : ''} en Todos los Cursos`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}