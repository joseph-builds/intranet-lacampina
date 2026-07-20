import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LibraryResource, fetchLibraryResources, deleteLibraryResource, LibraryFilters } from '@/services/libraryService';
import { ResourceCard } from '@/components/library/ResourceCard';
import { UploadResourceModal } from '@/components/library/UploadResourceModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Search, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';

export default function Library() {
  const { profile } = useAuth();
  
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [filters, setFilters] = useState<LibraryFilters>({
    searchQuery: '',
    education_level: 'all',
    grade: 'all',
    resource_type: 'all'
  });
  
  // Debounce search
  const [debouncedFilters, setDebouncedFilters] = useState<LibraryFilters>(filters);
  const [initialFilterLoaded, setInitialFilterLoaded] = useState(false);

  useEffect(() => {
    const fetchStudentGrade = async () => {
      if (!profile) return;
      
      if (profile.role === 'student') {
        try {
          // Primero intentamos buscar por student_sections (para colegios con secciones)
          const { data: sectionData } = await supabase
            .from('student_sections')
            .select('section:sections(grade:academic_grades(name, level:academic_levels(name)))')
            .eq('student_id', profile.id)
            .eq('is_active', true)
            .limit(1);

          if (sectionData && sectionData[0]?.section?.grade) {
            const gradeName = sectionData[0].section.grade.name;
            const levelName = sectionData[0].section.grade.level?.name;
            setFilters(prev => ({...prev, grade: gradeName, education_level: levelName || prev.education_level}));
            setInitialFilterLoaded(true);
            return;
          }

          // Si no, buscamos por course_enrollments y virtual_classrooms
          const { data: enrollments } = await supabase
            .from('course_enrollments')
            .select('course:courses(classroom:virtual_classrooms(grade, education_level))')
            .eq('student_id', profile.id)
            .eq('is_active', true)
            .limit(1);
            
          if (enrollments && enrollments[0]?.course?.classroom) {
            const { grade, education_level } = enrollments[0].course.classroom;
            setFilters(prev => ({...prev, grade: grade || 'all', education_level: education_level || 'all'}));
          }
        } catch (err) {
          console.error("Error fetching student grade:", err);
        }
      }
      setInitialFilterLoaded(true);
    };

    if (!initialFilterLoaded) {
      fetchStudentGrade();
    }
  }, [profile, initialFilterLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    if (profile?.role === 'student' && !initialFilterLoaded) return;
    setPage(1);
    loadResources(1, debouncedFilters, true);
  }, [debouncedFilters, initialFilterLoaded, profile]);

  const loadResources = async (pageNum: number, currentFilters: LibraryFilters, isNewSearch: boolean = false) => {
    try {
      setLoading(true);
      const { data, count } = await fetchLibraryResources(currentFilters, pageNum);
      
      if (isNewSearch) {
        setResources(data);
      } else {
        setResources(prev => [...prev, ...data]);
      }
      
      setTotalCount(count);
      setHasMore(data.length === 20 && (isNewSearch ? data.length : resources.length + data.length) < count);
    } catch (error) {
      console.error('Error loading resources:', error);
      toast.error('Error al cargar la biblioteca');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadResources(nextPage, debouncedFilters, false);
  };

  const handleUploadSuccess = (newResource: LibraryResource) => {
    toast.success('Recurso publicado exitosamente');
    // Reload from start to show new resource at top
    setPage(1);
    loadResources(1, debouncedFilters, true);
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este recurso permanentemente?')) {
      return;
    }
    
    try {
      await deleteLibraryResource(id, fileUrl);
      toast.success('Recurso eliminado');
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      toast.error('Error al eliminar el recurso');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-800">Biblioteca Virtual</h1>
              <p className="text-gray-500 mt-1">
                Explora materiales educativos, guías y recursos de aprendizaje.
              </p>
            </div>
          </div>
          
          {(profile?.role === 'admin' || profile?.role === 'teacher') && (
            <Button onClick={() => setIsUploadModalOpen(true)} className="gap-2 shadow-md hover:shadow-lg transition-all">
              <Plus className="w-5 h-5" />
              Subir Recurso
            </Button>
          )}
        </div>

        {/* Filters Section */}
        <div className="bg-white p-4 rounded-xl shadow-sm border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Buscar título..." 
              className="pl-9"
              value={filters.searchQuery}
              onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
            />
          </div>
          
          <Select value={filters.education_level} onValueChange={(v) => setFilters({...filters, education_level: v})}>
            <SelectTrigger>
              <SelectValue placeholder="Nivel Educativo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Niveles</SelectItem>
              <SelectItem value="Inicial">Inicial</SelectItem>
              <SelectItem value="Primaria">Primaria</SelectItem>
              <SelectItem value="Secundaria">Secundaria</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.grade} onValueChange={(v) => setFilters({...filters, grade: v})}>
            <SelectTrigger>
              <SelectValue placeholder="Grado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Grados</SelectItem>
              <SelectItem value="1ro">1ro</SelectItem>
              <SelectItem value="2do">2do</SelectItem>
              <SelectItem value="3ro">3ro</SelectItem>
              <SelectItem value="4to">4to</SelectItem>
              <SelectItem value="5to">5to</SelectItem>
              <SelectItem value="6to">6to</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.resource_type} onValueChange={(v) => setFilters({...filters, resource_type: v})}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de Recurso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Tipos</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="document">Documentos</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="image">Imágenes</SelectItem>
              <SelectItem value="link">Enlaces Web</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid of Resources */}
        {resources.length === 0 && !loading ? (
          <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No se encontraron recursos</h3>
            <p className="text-gray-500 max-w-md mx-auto mt-2">
              Intenta cambiar los filtros o realiza una búsqueda diferente.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {resources.map(resource => (
                <ResourceCard 
                  key={resource.id} 
                  resource={resource} 
                  onDelete={handleDelete}
                  canDelete={profile?.role === 'admin' || (profile?.role === 'teacher' && profile?.id === resource.uploaded_by)}
                />
              ))}
            </div>
            
            {/* Loading / Load More */}
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            )}
            
            {!loading && hasMore && (
              <div className="flex justify-center mt-8">
                <Button variant="outline" onClick={loadMore} className="px-8">
                  Cargar más recursos
                </Button>
              </div>
            )}
          </>
        )}

        {/* Upload Modal */}
        {isUploadModalOpen && (
          <UploadResourceModal 
            isOpen={isUploadModalOpen} 
            onClose={() => setIsUploadModalOpen(false)} 
            onSuccess={handleUploadSuccess} 
          />
        )}
      </div>
    </DashboardLayout>
  );
}