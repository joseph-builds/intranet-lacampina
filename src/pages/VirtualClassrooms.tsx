import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, GraduationCap, Users, Plus, Loader2, Trash2, Edit, CalendarIcon, Check, ChevronsUpDown, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { EditClassroomDialog } from "@/components/virtual-classrooms/EditClassroomDialog";
import { DeleteClassroomDialog } from "@/components/virtual-classrooms/DeleteClassroomDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ClassroomCoursesList } from "@/components/virtual-classrooms/ClassroomCoursesList";
import { fetchAllTeachers } from '@/utils/teacherUtils';

interface VirtualClassroom {
  id: string;
  name: string;
  grade: string;
  education_level: 'primaria' | 'secundaria';
  academic_year: string;
  section: string;
  teacher_principal_id: string;
  tutor_id?: string | null;
  is_active: boolean;
  created_at: string;
  teacher?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  tutor?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  courses_count?: number;
  students_count?: number;
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
}

interface Tutor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export default function VirtualClassrooms() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<VirtualClassroom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [editingClassroom, setEditingClassroom] = useState<VirtualClassroom | null>(null);
  const [deletingClassroom, setDeletingClassroom] = useState<VirtualClassroom | null>(null);

  // Cache timeout: 5 minutos
  const CACHE_TIMEOUT = 5 * 60 * 1000;
  const [formData, setFormData] = useState({
    name: '',
    grade: '',
    education_level: '' as 'primaria' | 'secundaria' | '',
    academic_year: new Date().getFullYear().toString(),
    teacher_principal_id: '',
    tutor_id: '',
    section: '',
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined
  });
  const [teacherSearch, setTeacherSearch] = useState("");
  const [tutorSearch, setTutorSearch] = useState("");
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);

  const grades = {
    primaria: ['1ro', '2do', '3ro', '4to', '5to', '6to'],
    secundaria: ['1ro', '2do', '3ro', '4to', '5to']
  };

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    // Paralelizar la carga de datos
    Promise.all([
      fetchClassrooms(),
      fetchTeachers(),
      fetchTutors()
    ]).catch(error => {
      console.error('Error en carga inicial:', error);
    });
  }, []);

  const fetchTeachers = async () => {
    try {
      const data = await fetchAllTeachers();
      setTeachers(data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast.error('Error al cargar la lista de profesores');
    }
  };

  const fetchTutors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .eq('role', 'tutor')
        .eq('is_active', true);

      if (error) throw error;
      setTutors(data || []);
    } catch (error) {
      console.error('Error fetching tutors:', error);
      toast.error('Error al cargar la lista de tutores');
    }
  };

  const fetchClassrooms = async (forceRefresh = false) => {
    const now = Date.now();
    
    if (!forceRefresh && classrooms.length > 0 && (now - lastFetch) < CACHE_TIMEOUT) {
      console.log('🔄 Usando datos en cache (válidos por', Math.round((CACHE_TIMEOUT - (now - lastFetch)) / 1000), 'segundos más)');
      return;
    }

    const startTime = performance.now();
    
    try {
      setLoading(true);
      
      // 1. Pedir SOLO los módulos (sin forzar relaciones para evitar el error PGRST200)
      const { data: modulosData, error } = await supabase
        .from('modulos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      // 2. Recolectar todos los IDs de profesores y tutores para buscarlos de golpe
      const profileIds = [...new Set([
        ...(modulosData?.map(m => m.teacher_principal_id) || []),
        ...(modulosData?.map(m => m.tutor_id) || [])
      ])].filter(Boolean); // Limpiamos los nulos

      // 3. Traer los nombres y correos de esos perfiles
      let profilesMap = new Map();
      if (profileIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', profileIds);
          
        if (profilesData) {
          profilesData.forEach(p => profilesMap.set(p.id, p));
        }
      }

      // 4. Cruzar los datos (Frontend Join)
      const formattedClassrooms = modulosData?.map(modulo => {
        const teacher = profilesMap.get(modulo.teacher_principal_id);
        const tutor = profilesMap.get(modulo.tutor_id);
        
        return {
          ...modulo,
          teacher: teacher || null,
          tutor: tutor || null
        };
      }) || [];

      setClassrooms(formattedClassrooms as any);
      setLastFetch(now);
      
    } catch (error: any) {
      console.error('❌ Error general cargando aulas virtuales:', error);
      toast.error(`Error al cargar las aulas virtuales: ${error.message}`);
      setClassrooms([]); 
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate dates
    if (!formData.start_date || !formData.end_date) {
      toast.error('Por favor selecciona las fechas de inicio y fin');
      return;
    }

    if (formData.end_date <= formData.start_date) {
      toast.error('La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }
    
    if (!profile || !formData.education_level) {
      toast.error('No se pudo identificar el usuario o falta el nivel educativo');
      return;
    }

    setIsCreating(true);

    try {
      console.log('🔄 Creando nueva aula virtual con Edge Function...', formData);

      // Get the current session to include in the request
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('No estás autenticado');
        return;
      }

      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('create-virtual-classroom', {
        body: {
          name: formData.name,
          grade: formData.grade,
          education_level: formData.education_level as 'primaria' | 'secundaria',
          academic_year: formData.academic_year,
          teacher_principal_id: formData.teacher_principal_id || profile.id,
          tutor_id: formData.tutor_id && formData.tutor_id !== "none" ? formData.tutor_id : null,
          section: formData.section.toUpperCase(),
          start_date: format(formData.start_date, 'yyyy-MM-dd'),
          end_date: format(formData.end_date, 'yyyy-MM-dd')
        }
      });

      if (error) {
        console.error('❌ Error calling Edge Function:', error);
        throw new Error(error.message || 'Error al llamar a la función');
      }

      if (!data.success) {
        throw new Error(data.error || 'Error en la respuesta del servidor');
      }

      console.log('✅ Aula virtual creada exitosamente:', data.data);

      toast.success(data.message || 'Aula virtual creada exitosamente');
      setIsCreateDialogOpen(false);
      setFormData({
        name: '',
        grade: '',
        education_level: '',
        academic_year: new Date().getFullYear().toString(),
        teacher_principal_id: '',
        tutor_id: '',
        section: '',
        start_date: undefined,
        end_date: undefined
      });
      setTeacherSearch("");
      setTutorSearch("");
      
      // Add the new classroom to the existing list to avoid refetching
      setClassrooms(prev => [data.data, ...prev]);
      
    } catch (error: any) {
      console.error('❌ Error creando aula virtual:', error);
      toast.error(`Error al crear el aula virtual: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Aulas Virtuales</h1>
            <p className="text-muted-foreground">
              Gestiona las aulas virtuales y sus cursos asociados
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => fetchClassrooms(true)}
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            
            {(profile?.role === 'admin' || profile?.role === 'teacher') && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Aula Virtual
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader className="pb-4">
                  <DialogTitle className="text-2xl">Crear Nueva Aula Virtual</DialogTitle>
                  <DialogTitle>Crear Nueva Aula Virtual</DialogTitle>
                  <DialogDescription className="text-base">
                    Complete los datos para crear una nueva aula virtual. Las semanas se generarán automáticamente basadas en las fechas del calendario académico.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateClassroom} className="space-y-6">
                  <div className="space-y-5 bg-muted/30 p-6 rounded-lg">
                    <h3 className="text-base font-semibold text-primary">Información Básica</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name" className="text-base">Nombre del Aula *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ej: Aula 1ro A"
                          required
                          className="h-11 text-base"
                        />
                      </div>
                    
                      <div>
                        <Label htmlFor="academic_year" className="text-base">Año Académico *</Label>
                        <Input
                          id="academic_year"
                          value={formData.academic_year}
                          onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                          placeholder="2024"
                          required
                          className="h-11 text-base"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="education_level" className="text-base">Nivel Educativo *</Label>
                        <Select 
                          value={formData.education_level} 
                          onValueChange={(value: 'primaria' | 'secundaria') => 
                            setFormData({ ...formData, education_level: value, grade: '' })
                          }
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Seleccionar nivel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primaria">Primaria</SelectItem>
                            <SelectItem value="secundaria">Secundaria</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.education_level && (
                        <div>
                          <Label htmlFor="grade" className="text-base">Grado *</Label>
                        <Select 
                          value={formData.grade} 
                          onValueChange={(value) => setFormData({ ...formData, grade: value })}
                        >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Seleccionar grado" />
                            </SelectTrigger>
                            <SelectContent>
                              {grades[formData.education_level].map((grade) => (
                                <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="section" className="text-base">Sección *</Label>
                      <Input
                        id="section"
                        value={formData.section}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          // Solo permitir una letra de A-Z
                          if (value === '' || /^[A-Z]$/.test(value)) {
                            setFormData({ ...formData, section: value });
                          }
                        }}
                        placeholder="A"
                        maxLength={1}
                        required
                        className="h-11 text-base text-center text-lg font-semibold"
                      />
                      <p className="text-sm text-muted-foreground mt-1.5">
                        Ingresa una letra de A a Z
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="space-y-5 bg-muted/30 p-6 rounded-lg">
                      <h3 className="text-base font-semibold text-primary">Responsables</h3>
                      
                      <div>
                        <Label htmlFor="teacher" className="text-base">Profesor Asignado *</Label>
                        <p className="text-sm text-muted-foreground mb-2">Busca y selecciona el profesor responsable</p>
                        <Popover open={teacherOpen} onOpenChange={setTeacherOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={teacherOpen}
                              className="w-full justify-between h-11"
                            >
                              {formData.teacher_principal_id
                                ? teachers.find((teacher) => teacher.id === formData.teacher_principal_id)
                                    ? `${teachers.find((teacher) => teacher.id === formData.teacher_principal_id)?.first_name} ${teachers.find((teacher) => teacher.id === formData.teacher_principal_id)?.last_name}`
                                    : "Seleccionar profesor"
                                : "Seleccionar profesor"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput 
                                placeholder="Buscar profesor..." 
                                value={teacherSearch}
                                onValueChange={setTeacherSearch}
                              />
                              <CommandList>
                                <CommandEmpty>No se encontraron profesores.</CommandEmpty>
                                <CommandGroup>
                                  {teachers.map((teacher) => (
                                    <CommandItem
                                      key={teacher.id}
                                      value={`${teacher.first_name} ${teacher.last_name} ${teacher.email}`}
                                      onSelect={() => {
                                        setFormData({ ...formData, teacher_principal_id: teacher.id });
                                        setTeacherOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.teacher_principal_id === teacher.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{teacher.first_name} {teacher.last_name}</span>
                                        <span className="text-xs text-muted-foreground">{teacher.email}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label htmlFor="tutor" className="text-base">Tutor (Opcional)</Label>
                        <p className="text-sm text-muted-foreground mb-2">Busca y selecciona un tutor si deseas asignarlo</p>
                        <Popover open={tutorOpen} onOpenChange={setTutorOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={tutorOpen}
                              className="w-full justify-between h-11"
                            >
                              {formData.tutor_id
                                ? tutors.find((tutor) => tutor.id === formData.tutor_id)
                                    ? `${tutors.find((tutor) => tutor.id === formData.tutor_id)?.first_name} ${tutors.find((tutor) => tutor.id === formData.tutor_id)?.last_name}`
                                    : "Sin tutor asignado"
                                : "Sin tutor asignado"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput 
                                placeholder="Buscar tutor..." 
                                value={tutorSearch}
                                onValueChange={setTutorSearch}
                              />
                              <CommandList>
                                <CommandEmpty>No se encontraron tutores.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="none"
                                    onSelect={() => {
                                      setFormData({ ...formData, tutor_id: "" });
                                      setTutorOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        !formData.tutor_id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    Sin tutor
                                  </CommandItem>
                                  {tutors.map((tutor) => (
                                    <CommandItem
                                      key={tutor.id}
                                      value={`${tutor.first_name} ${tutor.last_name} ${tutor.email}`}
                                      onSelect={() => {
                                        setFormData({ ...formData, tutor_id: tutor.id });
                                        setTutorOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.tutor_id === tutor.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{tutor.first_name} {tutor.last_name}</span>
                                        <span className="text-xs text-muted-foreground">{tutor.email}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  <div className="space-y-5 bg-muted/30 p-6 rounded-lg">
                    <div>
                      <h3 className="text-base font-semibold text-primary">Calendario Académico</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Define el periodo del año académico. Las semanas se generarán automáticamente para todos los cursos.
                      </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_date" className="text-base">Fecha de Inicio *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-11",
                              !formData.start_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.start_date ? format(formData.start_date, "PPP") : "Seleccionar fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.start_date}
                            onSelect={(date) => setFormData({ ...formData, start_date: date })}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      </div>

                      <div>
                        <Label htmlFor="end_date" className="text-base">Fecha de Fin *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-11",
                              !formData.end_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.end_date ? format(formData.end_date, "PPP") : "Seleccionar fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.end_date}
                            onSelect={(date) => setFormData({ ...formData, end_date: date })}
                            disabled={(date) => formData.start_date ? date < formData.start_date : false}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="h-11 px-6"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit"
                      disabled={isCreating || !formData.name || !formData.education_level || !formData.grade || !formData.section || !formData.start_date || !formData.end_date}
                      className="h-11 px-6"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        'Crear Aula Virtual'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : classrooms.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">No hay aulas virtuales disponibles</p>
            </div>
          ) : (
            classrooms.map((classroom) => (
              <Card key={classroom.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        {classroom.name}
                      </CardTitle>
                      <CardDescription>
                        {classroom.education_level === 'primaria' ? 'Primaria' : 'Secundaria'} - {classroom.grade}{classroom.section}
                      </CardDescription>
                    </div>
                    <Badge variant={classroom.is_active ? "default" : "secondary"}>
                      {classroom.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Año Académico:</span>
                    <span className="font-medium">{classroom.academic_year}</span>
                  </div>
                  
                  {classroom.teacher && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Profesor:</span>
                      <span className="font-medium">{classroom.teacher.first_name} {classroom.teacher.last_name}</span>
                    </div>
                  )}
                  
                  {classroom.tutor && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tutor:</span>
                      <span className="font-medium">{classroom.tutor.first_name} {classroom.tutor.last_name}</span>
                    </div>
                  )}
                  
                  <div className="flex gap-4 pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span>{classroom.courses_count || 0} cursos</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{classroom.students_count || 0} estudiantes</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  {profile?.role === 'student' ? (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => navigate(`/virtual-classrooms/${classroom.id}/courses`)}
                    >
                      Ver Cursos
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => navigate(`/virtual-classrooms/${classroom.id}`)}
                      >
                        Ver Detalles
                      </Button>
                      {(profile?.role === 'admin' || profile?.role === 'teacher') && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingClassroom(classroom)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingClassroom(classroom)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>

      {editingClassroom && (
        <EditClassroomDialog
          classroom={editingClassroom}
          teachers={teachers}
          tutors={tutors}
          open={!!editingClassroom}
          onOpenChange={(open) => {
            if (!open) setEditingClassroom(null);
          }}
          onSuccess={() => {
            setEditingClassroom(null);
            fetchClassrooms(true);
          }}
          isAdmin={isAdmin}
        />
      )}

      {deletingClassroom && (
        <DeleteClassroomDialog
          classroom={deletingClassroom}
          open={!!deletingClassroom}
          onOpenChange={(open) => {
            if (!open) setDeletingClassroom(null);
          }}
          onSuccess={() => {
            setDeletingClassroom(null);
            fetchClassrooms(true);
          }}
        />
      )}
    </DashboardLayout>
  );
}
