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
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const response = await fetch(
  `${supabaseUrl}/functions/v1/get-course-attendance?modulo_id=${courseId}`,
  {
    headers: {
      Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
    },
  }
);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cargar la asistencia');
      }

      const data = await response.json();

      setRecords(data.records || []);
      setStats(data.stats || null);
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