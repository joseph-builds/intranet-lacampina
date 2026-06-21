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

  // Accept both GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método no permitido. Use GET o POST.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('Error de autenticación:', userError?.message || 'Usuario no encontrado')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Sesión expirada o no válida. Por favor, inicie sesión nuevamente.',
          code: 'UNAUTHORIZED'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 401 
        }
      )
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, id')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      throw new Error('Error al obtener el perfil del usuario')
    }

    // Build the query based on user role (sin JOIN problemático)
    let query = supabaseClient
      .from('virtual_classrooms')
      .select(`
        id,
        name,
        grade,
        education_level,
        academic_year,
        section,
        teacher_id,
        tutor_id,
        is_active,
        created_at
      `)
      .order('created_at', { ascending: false })

    // If user is a teacher, only show their classrooms
    if (profile.role === 'teacher') {
      query = query.eq('teacher_id', profile.id)
    }

    const { data: classrooms, error: classroomsError } = await query

    if (classroomsError) {
      throw classroomsError
    }

    // Optimized: Get all data with fewer queries
    console.log('📊 Optimizando consultas para mejor rendimiento...')
    
    // Get all unique teacher and tutor IDs
    const teacherIds = [...new Set(classrooms.map(c => c.teacher_id).filter(Boolean))]
    const tutorIds = [...new Set(classrooms.map(c => c.tutor_id).filter(Boolean))]
    const allProfileIds = [...new Set([...teacherIds, ...tutorIds])]
    
    // Get all teachers and tutors in one query
    let profilesMap = new Map()
    if (allProfileIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', allProfileIds)
      
      if (!profilesError && profiles) {
        profiles.forEach(profile => {
          profilesMap.set(profile.id, profile)
        })
      }
    }

    // Get all classroom IDs
    const classroomIds = classrooms.map(c => c.id)
    
    // Get all courses for all classrooms in one query
    let coursesMap = new Map()
    let courseIds: string[] = []
    if (classroomIds.length > 0) {
      const { data: courses, error: coursesError } = await supabaseClient
        .from('courses')
        .select('id, classroom_id')
        .in('classroom_id', classroomIds)
      
      if (!coursesError && courses) {
        courses.forEach(course => {
          courseIds.push(course.id)
          const classroomCourses = coursesMap.get(course.classroom_id) || []
          classroomCourses.push(course)
          coursesMap.set(course.classroom_id, classroomCourses)
        })
      }
    }

    // Get all enrollments for all courses in one query
    let enrollmentsMap = new Map()
    if (courseIds.length > 0) {
      const { data: enrollments, error: enrollmentsError } = await supabaseClient
        .from('course_enrollments')
        .select('modulo_id, student_id')
        .in('modulo_id', courseIds)
      
      if (!enrollmentsError && enrollments) {
        enrollments.forEach(enrollment => {
          const courseEnrollments = enrollmentsMap.get(enrollment.modulo_id) || []
          courseEnrollments.push(enrollment)
          enrollmentsMap.set(enrollment.modulo_id, courseEnrollments)
        })
      }
    }

    // Build final data structure
    const classroomsWithCounts = classrooms.map(classroom => {
      const teacher = profilesMap.get(classroom.teacher_id) || null
      const tutor = classroom.tutor_id ? profilesMap.get(classroom.tutor_id) || null : null
      const classroomCourses = coursesMap.get(classroom.id) || []
      const coursesCount = classroomCourses.length
      
      // Count unique students across all courses in this classroom
      const uniqueStudents = new Set()
      classroomCourses.forEach((course: any) => {
        const courseEnrollments = enrollmentsMap.get(course.id) || []
        courseEnrollments.forEach((enrollment: any) => {
          uniqueStudents.add(enrollment.student_id)
        })
      })

      return {
        ...classroom,
        teacher,
        tutor,
        courses_count: coursesCount,
        students_count: uniqueStudents.size
      }
    })

    console.log(`⚡ Consultas optimizadas completadas en mucho menos tiempo`)
    console.log(`📈 Resumen: ${classrooms.length} aulas, ${teacherIds.length} profesores únicos, ${courseIds.length} cursos total`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: classroomsWithCounts,
        user_role: profile.role 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in get-virtual-classrooms function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})