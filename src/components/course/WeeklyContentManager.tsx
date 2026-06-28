import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CourseWeeklySection } from './CourseWeeklySection';
import { SectionForm } from './SectionForm';

interface WeeklyResource {
  id: string;
  title: string;
  description: string;
  resource_type: 'material' | 'exam' | 'link' | 'assignment' | 'video' | 'document';
  resource_url?: string;
  is_published: boolean;
  position: number;
  settings: any;
  assignment_id?: string;
}

interface WeeklySection {
  id: string;
  week_number: number;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_published: boolean;
  position: number;
  resources?: WeeklyResource[];
}

interface WeeklyContentManagerProps {
  courseId: string;
  canEdit: boolean;
}

export function WeeklyContentManager({ courseId, canEdit }: WeeklyContentManagerProps) {
  const [sections, setSections] = useState<WeeklySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSectionForm, setShowSectionForm] = useState(false);

  useEffect(() => {
    fetchSections();
  }, [courseId]);

  const fetchSections = async () => {
    try {
      setLoading(true);

      console.log('📚 Fetching weekly sections for course:', courseId, 'canEdit:', canEdit);

      // Fetch sections with their resources
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('course_weekly_sections')
        .select(`
          *,
          resources:course_weekly_resources(*)
        `)
        .eq('course_id', courseId)
        .order('week_number', { ascending: true });

      if (sectionsError) throw sectionsError;

      console.log('📊 Raw sections data:', sectionsData);

      // Sort resources by position within each section
      const sectionsWithSortedResources = sectionsData?.map(section => ({
        ...section,
        resources: section.resources?.sort((a: any, b: any) => a.position - b.position) || []
      })) || [];

      console.log('📝 Sections with sorted resources:', sectionsWithSortedResources);

      // Filter to show only published sections for students
      const filteredSections = canEdit 
        ? sectionsWithSortedResources 
        : sectionsWithSortedResources.filter(section => section.is_published);

      console.log('✅ Filtered sections (canEdit=' + canEdit + '):', filteredSections);

      setSections(filteredSections as WeeklySection[]);
    } catch (error) {
      console.error('Error fetching sections:', error);
      toast.error('Error al cargar las secciones semanales');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionUpdate = (updatedSection: WeeklySection) => {
    setSections(prev => prev.map(section => 
      section.id === updatedSection.id ? updatedSection : section
    ));
    fetchSections(); // Refresh to get updated resources
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Contenido Semanal</CardTitle>
            </div>
            {canEdit && (
              <Button
                onClick={() => setShowSectionForm(true)}
                className="bg-gradient-primary shadow-glow"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Semana
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Weekly Sections */}
      {sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map((section) => (
            <CourseWeeklySection
              key={section.id}
              section={section}
              courseId={courseId}
              canEdit={canEdit}
              onUpdateSection={handleSectionUpdate}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay contenido semanal
            </h3>
            <p className="text-muted-foreground mb-4">
              {canEdit 
                ? 'Organiza tu curso por semanas para facilitar el aprendizaje de los estudiantes.'
                : 'El profesor aún no ha organizado el contenido por semanas.'
              }
            </p>
            {canEdit && (
              <Button
                onClick={() => setShowSectionForm(true)}
                className="bg-gradient-primary shadow-glow"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Semana
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section Form Modal */}
      {showSectionForm && (
        <SectionForm
          courseId={courseId}
          onClose={() => setShowSectionForm(false)}
          onSuccess={() => {
            setShowSectionForm(false);
            fetchSections();
          }}
        />
      )}
    </div>
  );
}