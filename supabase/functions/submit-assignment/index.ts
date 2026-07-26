import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('No autorizado');
    }

    const requestBody = await req.json().catch(() => ({}));
    const { 
      assignmentTitle, 
      content, 
      files: rawFiles,
      courseId,
      filePath: bodyFilePath,
      fileName: bodyFileName,
      fileSize: bodyFileSize,
      mimeType: bodyMimeType,
      fileUrl: bodyFileUrl
    } = requestBody;

    let filesList = Array.isArray(rawFiles) ? [...rawFiles] : [];
    if (filesList.length === 0 && (bodyFilePath || bodyFileUrl)) {
      filesList.push({
        filePath: bodyFilePath,
        fileName: bodyFileName,
        fileSize: bodyFileSize,
        mimeType: bodyMimeType,
        fileUrl: bodyFileUrl,
        file_path: bodyFilePath,
        file_name: bodyFileName,
        file_size: bodyFileSize,
        mime_type: bodyMimeType,
        file_url: bodyFileUrl
      });
    }

    // Store first file in legacy fields for backwards compatibility
    const firstFile = filesList.length > 0 ? filesList[0] : null;
    
    // Store all files in student_files JSON array
    const studentFiles = filesList.map((file: any) => ({
      file_path: file.file_path || file.filePath,
      file_name: file.file_name || file.fileName,
      file_size: Number(file.file_size ?? file.fileSize ?? 0),
      mime_type: file.mime_type || file.mimeType,
      file_url: file.file_url || file.fileUrl,
      filePath: file.file_path || file.filePath,
      fileName: file.file_name || file.fileName,
      fileSize: Number(file.file_size ?? file.fileSize ?? 0),
      mimeType: file.mime_type || file.mimeType,
      fileUrl: file.file_url || file.fileUrl
    }));

    const firstFilePath = firstFile?.file_path || firstFile?.filePath || null;
    const firstFileName = firstFile?.file_name || firstFile?.fileName || null;
    const firstFileSize = Number(firstFile?.file_size ?? firstFile?.fileSize ?? 0);
    const firstMimeType = firstFile?.mime_type || firstFile?.mimeType || null;
    const firstFileUrl = firstFile?.file_url || firstFile?.fileUrl || null;

    console.log('Submitting assignment for user:', user.id);

    // Get student profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Perfil no encontrado');
    }

    // Check if assignment already exists
    let assignmentId;
    const { data: existingAssignment } = await supabaseClient
      .from('assignments')
      .select('id')
      .eq('title', assignmentTitle)
      .eq('modulo_id', courseId)
      .maybeSingle();

    if (existingAssignment) {
      assignmentId = existingAssignment.id;
    } else {
      // Create assignment using service role (bypasses RLS)
      const { data: newAssignment, error: assignmentError } = await supabaseClient
        .from('assignments')
        .insert({
          title: assignmentTitle,
          description: `Tarea: ${assignmentTitle}`,
          max_score: 100,
          modulo_id: courseId,
          is_published: true
        })
        .select()
        .single();

      if (assignmentError) {
        console.error('Error creating assignment:', assignmentError);
        throw new Error('Error al crear la tarea');
      }
      assignmentId = newAssignment.id;
    }

    // Create submission with user's auth (RLS allows students to create their own submissions)
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { error: submissionError } = await userSupabase
      .from('assignment_submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: profile.id,
        content: content || null,
        file_path: firstFilePath,
        file_name: firstFileName,
        file_size: firstFileSize,
        mime_type: firstMimeType,
        file_url: firstFileUrl,
        student_files: studentFiles
      });

    if (submissionError) {
      console.error('Error creating submission:', submissionError);
      throw new Error('Error al crear la entrega');
    }

    return new Response(
      JSON.stringify({ success: true, assignmentId }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});