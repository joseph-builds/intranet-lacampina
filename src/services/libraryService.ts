import { supabase } from '@/integrations/supabase/client';

export interface LibraryResource {
  id: string;
  title: string;
  description: string | null;
  resource_type: 'pdf' | 'video' | 'link' | 'document' | 'image' | 'other';
  education_level: 'Inicial' | 'Primaria' | 'Secundaria' | null;
  grade: string | null;
  classroom_id: string | null;
  subject: string | null;
  file_url: string;
  file_size: number | null;
  uploaded_by: string;
  is_active: boolean;
  created_at: string;
  uploader?: {
    first_name: string;
    last_name: string;
  };
  classroom?: {
    name: string;
    grade: string;
  };
}

export interface LibraryFilters {
  searchQuery?: string;
  education_level?: string;
  grade?: string;
  classroom_id?: string;
  resource_type?: string;
}

export const fetchLibraryResources = async (
  filters: LibraryFilters,
  page: number = 1,
  limit: number = 20
): Promise<{ data: LibraryResource[]; count: number }> => {
  try {
    let query = supabase
      .from('library_resources')
      .select(`
        *,
        uploader:profiles!library_resources_uploaded_by_fkey(first_name, last_name),
        classroom:virtual_classrooms!library_resources_classroom_id_fkey(name, grade)
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.searchQuery) {
      query = query.or(`title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%,subject.ilike.%${filters.searchQuery}%,education_level.ilike.%${filters.searchQuery}%,grade.ilike.%${filters.searchQuery}%`);
    }
    if (filters.education_level && filters.education_level !== 'all') {
      query = query.eq('education_level', filters.education_level);
    }
    if (filters.grade && filters.grade !== 'all') {
      query = query.eq('grade', filters.grade);
    }
    if (filters.classroom_id && filters.classroom_id !== 'all') {
      query = query.eq('classroom_id', filters.classroom_id);
    }
    if (filters.resource_type && filters.resource_type !== 'all') {
      query = query.eq('resource_type', filters.resource_type);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return { 
      data: (data as any) || [], 
      count: count || 0 
    };
  } catch (error) {
    console.error('Error in fetchLibraryResources:', error);
    throw error;
  }
};

export const deleteLibraryResource = async (id: string, fileUrl: string): Promise<void> => {
  try {
    // 1. Delete from DB
    const { error: dbError } = await supabase
      .from('library_resources')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    // 2. Delete from Storage if it's a Supabase storage URL
    // Format is typically: /storage/v1/object/public/library/filename.pdf
    if (fileUrl.includes('/storage/v1/object/public/library/')) {
      const fileName = fileUrl.split('/storage/v1/object/public/library/')[1];
      if (fileName) {
        const { error: storageError } = await supabase.storage
          .from('library')
          .remove([fileName]);
          
        if (storageError) {
          console.error("Warning: Could not delete file from storage:", storageError);
          // We don't throw here to ensure the UI updates, but log it.
        }
      }
    }
  } catch (error) {
    console.error('Error deleting resource:', error);
    throw error;
  }
};

export const uploadLibraryResource = async (
  data: Partial<LibraryResource>,
  file?: File
): Promise<LibraryResource> => {
  try {
    let fileUrl = data.file_url || '';
    let fileSize = data.file_size || 0;

    // If there's a file, upload it to Storage
    if (file) {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('library')
        .upload(uniqueFileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Error al subir archivo: ${uploadError.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('library')
        .getPublicUrl(uploadData.path);
        
      fileUrl = publicUrlData.publicUrl;
      fileSize = file.size;
    }

    // Insert into DB
    const insertData = {
      title: data.title,
      description: data.description,
      resource_type: data.resource_type,
      education_level: data.education_level || null,
      grade: data.grade || null,
      classroom_id: data.classroom_id || null,
      subject: data.subject || null,
      file_url: fileUrl,
      file_size: fileSize > 0 ? fileSize : null,
      uploaded_by: data.uploaded_by,
      is_active: true
    };

    const { data: insertedData, error: dbError } = await supabase
      .from('library_resources')
      .insert([insertData])
      .select()
      .single();

    if (dbError) {
      // If DB fails but file was uploaded, try to clean up
      if (file && fileUrl) {
        const fileName = fileUrl.split('/storage/v1/object/public/library/')[1];
        if (fileName) {
          await supabase.storage.from('library').remove([fileName]);
        }
      }
      throw dbError;
    }

    return insertedData as LibraryResource;
  } catch (error) {
    console.error('Error uploading resource:', error);
    throw error;
  }
};
