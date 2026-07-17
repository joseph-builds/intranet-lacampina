import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Plus, Search, Edit, Trash2, Users, BookOpen, UserCheck, UserX, Filter, Mail, Phone, GraduationCap } from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  nivel?: string; // Futura columna en BD
  grado?: string; // Futura columna en BD
  enrollments?: { count: number }[];
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface Enrollment {
  id: string;
  student_id: string;
  modulo_id: string;
  enrolled_at: string;
  course: Course;
}

interface StudentFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

const AdminStudentManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  // States
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentEnrollments, setStudentEnrollments] = useState<Enrollment[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [nivelFilter, setNivelFilter] = useState('all');
  const [gradoFilter, setGradoFilter] = useState('all');
  
  const [selectedCourseForEnrollment, setSelectedCourseForEnrollment] = useState('');
  const [formData, setFormData] = useState<StudentFormData>({
    first_name: '', last_name: '', email: '', phone: ''
  });

  useEffect(() => {
    fetchStudents();
    fetchCourses();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*, enrollments:course_enrollments (count)`)
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({ title: "Error", description: "No se pudieron cargar los estudiantes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase.from('courses').select('id, name, code').eq('is_active', true).order('name');
      if (!error) setCourses(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchStudentEnrollments = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`*, course:courses (id, name, code)`)
        .eq('student_id', studentId)
        .order('enrollment_date', { ascending: false });
      if (!error) setStudentEnrollments(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: 'TempPassword123!',
        options: { data: { first_name: formData.first_name, last_name: formData.last_name, role: 'student' } }
      });

      if (authError) throw authError;

      if (authData.user) {
        await supabase.from('profiles').update({ phone: formData.phone || null, role: 'student' }).eq('id', authData.user.id);
      }

      toast({ title: "Éxito", description: "Estudiante creado exitosamente." });
      setIsCreateModalOpen(false);
      resetForm();
      fetchStudents();
    } catch (error) {
      toast({ title: "Error", description: "Error al crear el estudiante", variant: "destructive" });
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: formData.first_name, last_name: formData.last_name, phone: formData.phone || null })
        .eq('id', editingStudent.id);
      if (error) throw error;
      
      toast({ title: "Éxito", description: "Estudiante actualizado exitosamente" });
      setIsEditModalOpen(false);
      setEditingStudent(null);
      resetForm();
      fetchStudents();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    }
  };

  const handleToggleStudentStatus = async (student: Student) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_active: !student.is_active }).eq('id', student.id);
      if (error) throw error;
      toast({ title: "Éxito", description: `Estado actualizado` });
      fetchStudents();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedCourseForEnrollment) return;
    try {
      const { error } = await supabase.from('course_enrollments').insert([{
        student_id: selectedStudent.id,
        modulo_id: selectedCourseForEnrollment,
        enrolled_at: new Date().toISOString()
      }]);

      if (error) throw error;
      toast({ title: "Éxito", description: "Estudiante matriculado" });
      setSelectedCourseForEnrollment('');
      fetchStudentEnrollments(selectedStudent.id);
      fetchStudents();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo matricular", variant: "destructive" });
    }
  };

  const handleUnenrollStudent = async (enrollmentId: string) => {
    if (!confirm('¿Estás seguro de que quieres retirar al estudiante de este curso?')) return;
    try {
      const { error } = await supabase.from('course_enrollments').delete().eq('id', enrollmentId);
      if (error) throw error;
      toast({ title: "Éxito", description: "Estudiante retirado" });
      if (selectedStudent) fetchStudentEnrollments(selectedStudent.id);
      fetchStudents();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({ first_name: student.first_name, last_name: student.last_name, email: student.email, phone: student.phone || '' });
    setIsEditModalOpen(true);
  };

  const openEnrollModal = (student: Student) => {
    setSelectedStudent(student);
    fetchStudentEnrollments(student.id);
    setIsEnrollModalOpen(true);
  };

  const resetForm = () => setFormData({ first_name: '', last_name: '', email: '', phone: '' });

  // Filtros combinados
  const filteredStudents = students.filter(student => {
    const searchString = `${student.first_name} ${student.last_name} ${student.email}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && student.is_active) || (filterStatus === 'inactive' && !student.is_active);
    
    // Simulando el filtro de nivel/grado hasta agregar las columnas a BD
    const matchesNivel = nivelFilter === 'all' || student.nivel === nivelFilter;
    const matchesGrado = gradoFilter === 'all' || student.grado === gradoFilter;

    return matchesSearch && matchesStatus && matchesNivel && matchesGrado;
  });

  const StudentForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void, isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">Nombres</Label>
          <Input id="first_name" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Apellidos</Label>
          <Input id="last_name" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={isEdit} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => { isEdit ? setIsEditModalOpen(false) : setIsCreateModalOpen(false); resetForm(); }}>Cancelar</Button>
        <Button type="submit">{isEdit ? 'Actualizar' : 'Crear Estudiante'}</Button>
      </div>
    </form>
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-primary" />
              Gestión de Estudiantes
            </h1>
            <p className="text-muted-foreground mt-1">Administra la matrícula, grados y niveles del colegio</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Matricular Nuevo Alumno
          </Button>
        </div>

        {/* Filtros de Colegio */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar alumno..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={nivelFilter} onValueChange={setNivelFilter}>
                <SelectTrigger><SelectValue placeholder="Nivel Educativo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Niveles</SelectItem>
                  <SelectItem value="inicial">Inicial (3-5 años)</SelectItem>
                  <SelectItem value="primaria">Primaria</SelectItem>
                  <SelectItem value="secundaria">Secundaria</SelectItem>
                </SelectContent>
              </Select>
              <Select value={gradoFilter} onValueChange={setGradoFilter}>
                <SelectTrigger><SelectValue placeholder="Grado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Grados</SelectItem>
                  <SelectItem value="1">1er Grado</SelectItem>
                  <SelectItem value="2">2do Grado</SelectItem>
                  <SelectItem value="3">3er Grado</SelectItem>
                  <SelectItem value="4">4to Grado</SelectItem>
                  <SelectItem value="5">5to Grado</SelectItem>
                  <SelectItem value="6">6to Grado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Alumnos Registrados ({filteredStudents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
               <div className="animate-pulse space-y-4 py-4">
                 {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded w-full"></div>)}
               </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Nivel / Grado</TableHead>
                      <TableHead>Cursos Matriculados</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white">
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          No se encontraron estudiantes con esos filtros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => (
                        <TableRow key={student.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="font-medium text-gray-900">{student.first_name} {student.last_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Mail className="w-3 h-3" /> {student.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500 italic">Por asignar</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                              <BookOpen className="w-3 h-3 mr-1" />
                              {student.enrollments?.[0]?.count || 0} cursos
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${student.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {student.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="outline" size="sm" title="Matricular en Cursos" onClick={() => openEnrollModal(student)}>
                                <BookOpen className="w-4 h-4 text-indigo-600" />
                              </Button>
                              <Button variant="outline" size="sm" title="Editar Estudiante" onClick={() => openEditModal(student)}>
                                <Edit className="w-4 h-4 text-blue-600" />
                              </Button>
                              <Button variant="outline" size="sm" title={student.is_active ? 'Desactivar' : 'Activar'} onClick={() => handleToggleStudentStatus(student)}>
                                {student.is_active ? <UserX className="w-4 h-4 text-red-600" /> : <UserCheck className="w-4 h-4 text-green-600" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modales - Mantenemos tus modales originales de Supabase aquí */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent><DialogHeader><DialogTitle>Nuevo Estudiante</DialogTitle></DialogHeader><StudentForm onSubmit={handleCreateStudent} /></DialogContent>
        </Dialog>
        
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent><DialogHeader><DialogTitle>Editar Estudiante</DialogTitle></DialogHeader><StudentForm onSubmit={handleEditStudent} isEdit={true} /></DialogContent>
        </Dialog>

        <Dialog open={isEnrollModalOpen} onOpenChange={setIsEnrollModalOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>Matrícula de Cursos - {selectedStudent?.first_name} {selectedStudent?.last_name}</DialogTitle></DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Inscribir en nuevo curso</h3>
                <form onSubmit={handleEnrollStudent} className="flex gap-2">
                  <Select value={selectedCourseForEnrollment} onValueChange={setSelectedCourseForEnrollment}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
                    <SelectContent>
                      {courses.filter(course => !studentEnrollments.some(enrollment => enrollment.modulo_id === course.id)).map((course) => (
                        <SelectItem key={course.id} value={course.id}>{course.name} ({course.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={!selectedCourseForEnrollment}>Inscribir</Button>
                </form>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Cursos Actuales ({studentEnrollments.length})</h3>
                {studentEnrollments.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Curso</TableHead><TableHead>Fecha</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {studentEnrollments.map((enrollment) => (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium">{enrollment.course.name}</TableCell>
                          <TableCell>{new Date(enrollment.enrolled_at).toLocaleDateString()}</TableCell>
                          <TableCell><Button variant="destructive" size="sm" onClick={() => handleUnenrollStudent(enrollment.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (<p className="text-muted-foreground text-sm">No está matriculado en ningún curso.</p>)}
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default AdminStudentManagement;