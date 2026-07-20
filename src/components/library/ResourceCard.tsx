import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LibraryResource } from '@/services/libraryService';
import { FileText, Video, Link as LinkIcon, FileImage, File, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ResourceCardProps {
  resource: LibraryResource;
  onDelete?: (id: string, fileUrl: string) => void;
  canDelete?: boolean;
}

export function ResourceCard({ resource, onDelete, canDelete = false }: ResourceCardProps) {
  const getIcon = () => {
    switch (resource.resource_type) {
      case 'pdf': return <FileText className="w-8 h-8 text-red-500" />;
      case 'video': return <Video className="w-8 h-8 text-blue-500" />;
      case 'link': return <LinkIcon className="w-8 h-8 text-green-500" />;
      case 'image': return <FileImage className="w-8 h-8 text-yellow-500" />;
      default: return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const getBadgeColor = (level: string | null) => {
    switch (level) {
      case 'Inicial': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'Primaria': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Secundaria': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const handleAction = () => {
    window.open(resource.file_url, '_blank');
  };

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow group relative">
      <CardContent className="p-5 flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            {getIcon()}
          </div>
          {canDelete && (
            <button
              onClick={() => onDelete?.(resource.id, resource.file_url)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Eliminar recurso"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <h3 className="font-semibold text-lg line-clamp-2 mb-2" title={resource.title}>
          {resource.title}
        </h3>
        
        {resource.description && (
          <p className="text-sm text-gray-600 line-clamp-3 mb-4">
            {resource.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-auto">
          {resource.education_level && (
            <Badge variant="outline" className={getBadgeColor(resource.education_level)}>
              {resource.education_level}
            </Badge>
          )}
          {resource.grade && (
            <Badge variant="secondary" className="text-xs">
              {resource.grade}
            </Badge>
          )}
          {resource.classroom && (
            <Badge variant="secondary" className="text-xs bg-slate-100">
              {resource.classroom.name}
            </Badge>
          )}
          {resource.subject && (
            <Badge variant="outline" className="text-xs">
              {resource.subject}
            </Badge>
          )}
        </div>
      </CardContent>

      <div className="px-5 pb-3">
        <div className="text-xs text-gray-500 mb-3 flex justify-between items-center">
          <span className="truncate max-w-[150px]">
            {resource.uploader ? `${resource.uploader.first_name} ${resource.uploader.last_name}` : 'Admin'}
          </span>
          <span>
            {formatDistanceToNow(new Date(resource.created_at), { addSuffix: true, locale: es })}
          </span>
        </div>
      </div>

      <CardFooter className="p-5 pt-0 mt-auto">
        <Button 
          className="w-full gap-2" 
          variant={resource.resource_type === 'link' ? "secondary" : "default"}
          onClick={handleAction}
        >
          {resource.resource_type === 'link' ? <LinkIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          {resource.resource_type === 'link' ? 'Abrir enlace' : 'Ver / Descargar'}
        </Button>
        {resource.file_size && (
          <span className="absolute bottom-2 right-2 text-[10px] text-gray-400 font-medium">
            {formatSize(resource.file_size)}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
