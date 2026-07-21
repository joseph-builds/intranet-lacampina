import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Clock, XCircle, FileCheck, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AttendanceStats } from '../course/AttendanceStats';
import { AttendancePieChart } from '../course/AttendancePieChart';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'justified';
  notes: string | null;
  course: {
    id: string;
    name: string;
    code: string;
  };
}

export function StudentAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autorizado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil no encontrado');

      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          date,
          status,
          notes,
          created_at,
          course:courses!attendance_course_id_fkey(
            id,
            name,
            code
          ),
          classroom_id
        `)
        .eq('student_id', profile.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const formattedRecords = data.map((record: any) => ({
        id: record.id,
        date: record.date,
        status: record.status,
        notes: record.notes,
        course: record.course ? {
          id: record.course.id,
          name: record.course.name,
          code: record.course.code,
        } : {
          id: record.classroom_id || 'classroom',
          name: 'Aula Virtual General',
          code: 'AULA',
        }
      }));

      const totalRecords = formattedRecords.length;
      const presentCount = formattedRecords.filter((r: any) => r.status === 'present').length;
      const lateCount = formattedRecords.filter((r: any) => r.status === 'late').length;
      const absentCount = formattedRecords.filter((r: any) => r.status === 'absent').length;
      const justifiedCount = formattedRecords.filter((r: any) => r.status === 'justified').length;

      const newStats = {
        total: totalRecords,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        justified: justifiedCount,
        attendance_rate: totalRecords > 0 ? parseFloat(((presentCount + lateCount) / totalRecords * 100).toFixed(2)) : 0,
      };

      setRecords(formattedRecords);
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Error al cargar tu asistencia');
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
    return <div className="text-center py-8">Cargando tu asistencia...</div>;
  }

  return (
    <div className="space-y-6">
      {stats && (
        <>
          <AttendanceStats stats={stats} />
          <AttendancePieChart stats={stats} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mi Historial de Asistencia
          </CardTitle>
          <CardDescription>
            Registros de tu asistencia en todos los cursos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tienes registros de asistencia aún
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Curso</TableHead>
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
                      <div>
                        <div className="font-medium">{record.course.name}</div>
                        <div className="text-xs text-muted-foreground">{record.course.code}</div>
                      </div>
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