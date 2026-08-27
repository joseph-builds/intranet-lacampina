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
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'El correo electrónico es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente admin para generar el link de recuperación (contiene el token OTP)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generamos el enlace de recuperación para extraer el token OTP
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (linkError || !linkData) {
      console.error('Error generando link:', linkError);
      return new Response(
        JSON.stringify({ error: 'No se pudo generar el código. Verifica que el correo esté registrado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extraemos el token OTP del action_link
    // El action_link tiene el formato: .../auth/v1/verify?token=XXXXXX&type=recovery...
    const actionLink = linkData.properties?.action_link ?? '';
    const urlParams = new URL(actionLink).searchParams;
    const otpToken = urlParams.get('token') ?? '';

    if (!otpToken) {
      return new Response(
        JSON.stringify({ error: 'No se pudo obtener el código de recuperación.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configuración de Brevo
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
    const SMTP_ADMIN_EMAIL = Deno.env.get('SMTP_ADMIN_EMAIL') ?? '';
    const SMTP_SENDER_NAME = Deno.env.get('SMTP_SENDER_NAME') ?? 'Sistema Soporte';

    // Enviamos el correo con el TOKEN para que el usuario lo ingrese en la intranet
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SMTP_SENDER_NAME, email: SMTP_ADMIN_EMAIL },
        to: [{ email: email }],
        subject: 'Código de recuperación - Intranet I.E. 1267 Bicentenario',
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:#1a237e;padding:20px;border-radius:8px 8px 0 0;text-align:center">
              <h1 style="color:white;margin:0">I.E. 1267 Bicentenario</h1>
              <p style="color:#90caf9;margin:5px 0 0">Sistema de Gestión Escolar</p>
            </div>
            <div style="background:white;padding:30px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0">
              <h2 style="color:#1a237e;margin-top:0">Recuperación de Contraseña</h2>
              <p style="color:#555;line-height:1.6">Ingresa el siguiente código en la página de la intranet:</p>
              <div style="background:#f0f4ff;border:2px dashed #1a237e;border-radius:8px;padding:20px;text-align:center;margin:25px 0">
                <p style="margin:0 0 8px;color:#555;font-size:13px">Tu código de seguridad es:</p>
                <span style="font-size:36px;font-weight:bold;color:#1a237e;letter-spacing:8px;font-family:monospace">${otpToken}</span>
                <p style="margin:8px 0 0;color:#888;font-size:12px">Este código expirará en 1 hora</p>
              </div>
              <p style="color:#888;font-size:13px">Si no solicitaste este cambio, ignora este correo.</p>
              <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">
              <p style="color:#aaa;font-size:12px;text-align:center;margin:0">Correo automático de la Intranet I.E. N° 1267 Bicentenario. No respondas este mensaje.</p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      console.error('Error Brevo:', errorBody);
      return new Response(
        JSON.stringify({ error: 'No se pudo enviar el correo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: 'Código de recuperación enviado exitosamente' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
