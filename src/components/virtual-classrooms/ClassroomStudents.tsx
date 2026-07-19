import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BulkStudentEnrollment } from './BulkStudentEnrollment';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  is_active: boolean;
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface ClassroomStudentsProps {
  classroomId: string;
  canManage: boolean;
  onUpdate: () => void;
}

export function ClassroomStudents({ classroomId, canManage, onUpdate }: ClassroomStudentsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
    fetchCourses();
  }, [classroomId]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, code')
        .eq('classroom_id', classroomId)
        .eq('is_active', true);

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Get students enrolled in courses of this classroom
      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          student:profiles!course_enrollments_student_id_fkey1(
            id,
            first_name,
            last_name,
            email,
            avatar_url,
            is_active
          ),
          course:courses!course_enrollments_course_id_fkey(
            classroom_id
          )
        `)
        .eq('course.classroom_id', classroomId);

      if (error) throw error;

      // Extract unique students
      const uniqueStudents = data
        ?.map(enrollment => enrollment.student)
        .filter((student, index, self) => 
          student && self.findIndex(s => s?.id === student?.id) === index
        ) || [];

      setStudents(uniqueStudents.filter(Boolean) as Student[]);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Error al cargar los estudiantes');
    } finally {
      setLoading(false);
    }
  };


  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Estudiantes</h2>
          <p className="text-muted-foreground">
            Gestiona los estudiantes de esta aula virtual
          </p>
        </div>
        
        {canManage && courses.length > 0 && (
          <BulkStudentEnrollment 
            classroomId={classroomId}
            courses={courses}
            onUpdate={() => {
              fetchStudents();
              onUpdate();
            }}
          />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-muted rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-3 bg-muted rounded w-32"></div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        ) : students.length > 0 ? (
          students.map((student) => (
            <Card key={student.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarImage src={student.avatar_url} />
                    <AvatarFallback>
                      {getInitials(student.first_name, student.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {student.first_name} {student.last_name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {student.email}
                    </CardDescription>
                  </div>
                  <Badge variant={student.is_active ? "default" : "secondary"}>
                    {student.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay estudiantes</h3>
                <p className="text-muted-foreground text-center">
                  {courses.length === 0 
                    ? "Primero debes crear cursos para poder agregar estudiantes" 
                    : "No hay estudiantes inscritos en los cursos de esta aula virtual"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}