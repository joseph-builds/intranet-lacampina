import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { CalendarIcon, MapPin, Clock, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

interface AcademicEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string;
}

interface CourseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string;
  location: string | null;
  modulo_id: string;
  courses?: {
    name: string;
    code: string;
  };
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  modulo_id: string;
  courses?: {
    name: string;
    code: string;
  };
}

export function AcademicCalendar() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [academicEvents, setAcademicEvents] = useState<AcademicEvent[]>([]);
  const [courseEvents, setCourseEvents] = useState<CourseEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Fetch academic events
      const { data: academicData, error: academicError } = await supabase
        .from('academic_events')
        .select('*')
        .eq('is_published', true)
        .order('start_date', { ascending: true });

      if (academicError) throw academicError;

      // Fetch course events
      const { data: courseData, error: courseError } = await supabase
        .from('course_events')
        .select(`
          *,
          courses:modulo_id (
            name,
            code
          )
        `)
        .eq('is_published', true)
        .order('start_date', { ascending: true });

      if (courseError) throw courseError;

      // Fetch assignments
      let assignmentsQuery = supabase
        .from('assignments')
        .select(`
          id,
          title,
          description,
          due_date,
          modulo_id,
          courses:modulo_id (
            name,
            code
          )
        `)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      // If user is a student, only fetch their assignments
      if (profile?.role === 'student') {
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('modulo_id')
          .eq('user_id', profile.id);
        
        if (enrollments && enrollments.length > 0) {
          const courseIds = enrollments.map(e => e.modulo_id);
          assignmentsQuery = assignmentsQuery.in('modulo_id', courseIds);
        }
      }

      const { data: assignmentsData, error: assignmentsError } = await assignmentsQuery;

      if (assignmentsError) throw assignmentsError;

      setAcademicEvents(academicData || []);
      setCourseEvents(courseData || []);
      setAssignments(assignmentsData || []);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      toast.error('Error al cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDate = (date: Date) => {
    const academic = academicEvents.filter(event => {
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= startDate && checkDate <= endDate;
    });

    const course = courseEvents.filter(event => {
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= startDate && checkDate <= endDate;
    });

    const assignmentsForDate = assignments.filter(assignment => {
      const dueDate = new Date(assignment.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === checkDate.getTime();
    });

    return { academic, course, assignments: assignmentsForDate };
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : { academic: [], course: [], assignments: [] };

  const getEventTypeBadgeVariant = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      vacation: 'secondary',
      holiday: 'destructive',
      exam: 'outline',
      class: 'default',
      meeting: 'outline',
      other: 'secondary'
    };
    return variants[type] || 'default';
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vacation: 'Vacaciones',
      holiday: 'Feriado',
      exam: 'Examen',
      class: 'Clase',
      meeting: 'Reunión',
      other: 'Otro'
    };
    return labels[type] || type;
  };

  // Mark dates that have events
  const datesWithEvents = new Set<string>();
  [...academicEvents, ...courseEvents].forEach(event => {
    const start = parseISO(event.start_date);
    const end = parseISO(event.end_date);
    const current = new Date(start);
    while (current <= end) {
      datesWithEvents.add(format(current, 'yyyy-MM-dd'));
      current.setDate(current.getDate() + 1);
    }
  });
  
  // Mark dates that have assignments
  assignments.forEach(assignment => {
    const dueDate = parseISO(assignment.due_date);
    datesWithEvents.add(format(dueDate, 'yyyy-MM-dd'));
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendario</CardTitle>
          <CardDescription>Selecciona una fecha para ver los eventos</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={es}
            className="rounded-md border"
            modifiers={{
              hasEvent: (date) => datesWithEvents.has(format(date, 'yyyy-MM-dd'))
            }}
            modifiersStyles={{
              hasEvent: {
                fontWeight: 'bold',
                textDecoration: 'underline'
              }
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedDate ? format(selectedDate, "d 'de' MMMM, yyyy", { locale: es }) : 'Eventos'}
          </CardTitle>
          <CardDescription>
            {selectedEvents.academic.length + selectedEvents.course.length + selectedEvents.assignments.length} evento(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {selectedEvents.academic.length === 0 && selectedEvents.course.length === 0 && selectedEvents.assignments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay eventos para esta fecha</p>
                </div>
              )}

              {selectedEvents.academic.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Eventos del Colegio</h3>
                  {selectedEvents.academic.map(event => (
                    <div
                      key={event.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold">{event.title}</h4>
                        <Badge variant={getEventTypeBadgeVariant(event.event_type)}>
                          {getEventTypeLabel(event.event_type)}
                        </Badge>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(parseISO(event.start_date), "HH:mm", { locale: es })} - 
                          {format(parseISO(event.end_date), "HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedEvents.course.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Eventos de Cursos</h3>
                  {selectedEvents.course.map(event => (
                    <div
                      key={event.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-semibold">{event.title}</h4>
                          {event.courses && (
                            <p className="text-xs text-muted-foreground">
                              {event.courses.name} ({event.courses.code})
                            </p>
                          )}
                        </div>
                        <Badge variant={getEventTypeBadgeVariant(event.event_type)}>
                          {getEventTypeLabel(event.event_type)}
                        </Badge>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                      )}
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(parseISO(event.start_date), "HH:mm", { locale: es })} - 
                            {format(parseISO(event.end_date), "HH:mm", { locale: es })}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            <span>{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedEvents.assignments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Tareas</h3>
                  {selectedEvents.assignments.map(assignment => (
                    <div
                      key={assignment.id}
                      onClick={() => navigate(`/assignments/${assignment.id}`)}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 hover:border-orange-500 transition-colors border-l-4 border-l-orange-500 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-semibold">{assignment.title}</h4>
                          {assignment.courses && (
                            <p className="text-xs text-muted-foreground">
                              {assignment.courses.name} ({assignment.courses.code})
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                          <FileText className="h-3 w-3 mr-1" />
                          Tarea
                        </Badge>
                      </div>
                      {assignment.description && (
                        <p className="text-sm text-muted-foreground mb-2">{assignment.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          Fecha límite: {format(parseISO(assignment.due_date), "HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
