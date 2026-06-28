import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Save, CheckCircle, XCircle, Clock, FileCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

interface AttendanceManagerProps {
  courseId: string;
}

export function AttendanceManager({ courseId }: AttendanceManagerProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // schedule will come from modulos in Categoría B — unrestricted until then
  const isWithinSchedule = true;

  useEffect(() => {
    fetchStudents();
  }, [courseId]);

  useEffect(() => {
    if (selectedDate) {
      loadExistingAttendance();
    }
  }, [selectedDate, students]);


  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          student:profiles!course_enrollments_student_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('modulo_id', courseId);

      if (error) throw error;

      const enrolledStudents = (data || [])
        .filter(e => e.student)
        .map(e => e.student) as unknown as Student[];
      
      setStudents(enrolledStudents);
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
        .eq('course_id', courseId)
        .eq('date', dateStr);

      if (error) throw error;

      const existingAttendance: Record<string, AttendanceRecord> = {};
      data?.forEach(record => {
        existingAttendance[record.student_id] = {
          student_id: record.student_id,
          status: record.status as any,
          notes: record.notes || undefined,
        };
      });

      setAttendance(existingAttendance);
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

  const handleSaveAttendance = async () => {
    if (!isWithinSchedule) {
      toast.error('La asistencia solo puede registrarse durante el horario de clase');
      return;
    }

    try {
      setSaving(true);

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const attendanceRecords = Object.values(attendance);

      if (attendanceRecords.length === 0) {
        toast.error('Debe registrar al menos una asistencia');
        return;
      }

      const { error } = await supabase.functions.invoke('create-attendance-records', {
        body: {
          course_id: courseId,
          date: dateStr,
          attendance_records: attendanceRecords,
        },
      });

      if (error) throw error;

      toast.success('Asistencia registrada correctamente');
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Error al guardar la asistencia');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    const statusConfig = {
      present: { label: 'Presente', variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      late: { label: 'Tarde', variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600' },
      absent: { label: 'Ausente', variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
      justified: { label: 'Justificado', variant: 'outline' as const, icon: FileCheck, color: 'text-blue-600' },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Cargando estudiantes...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Registro de Asistencia</CardTitle>
            <CardDescription>
              Registre la asistencia de los estudiantes para la fecha seleccionada
            </CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, 'PPP', { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay estudiantes inscritos en este curso
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.first_name} {student.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.email}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={attendance[student.id]?.status || ""}
                        onValueChange={(value) => handleStatusChange(student.id, value as any)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Seleccionar..." />
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
                              Tarde
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end mt-4">
              <Button 
                onClick={handleSaveAttendance} 
                disabled={saving || !isWithinSchedule} 
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Asistencia'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}