import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, School, Users, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface TeacherSection {
  id: string;
  name: string;
  room_number: string;
  grade_name: string;
  level_name: string;
  course_count: number;
}

const TeacherClassrooms = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeacherSections();
  }, [profile]);

  const fetchTeacherSections = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      // Fetch section_courses for this teacher
      const { data, error } = await supabase
        .from('section_courses')
        .select(`
          section_id,
          section:sections (
            id,
            name,
            room_number,
            grade:academic_grades (
              name,
              level:academic_levels (name)
            )
          )
        `)
        .eq('teacher_id', profile.id);

      if (error) throw error;

      // Deduplicate sections and count courses
      const sectionMap = new Map<string, TeacherSection>();

      data?.forEach((item: any) => {
        if (!item.section) return;
        
        const secId = item.section.id;
        if (sectionMap.has(secId)) {
          const existing = sectionMap.get(secId)!;
          existing.course_count++;
        } else {
          sectionMap.set(secId, {
            id: item.section.id,
            name: item.section.name,
            room_number: item.section.room_number || 'No asignado',
            grade_name: item.section.grade?.name || 'Sin grado',
            level_name: item.section.grade?.level?.name || 'Sin nivel',
            course_count: 1
          });
        }
      });

      setSections(Array.from(sectionMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error: any) {
      console.error('Error fetching teacher sections:', error);
      toast.error('Error al cargar las aulas virtuales');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <School className="w-8 h-8 text-primary" />
            Mis Aulas Virtuales
          </h1>
          <p className="text-muted-foreground">
            Aulas donde has sido asignado como docente en el año actual.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : sections.length === 0 ? (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-10 text-center">
              <School className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No tienes aulas asignadas
              </h3>
              <p className="text-muted-foreground">
                El administrador aún no te ha asignado a ningún aula virtual.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sections.map((section) => (
              <Card 
                key={section.id} 
                className="hover:shadow-lg transition-all duration-300 border-t-4 border-t-primary cursor-pointer hover:-translate-y-1"
                onClick={() => navigate(`/teacher/classrooms/${section.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-2xl text-primary">{section.grade_name} "{section.name}"</CardTitle>
                  <CardDescription className="text-sm font-medium">
                    {section.level_name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground bg-slate-50 p-2 rounded-md">
                      <School className="w-4 h-4 text-slate-500" />
                      <span>Aula Fïsica: <strong>{section.room_number}</strong></span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{section.course_count} Cursos asignados</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                        Ver Detalles &rarr;
                      </Button>
                    </div>
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

export default TeacherClassrooms;
