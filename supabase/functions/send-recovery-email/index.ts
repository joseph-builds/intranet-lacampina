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

    // Cliente admin para generar el link de recuperación
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generar el link de recuperación de contraseña
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') ?? 'https://intranet.ie1267bicentenario.edu.pe'}/update-password`,
      }
    });

    if (linkError || !linkData) {
      console.error('Error generando link de recuperación:', linkError);
      return new Response(
        JSON.stringify({ error: 'No se pudo generar el enlace de recuperación. Verifica que el correo esté registrado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recoveryLink = linkData.properties?.action_link;
    if (!recoveryLink) {
      return new Response(
        JSON.stringify({ error: 'No se pudo obtener el enlace de recuperación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configuración de Brevo via API HTTP (sin SMTP, sin problemas de red)
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
    const SMTP_ADMIN_EMAIL = Deno.env.get('SMTP_ADMIN_EMAIL') ?? '';
    const SMTP_SENDER_NAME = Deno.env.get('SMTP_SENDER_NAME') ?? 'Sistema Soporte';

    if (!BREVO_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Configuración de correo incompleta en el servidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Envío del correo via Brevo API REST (puerto 443 HTTPS, nunca bloqueado)
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: SMTP_SENDER_NAME,
          email: SMTP_ADMIN_EMAIL,
        },
        to: [{ email: email }],
        subject: 'Recuperación de contraseña - Intranet I.E. 1267 Bicentenario',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: #1a237e; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">I.E. 1267 Bicentenario</h1>
              <p style="color: #90caf9; margin: 5px 0 0 0; font-size: 14px;">Sistema de Gestión Escolar</p>
            </div>
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <h2 style="color: #1a237e; margin-top: 0;">Recuperación de Contraseña</h2>
              <p style="color: #555; line-height: 1.6;">
                Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en la Intranet Escolar.
              </p>
              <p style="color: #555; line-height: 1.6;">
                Haz clic en el botón de abajo para crear una nueva contraseña. Este enlace expirará en <strong>1 hora</strong>.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${recoveryLink}" 
                   style="background-color: #1a237e; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block;">
                  Restablecer Contraseña
                </a>
              </div>
              <p style="color: #888; font-size: 13px; line-height: 1.5;">
                Si no solicitaste este cambio, puedes ignorar este correo de forma segura. 
                Tu contraseña actual seguirá siendo la misma.
              </p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
              <p style="color: #aaa; font-size: 12px; text-align: center; margin: 0;">
                Este correo fue enviado automáticamente por la Intranet de la I.E. N° 1267 Bicentenario.
                Por favor no respondas a este mensaje.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      console.error('Error de Brevo API:', errorBody);
      return new Response(
        JSON.stringify({ error: 'No se pudo enviar el correo. Intenta nuevamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: 'Correo de recuperación enviado exitosamente' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
