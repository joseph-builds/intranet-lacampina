import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Save, CheckCircle, XCircle, Clock, AlertCircle, FileCheck, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface AttendanceRecord {
  student_id: string;
  status: 'present' | 'late' | 'absent' | 'justified';
  notes?: string;
}

interface VirtualClassroomAttendanceProps {
  classroomId: string;
  canManage: boolean;
}

export function VirtualClassroomAttendance({ classroomId, canManage }: VirtualClassroomAttendanceProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendanceTaken, setAttendanceTaken] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [globalNotes, setGlobalNotes] = useState('');

  useEffect(() => {
    fetchStudents();
  }, [classroomId]);

  useEffect(() => {
    if (selectedDate) {
      loadExistingAttendance();
    }
  }, [selectedDate, students]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Get students enrolled in this section (New Architecture)
      const { data, error } = await supabase
        .from('student_sections')
        .select(`
          student_id,
          profiles!inner(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('section_id', classroomId)
        .eq('profiles.is_active', true);

      if (error) throw error;

      // Extract unique students
      const uniqueStudents = Array.from(
        new Map(
          (data || []).map((item) => [item.student_id, item.profiles])
        ).values()
      ) as Student[];

      setStudents(uniqueStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Error al cargar estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAttendance = async () => {
    if (!students.length) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status, notes')
        .eq('classroom_id', classroomId)
        .eq('date', dateStr);

      if (error) throw error;

      const existingAttendance: Record<string, AttendanceRecord> = {};
      let hasRecords = false;

      data?.forEach(record => {
        hasRecords = true;
        existingAttendance[record.student_id] = {
          student_id: record.student_id,
          status: record.status as any,
          notes: record.notes || undefined,
        };
      });

      setAttendance(existingAttendance);
      setAttendanceTaken(hasRecords);

      // Si no hay registros, marcar todos como presente por defecto
      if (!hasRecords && canManage) {
        const defaultAttendance: Record<string, AttendanceRecord> = {};
        students.forEach(student => {
          defaultAttendance[student.id] = {
            student_id: student.id,
            status: 'present',
          };
        });
        setAttendance(defaultAttendance);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceRecord['status']) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        student_id: studentId,
        status,
        notes: prev[studentId]?.notes,
      },
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        status: prev[studentId]?.status || 'present',
        notes: notes || undefined,
      },
    }));
  };

  const handleMarkAll = (status: AttendanceRecord['status']) => {
    const newAttendance: Record<string, AttendanceRecord> = {};
    students.forEach(student => {
      newAttendance[student.id] = {
        student_id: student.id,
        status,
        notes: attendance[student.id]?.notes,
      };
    });
    setAttendance(newAttendance);
    toast.success(`Todos los estudiantes marcados como "${getStatusLabel(status)}"`);
  };

  const handleSaveAttendance = async () => {
    try {
      setSaving(true);

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const attendanceRecords = Object.values(attendance);

      if (attendanceRecords.length === 0) {
        toast.error('Debe registrar al menos una asistencia');
        return;
      }

      // Verificar que todos los estudiantes tengan registro
      const missingStudents = students.filter(s => !attendance[s.id]);
      if (missingStudents.length > 0) {
        toast.error(`Faltan ${missingStudents.length} estudiantes por registrar`);
        return;
      }

      const { error } = await supabase.rpc('create_classroom_attendance', {
        p_classroom_id: classroomId,
        p_date: dateStr,
        p_records: attendanceRecords.map(r => ({
          ...r,
          notes: r.notes || globalNotes || null,
        })),
      });

      if (error) throw error;

      toast.success('Asistencia guardada exitosamente');
      setAttendanceTaken(true);
      setIsEditing(false);
      setGlobalNotes('');
      loadExistingAttendance();
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast.error(error.message || 'Error al guardar la asistencia');
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'late':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'absent':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'justified':
        return <FileCheck className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusLabel = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present':
        return 'Presente';
      case 'late':
        return 'Tardanza';
      case 'absent':
        return 'Ausente';
      case 'justified':
        return 'Justificado';
    }
  };

  const getStatusBadgeVariant = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present':
        return 'default';
      case 'late':
        return 'secondary';
      case 'absent':
        return 'destructive';
      case 'justified':
        return 'outline';
    }
  };

  const stats = {
    total: students.length,
    present: Object.values(attendance).filter(a => a.status === 'present').length,
    late: Object.values(attendance).filter(a => a.status === 'late').length,
    absent: Object.values(attendance).filter(a => a.status === 'absent').length,
    justified: Object.values(attendance).filter(a => a.status === 'justified').length,
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Control de Asistencia
              </CardTitle>
              <CardDescription>
                Registro diario de asistencia del aula virtual
              </CardDescription>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={es}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presentes</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tardanzas</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ausentes</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Justificados</CardTitle>
            <FileCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.justified}</div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Status Alert */}
      {attendanceTaken && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                La asistencia para esta fecha ya ha sido registrada. Puede modificarla si es necesario.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {canManage && (!attendanceTaken || isEditing) && isToday && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Acciones Rápidas</CardTitle>
            <CardDescription>
              Marque la asistencia de todos los estudiantes rápidamente
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMarkAll('present')}
              className="border-green-200 hover:bg-green-50"
            >
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              Marcar todos presentes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMarkAll('absent')}
              className="border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2 text-red-600" />
              Marcar todos ausentes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista de Estudiantes</CardTitle>
            <CardDescription>
              {canManage
                ? 'Marque la asistencia de cada estudiante'
                : 'Registro de asistencia del aula'}
            </CardDescription>
          </div>
          {canManage && attendanceTaken && !isEditing && isToday && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <FileCheck className="h-4 w-4 mr-2" />
              Editar Asistencia
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Estudiante</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[200px]">Estado</TableHead>
                {canManage && <TableHead className="w-[300px]">Observaciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground">
                    No hay estudiantes matriculados en esta aula virtual
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student, index) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {student.first_name} {student.last_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.email}
                    </TableCell>
                    <TableCell>
                      {canManage && (!attendanceTaken || isEditing) && isToday ? (
                        <Select
                          value={attendance[student.id]?.status || 'present'}
                          onValueChange={(value) =>
                            handleStatusChange(student.id, value as AttendanceRecord['status'])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                Presente
                              </div>
                            </SelectItem>
                            <SelectItem value="late">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-yellow-600" />
                                Tardanza
                              </div>
                            </SelectItem>
                            <SelectItem value="absent">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-600" />
                                Ausente
                              </div>
                            </SelectItem>
                            <SelectItem value="justified">
                              <div className="flex items-center gap-2">
                                <FileCheck className="h-4 w-4 text-blue-600" />
                                Justificado
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={getStatusBadgeVariant(attendance[student.id]?.status || 'absent')}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(attendance[student.id]?.status || 'absent')}
                            {getStatusLabel(attendance[student.id]?.status || 'absent')}
                          </div>
                        </Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        {(!attendanceTaken || isEditing) && isToday ? (
                          <Textarea
                            placeholder="Observaciones (opcional)"
                            value={attendance[student.id]?.notes || ''}
                            onChange={(e) => handleNotesChange(student.id, e.target.value)}
                            rows={1}
                            className="min-h-[36px]"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {attendance[student.id]?.notes || '-'}
                          </p>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Global Notes */}
      {canManage && (!attendanceTaken || isEditing) && isToday && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Observaciones Generales</CardTitle>
            <CardDescription>
              Notas que se aplicarán a todos los estudiantes (opcional)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Ej: Día de actividad especial, feriado, etc."
              value={globalNotes}
              onChange={(e) => setGlobalNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      {canManage && (!attendanceTaken || isEditing) && isToday && (
        <div className="flex justify-end gap-4">
          {isEditing && (
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              size="lg"
            >
              Cancelar Edición
            </Button>
          )}
          <Button
            onClick={handleSaveAttendance}
            disabled={saving || students.length === 0}
            size="lg"
            className="bg-gradient-primary shadow-glow"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Asistencia'}
          </Button>
        </div>
      )}

      {/* Info Messages */}
      {!isToday && canManage && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Solo se puede tomar asistencia para el día de hoy. Seleccione la fecha de hoy para registrar asistencia.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
