import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Método no permitido. Solo se permite GET.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  }

  try {
    // Get the Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    )

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autorización requerido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Verify the JWT token and get user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.error('❌ Error de autenticación:', authError)
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Error obteniendo perfil:', profileError)
      return new Response(
        JSON.stringify({ success: false, error: 'Perfil no encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log(`🔍 Obteniendo cursos para ${profile.role}: ${profile.id}`)

    let coursesData = []

    if (profile.role === 'student') {
      // For students: get courses they are enrolled in
      const { data, error } = await supabaseClient
        .from('course_enrollments')
        .select(`
          enrolled_at,
          course:courses (
            id,
            name,
            description,
            code,
            academic_year,
            is_active,
            created_at,
            teacher:profiles!courses_teacher_principal_id_fkey (
              id,
              first_name,
              last_name,
              email
            ),
            classroom:virtual_classrooms!courses_classroom_id_fkey (
              id,
              name,
              grade,
              education_level
            )
          )
        `)
        .eq('student_id', profile.id)
        .eq('course.is_active', true)
        .order('enrolled_at', { ascending: false })

      if (error) {
        console.error('❌ Error obteniendo cursos del estudiante:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al obtener cursos del estudiante',
            details: error.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Transform the data to include enrollment info
      coursesData = data?.map(enrollment => ({
        ...enrollment.course,
        enrolled_at: enrollment.enrolled_at,
        enrollment_status: 'enrolled'
      })) || []

    } else if (profile.role === 'teacher') {
      // For teachers: get courses they teach (primary or additional)
      
      // Get courses where they are the primary teacher
      const { data: primaryCourses, error: primaryError } = await supabaseClient
        .from('courses')
        .select(`
          *,
          teacher:profiles!courses_teacher_principal_id_fkey (
            id,
            first_name,
            last_name,
            email
          ),
          classroom:virtual_classrooms!courses_classroom_id_fkey (
            id,
            name,
            grade,
            education_level
          ),
          enrollments:course_enrollments (count)
        `)
        .eq('teacher_principal_id', profile.id)
        .eq('is_active', true)

      if (primaryError) {
        console.error('❌ Error obteniendo cursos principales del profesor:', primaryError)
      }

      // Get courses where they are an additional teacher
      const { data: additionalCourses, error: additionalError } = await supabaseClient
        .from('course_teachers')
        .select(`
          course:courses (
            *,
            teacher:profiles!courses_teacher_principal_id_fkey (
              id,
              first_name,
              last_name,
              email
            ),
            classroom:virtual_classrooms!courses_classroom_id_fkey (
              id,
              name,
              grade,
              education_level
            ),
            enrollments:course_enrollments (count)
          )
        `)
        .eq('teacher_id', profile.id)
        .eq('course.is_active', true)

      if (additionalError) {
        console.error('❌ Error obteniendo cursos adicionales del profesor:', additionalError)
      }

      // Combine both arrays and remove duplicates
      const allCourses = [
        ...(primaryCourses || []),
        ...(additionalCourses?.map(ct => ct.course).filter(Boolean) || [])
      ]

      // Remove duplicates based on course id
      const uniqueCourses = allCourses.reduce((acc, course) => {
        if (!acc.find(c => c.id === course.id)) {
          acc.push(course)
        }
        return acc
      }, [] as any[])

      // Sort by created_at
      coursesData = uniqueCourses.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

    } else if (profile.role === 'admin') {
      // For admins: get all courses
      const { data, error } = await supabaseClient
        .from('courses')
        .select(`
          *,
          teacher:profiles!courses_teacher_principal_id_fkey (
            id,
            first_name,
            last_name,
            email
          ),
          classroom:virtual_classrooms!courses_classroom_id_fkey (
            id,
            name,
            grade,
            education_level
          ),
          enrollments:course_enrollments (count)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error obteniendo todos los cursos:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al obtener cursos',
            details: error.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      coursesData = data || []
    } else if (profile.role === 'tutor') {
      // For tutors: get courses from their assigned classroom
      const { data, error } = await supabaseClient
        .from('virtual_classrooms')
        .select(`
          courses (
            *,
            teacher:profiles!courses_teacher_principal_id_fkey (
              id,
              first_name,
              last_name,
              email
            ),
            classroom:virtual_classrooms!courses_classroom_id_fkey (
              id,
              name,
              grade,
              education_level
            ),
            enrollments:course_enrollments (count)
          )
        `)
        .eq('tutor_id', profile.id)

      if (error) {
        console.error('❌ Error obteniendo cursos del tutor:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error al obtener cursos del tutor',
            details: error.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Flatten the structure since we get an array of classrooms, each with an array of courses
      coursesData = data?.flatMap(classroom => classroom.courses) || []
      
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rol de usuario no válido' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    console.log(`✅ Cursos obtenidos para ${profile.role}: ${coursesData.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: coursesData,
        count: coursesData.length,
        user_role: profile.role,
        message: `Cursos obtenidos exitosamente para ${profile.role}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('💥 Error general en get-student-courses:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})