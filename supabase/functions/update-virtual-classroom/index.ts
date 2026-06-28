import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método no permitido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('No autorizado')
    }

    // Get user profile to check permissions
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, id')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Error obteniendo perfil:', profileError)
      throw new Error('Error al obtener el perfil del usuario')
    }

    // Get request body
    const body = await req.json()
    console.log('📥 Request body:', body)
    const { id, name, grade, education_level, academic_year, teacher_id, tutor_id, section, is_active } = body

    // Validate required fields
    if (!id) {
      throw new Error('El ID del aula virtual es requerido')
    }

    // Get existing classroom
    const { data: existingClassroom, error: fetchError } = await supabaseClient
      .from('virtual_classrooms')
      .select('teacher_principal_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error obteniendo aula:', fetchError)
      throw new Error('Aula virtual no encontrada')
    }

    // Check permissions: admin or the classroom teacher
    if (profile.role !== 'admin' && existingClassroom.teacher_principal_id !== profile.id) {
      throw new Error('No tienes permisos para modificar esta aula virtual')
    }

    // Validate section if provided (single uppercase letter A-Z)
    if (section && !/^[A-Z]$/.test(section)) {
      throw new Error('La sección debe ser una sola letra mayúscula (A-Z)')
    }

    // Validate education_level if provided
    if (education_level && !['primaria', 'secundaria'].includes(education_level)) {
      throw new Error('Nivel educativo no válido')
    }

    // Build update object with only provided fields
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (grade !== undefined) updateData.grade = grade
    if (education_level !== undefined) updateData.education_level = education_level
    if (academic_year !== undefined) updateData.academic_year = academic_year
    if (section !== undefined) updateData.section = section
    if (is_active !== undefined) updateData.is_active = is_active
    
    // Only allow admin to change teacher and tutor
    if (teacher_id !== undefined && profile.role === 'admin') {
      updateData.teacher_principal_id = teacher_id
    }
    if (tutor_id !== undefined && profile.role === 'admin') {
      updateData.tutor_id = tutor_id || null  // Allow setting to null
    }

    // Update virtual classroom
    const { data: updatedClassroom, error: updateError } = await supabaseClient
      .from('virtual_classrooms')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        name,
        grade,
        education_level,
        academic_year,
        section,
        teacher_principal_id,
        tutor_id,
        is_active,
        created_at,
        updated_at,
        teacher:profiles!teacher_principal_id(
          id,
          first_name,
          last_name,
          email
        ),
        tutor:profiles!tutor_id(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (updateError) {
      console.error('Error actualizando aula:', updateError)
      throw updateError
    }

    console.log('✅ Aula virtual actualizada exitosamente:', updatedClassroom.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: updatedClassroom,
        message: 'Aula virtual actualizada exitosamente'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in update-virtual-classroom function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || 'Error interno del servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
