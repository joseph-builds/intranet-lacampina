import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Clock, XCircle, FileCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AttendanceStats } from './AttendanceStats';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'justified';
  notes: string | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface AttendanceRecordsProps {
  courseId: string;
}

export function AttendanceRecords({ courseId }: AttendanceRecordsProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [courseId]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      
      const selectQuery = () => supabase
        .from('attendance')
        .select(`
          id,
          date,
          status,
          notes,
          student:profiles!attendance_student_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order('date', { ascending: false });

      let { data: rawRecords, error } = await selectQuery().eq('course_id', courseId);

      if (error && error.code === '42703') {
        console.warn("course_id column doesn't exist in attendance table, falling back to course_id");
        const fallbackResult = await selectQuery().eq("course_id", courseId);
        rawRecords = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;

      const formattedRecords: AttendanceRecord[] = (rawRecords || []).map((r: any) => ({
        id: r.id,
        date: r.date,
        status: r.status as any,
        notes: r.notes,
        student: r.student ? {
          id: r.student.id,
          first_name: r.student.first_name || '',
          last_name: r.student.last_name || '',
          email: r.student.email || ''
        } : null
      }));

      // Calculate stats
      const totalRecords = formattedRecords.length;
      const uniqueDates = new Set(formattedRecords.map(r => r.date));
      const totalClasses = uniqueDates.size;

      const presentCount = formattedRecords.filter(r => r.status === 'present').length;
      const lateCount = formattedRecords.filter(r => r.status === 'late').length;
      const absentCount = formattedRecords.filter(r => r.status === 'absent').length;
      const justifiedCount = formattedRecords.filter(r => r.status === 'justified').length;

      const presentRate = totalRecords > 0 
        ? Math.round(((presentCount + lateCount) / totalRecords) * 100) 
        : 0;

      const calculatedStats = {
        total: totalRecords,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        justified: justifiedCount,
        attendance_rate: presentRate.toString()
      };

      setRecords(formattedRecords);
      setStats(calculatedStats);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Error al cargar la asistencia');
    } finally {
      setLoading(false);
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
    return <div className="text-center py-8">Cargando registros de asistencia...</div>;
  }

  return (
    <div className="space-y-6">
      {stats && <AttendanceStats stats={stats} />}

      <Card>
        <CardHeader>
          <CardTitle>Historial de Asistencia</CardTitle>
          <CardDescription>
            Registros de asistencia de todos los estudiantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay registros de asistencia aún
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.date), 'PPP', { locale: es })}
                    </TableCell>
                    <TableCell>
                      {record.student 
                        ? `${record.student.first_name} ${record.student.last_name}` 
                        : 'Estudiante no disponible'}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}