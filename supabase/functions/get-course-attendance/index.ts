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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('No autorizado');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Perfil no encontrado');
    }

    const url = new URL(req.url);
    const modulo_id = url.searchParams.get('modulo_id');
    const start_date = url.searchParams.get('start_date');
    const end_date = url.searchParams.get('end_date');

    if (!modulo_id) {
      throw new Error('modulo_id es requerido');
    }

    console.log('📊 Obteniendo asistencia del curso:', modulo_id);

    // Verify permissions
    if (profile.role === 'teacher') {
      const { data: isTeacher } = await supabaseClient
        .rpc('is_any_course_teacher', { 
          _course_id: modulo_id, 
          _user_id: user.id 
        });

      if (!isTeacher) {
        throw new Error('No tiene permisos para ver este curso');
      }
    } else if (profile.role !== 'admin') {
      throw new Error('No tiene permisos');
    }

    let query = supabaseClient
      .from('attendance')
      .select(`
        id,
        date,
        status,
        notes,
        created_at,
        student:profiles!attendance_student_id_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('modulo_id', modulo_id)
      .order('date', { ascending: false })
      .order('student(last_name)', { ascending: true });

    if (start_date) {
      query = query.gte('date', start_date);
    }
    if (end_date) {
      query = query.lte('date', end_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate statistics
    const totalRecords = data.length;
    const presentCount = data.filter(r => r.status === 'present').length;
    const lateCount = data.filter(r => r.status === 'late').length;
    const absentCount = data.filter(r => r.status === 'absent').length;
    const justifiedCount = data.filter(r => r.status === 'justified').length;

    const stats = {
      total: totalRecords,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      justified: justifiedCount,
      attendance_rate: totalRecords > 0 ? ((presentCount + lateCount) / totalRecords * 100).toFixed(2) : 0,
    };

    console.log('✅ Asistencia obtenida:', data.length, 'registros');

    return new Response(
      JSON.stringify({ records: data, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});