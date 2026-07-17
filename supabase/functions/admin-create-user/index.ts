import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Método no permitido. Solo POST." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the admin token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Token requerido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "No autorizado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["admin", "directivo"].includes(profile.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Solo administradores pueden crear usuarios" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Parse body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "JSON inválido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { email, password, first_name, last_name, role, phone, current_grade_id, guardian_name, emergency_phone } = body;

    if (!email || !password || !first_name || !last_name || !role) {
      return new Response(
        JSON.stringify({ success: false, error: "Campos requeridos: email, password, first_name, last_name, role" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const validRoles = ["admin", "teacher", "student", "parent", "tutor", "directivo"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Rol inválido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Crear usuario en Auth con Admin API (sin rate limits, email_confirm=true)
    console.log(`🆕 Creando usuario: ${email} con rol ${role}`);
    const { data: authData, error: authError2 } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, role },
    });

    if (authError2) {
      if (authError2.message?.includes("already") || authError2.message?.includes("exists")) {
        return new Response(
          JSON.stringify({ success: false, error: "Ya existe un usuario con ese email" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
      console.error("❌ Error creando usuario auth:", authError2);
      return new Response(
        JSON.stringify({ success: false, error: authError2.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const userId = authData.user.id;
    console.log(`✅ Usuario auth creado: ${userId}`);

    // 2. Esperar trigger y actualizar profile
    await new Promise((r) => setTimeout(r, 500));

    // Buscar el profile creado por el trigger
    let profileId: string | null = null;
    for (let i = 0; i < 10; i++) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (p) {
        profileId = p.id;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!profileId) {
      return new Response(
        JSON.stringify({ success: false, error: "El perfil no se creó automáticamente" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // 3. Actualizar profile con datos completos
    const updateData: Record<string, unknown> = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      role,
      phone: phone?.trim() || null,
      is_active: true,
    };

    if (role === "student") {
      updateData.current_grade_id = current_grade_id || null;
      updateData.guardian_name = guardian_name?.trim() || null;
      updateData.emergency_phone = emergency_phone?.trim() || null;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", profileId);

    if (updateError) {
      console.error("❌ Error actualizando profile:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`✅ Usuario ${email} creado y perfil actualizado exitosamente`);
    return new Response(
      JSON.stringify({
        success: true,
        data: { user_id: userId, profile_id: profileId },
        message: `Usuario ${first_name} ${last_name} creado correctamente.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 201 }
    );

  } catch (error) {
    console.error("💥 Error en admin-create-user:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Error interno",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
