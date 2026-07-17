import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  Search,
  Mail,
  BookOpen,
  MessageSquare,
  UserPlus,
  GraduationCap,
  School,
} from "lucide-react";

interface Classmate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  student_code: string | null;
  shared_courses: { id: string; name: string; code: string }[];
  shared_classrooms: { id: string; name: string }[];
}

const Classmates = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [classmates, setClassmates] = useState<Classmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (profile?.id) {
      fetchClassmates();
    }
  }, [profile]);

  const fetchClassmates = async () => {
    if (!profile?.id) return;

    try {
      // Step 1: Get all courses the current student is enrolled in
      const { data: myEnrollments, error: enrollError } = await supabase
        .from("course_enrollments")
        .select(`
          modulo_id,
          modulos!course_enrollments_modulo_id_fkey (
            id,
            name,
            code
          )
        `)
        .eq("student_id", profile.id)
        .eq("is_active", true);

      if (enrollError) throw enrollError;

      const myCourseIds = myEnrollments?.map((e) => e.modulo_id) || [];
      if (myCourseIds.length === 0) {
        setLoading(false);
        return;
      }

      // Step 2: Find all students enrolled in the same courses (excluding current user)
      const { data: sameCourseStudents, error: studentsError } = await supabase
        .from("course_enrollments")
        .select(`
          student_id,
          modulo_id,
          student:profiles!course_enrollments_student_id_fkey (
            id,
            first_name,
            last_name,
            email,
            avatar_url,
            student_code
          ),
          course:modulos!course_enrollments_modulo_id_fkey (
            id,
            name,
            code
          )
        `)
        .in("modulo_id", myCourseIds)
        .neq("student_id", profile.id)
        .eq("is_active", true);

      if (studentsError) throw studentsError;

      // Step 3: Aggregate by student, collecting shared courses
      const classmatesMap = new Map<string, Classmate>();

      sameCourseStudents?.forEach((enrollment) => {
        if (!enrollment.student) return;
        const student = enrollment.student as any;
        const course = enrollment.course as any;

        if (!classmatesMap.has(student.id)) {
          classmatesMap.set(student.id, {
            id: student.id,
            first_name: student.first_name || "",
            last_name: student.last_name || "",
            email: student.email || "",
            avatar_url: student.avatar_url || null,
            student_code: student.student_code || null,
            shared_courses: [],
            shared_classrooms: [],
          });
        }

        const classmate = classmatesMap.get(student.id)!;
        if (!classmate.shared_courses.find((c) => c.id === course.id)) {
          classmate.shared_courses.push({
            id: course.id,
            name: course.name,
            code: course.code,
          });
        }
      });

      setClassmates(Array.from(classmatesMap.values()));
    } catch (error) {
      console.error("Error fetching classmates:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClassmates = classmates.filter((cm) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cm.first_name.toLowerCase().includes(query) ||
      cm.last_name.toLowerCase().includes(query) ||
      `${cm.first_name} ${cm.last_name}`.toLowerCase().includes(query) ||
      cm.email.toLowerCase().includes(query) ||
      cm.shared_courses.some((c) => c.name.toLowerCase().includes(query))
    );
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary animate-pulse" />
            <h1 className="text-3xl font-bold text-foreground">Compañeros</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-gradient-card shadow-card border-0">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-muted rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Compañeros</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {classmates.length > 0
                  ? `Tienes ${classmates.length} compañero${classmates.length !== 1 ? "s" : ""} en tus cursos`
                  : "Conéctate con tus compañeros de clase"}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar compañeros por nombre, email o curso..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 bg-gradient-card border-2 border-input focus:border-primary transition-all duration-200 rounded-xl"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{classmates.length}</p>
                <p className="text-xs text-muted-foreground">Total compañeros</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <BookOpen className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {new Set(classmates.flatMap((cm) => cm.shared_courses.map((c) => c.id))).size}
                </p>
                <p className="text-xs text-muted-foreground">Cursos en común</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <School className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {filteredClassmates.length !== classmates.length
                    ? `${filteredClassmates.length} de ${classmates.length}`
                    : classmates.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? "Compañeros filtrados" : "En tu red"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Classmates Grid */}
        {classmates.length === 0 ? (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-8 text-center">
              <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay compañeros aún
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Aún no tienes compañeros en tus cursos. Cuando estés inscrito en cursos con otros estudiantes, aparecerán aquí.
              </p>
            </CardContent>
          </Card>
        ) : filteredClassmates.length === 0 ? (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-8 text-center">
              <Search className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Sin resultados
              </h3>
              <p className="text-muted-foreground">
                No se encontraron compañeros que coincidan con "{searchQuery}".
              </p>
              <Button variant="outline" onClick={() => setSearchQuery("")} className="mt-4">
                Limpiar búsqueda
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClassmates.map((classmate) => (
              <Card
                key={classmate.id}
                className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all duration-300 group"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Avatar className="w-14 h-14 border-2 border-primary/20 group-hover:border-primary/40 transition-all duration-300">
                      <AvatarImage src={classmate.avatar_url || ""} alt={`${classmate.first_name} ${classmate.last_name}`} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-lg">
                        {getInitials(classmate.first_name, classmate.last_name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {classmate.first_name} {classmate.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        {classmate.email}
                      </p>
                      {classmate.student_code && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          Código: {classmate.student_code}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Shared Courses */}
                  {classmate.shared_courses.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        Cursos en común ({classmate.shared_courses.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {classmate.shared_courses.slice(0, 3).map((course) => (
                          <Badge
                            key={course.id}
                            variant="secondary"
                            className="text-xs bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
                            onClick={() => navigate(`/courses/${course.id}`)}
                          >
                            {course.code || course.name}
                          </Badge>
                        ))}
                        {classmate.shared_courses.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{classmate.shared_courses.length - 3} más
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs h-8"
                      onClick={() => navigate(`/messages`)}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Mensaje
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 text-xs h-8 bg-gradient-primary shadow-glow opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      onClick={() => navigate(`/student/${classmate.id}`)}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Ver perfil
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}


      </div>
    </DashboardLayout>
  );
};

export default Classmates;
