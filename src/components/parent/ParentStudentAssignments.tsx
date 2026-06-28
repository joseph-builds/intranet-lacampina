import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  course_name: string;
  status: 'pendiente' | 'atrasado';
}

interface ParentStudentAssignmentsProps {
  studentId: string;
}

export default function ParentStudentAssignments({ studentId }: ParentStudentAssignmentsProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, [studentId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          description,
          due_date,
          course:course_id (name)
        `)
        .order('due_date', { ascending: false })
        .limit(10);

      if (error) throw error;

      const formattedAssignments: Assignment[] = data?.map(assignment => {
        const now = new Date();
        const dueDate = new Date(assignment.due_date);
        
        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description || 'Sin descripción',
          due_date: assignment.due_date,
          course_name: assignment.course?.name || 'Sin curso',
          status: dueDate < now ? 'atrasado' : 'pendiente'
        };
      }) || [];

      setAssignments(formattedAssignments);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Cargando tareas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas y Trabajos</CardTitle>
        <CardDescription>Listado completo de tareas asignadas</CardDescription>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <Alert>
            <AlertDescription>
              No hay tareas registradas aún.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold">{assignment.title}</h3>
                    <p className="text-sm text-muted-foreground">{assignment.course_name}</p>
                  </div>
                  <Badge variant={assignment.status === 'atrasado' ? 'destructive' : 'secondary'}>
                    {assignment.status}
                  </Badge>
                </div>
                
                <p className="text-sm mb-3">{assignment.description}</p>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Entrega: {format(new Date(assignment.due_date), 'dd/MM/yyyy', { locale: es })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
