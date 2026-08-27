import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap, AlertCircle, ArrowLeft, Send, KeyRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const { user, profile, loading: authLoading, signIn, signOut } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de vista
  const [isResetMode, setIsResetMode] = useState(false);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  
  // Estados de formularios
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [resetData, setResetData] = useState({ email: '', dni: '', role: '' });

  useEffect(() => {
    setLoginData({ email: '', password: '' });
  }, []);

  // Interceptor de seguridad si la sesión quedó cacheada pero la cuenta está inactiva
  if (user && !authLoading && profile) {
    if (profile.is_active === false) {
      signOut();
      return null; 
    }

    const roleRoutes: Record<string, string> = {
      'parent': '/parent/admin',
      'admin': '/admin/dashboard',
      'directivo': '/directivo-dashboard',
      'tutor': '/tutor-dashboard',
      'teacher': '/',
      'student': '/'
    };
    
    const redirectPath = roleRoutes[profile.role] || '/';
    return <Navigate to={redirectPath} replace />;
  }

  // --- LÓGICA DE INICIO DE SESIÓN NORMAL ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = loginData.email.trim().toLowerCase();

      // 1. Intentamos iniciar sesión con Supabase Auth
      const { error: signInError } = await signIn(cleanEmail, loginData.password);
      if (signInError) throw signInError;

      // 2. BLOQUEO INMEDIATO: Verificamos si la cuenta está activa ANTES de dar la bienvenida
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: postProfile } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('id', session.user.id)
          .single();

        if (postProfile && postProfile.is_active === false) {
          // Si está inactivo, lo sacamos en milisegundos
          await signOut(); 
          setError('Su cuenta ha sido inhabilitada. Por favor, comuníquese con el colegio y un administrador para que le activen su cuenta.');
          setLoading(false);
          return; // ROMPEMOS EL FLUJO: Evita que salga el Toast de Bienvenido.
        }
      }

      // 3. Si todo está correcto y es un usuario activo
      toast({ title: "¡Bienvenido!", description: "Has iniciado sesión correctamente." });

    } catch (err: any) {
      if (err.message === 'Invalid login credentials') {
        setError('El correo o la contraseña son incorrectos.');
      } else {
        setError(err.message || 'Error inesperado al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE RECUPERACIÓN DE CONTRASEÑA ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = resetData.email.trim().toLowerCase();
      const cleanDni = resetData.dni.trim();

      // 1. Verificamos la identidad usando nuestra Función Segura (RPC) en Supabase
      const { error: verifyError } = await supabase.rpc('verify_recovery_data', {
        req_email: cleanEmail,
        req_dni: cleanDni,
        req_role: resetData.role
      });

      // Manejamos los errores exactos que configuramos en SQL
      if (verifyError) {
        if (verifyError.message.includes('DATOS_INCORRECTOS')) {
          throw new Error('Los datos no coinciden. Por favor verifica que tu Correo, DNI y Rol sean los correctos.');
        } else if (verifyError.message.includes('CUENTA_INACTIVA')) {
          throw new Error('Su cuenta ha sido inhabilitada. Comuníquese con la administración del colegio.');
        } else {
          throw new Error('Ocurrió un error al validar su identidad.');
        }
      }

      // 2. Si la validación pasa sin errores, enviamos el correo via nuestra Edge Function personalizada
      const { error: resetError } = await supabase.functions.invoke('send-recovery-email', {
        body: { email: cleanEmail },
      });

      if (resetError) throw new Error('No se pudo enviar el correo de recuperación. Intenta nuevamente.');

      toast({
        title: "¡Correo enviado!",
        description: "Revisa tu bandeja de entrada y haz clic en el enlace para cambiar tu contraseña.",
      });
      
      // Pasamos a la pantalla de confirmación de correo enviado
      setIsResetMode(false);
      setIsOtpMode(true);

    } catch (err: any) {
      setError(err.message || 'Hubo un error al procesar tu solicitud.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: resetData.email.toLowerCase().trim(),
        token: otpCode,
        type: 'recovery'
      });
      if (verifyError) throw verifyError;
      
      toast({
        title: "Código verificado",
        description: "Por favor, ingresa tu nueva contraseña.",
      });
      
      // La sesión se establece, redireccionamos a cambiar contraseña
      window.location.href = '/update-password';
      
    } catch (err: any) {
      setError(err.message || 'Código inválido o expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-glow border-0 transition-all duration-300">
        
        {isOtpMode ? (
          /* --- VISTA: CONFIRMACIÓN DE CORREO ENVIADO --- */
          <>
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="bg-green-100 p-3 rounded-full"><Send className="w-6 h-6 text-green-600" /></div>
              </div>
              <CardTitle className="text-xl font-bold text-foreground">¡Correo enviado!</CardTitle>
              <CardDescription className="text-sm mt-2">
                Hemos enviado un enlace a <strong>{resetData.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 leading-relaxed text-center">
                    📧 Revisa tu bandeja de entrada (o carpeta <strong>spam</strong>) y haz clic en el botón <strong>"Restablecer Contraseña"</strong>.
                  </p>
                </div>
                <p className="text-xs text-gray-400 text-center">El enlace expirará en 1 hora.</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-500 hover:text-gray-800"
                  onClick={() => { setIsOtpMode(false); setIsResetMode(true); setError(null); }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Volver atrás
                </Button>
              </div>
            </CardContent>
          </>
        ) : isResetMode ? (
          /* --- VISTA: OLVIDÉ MI CONTRASEÑA --- */
          <>
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="bg-primary/10 p-3 rounded-full"><Send className="w-6 h-6 text-primary" /></div>
              </div>
              <CardTitle className="text-xl font-bold text-foreground">Recuperar Acceso</CardTitle>
              <CardDescription className="text-sm mt-2">Ingresa tus datos de seguridad para recibir un enlace de recuperación.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription className="font-medium text-xs">{error}</AlertDescription></Alert>
              )}
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label>Correo electrónico registrado</Label>
                  <Input type="email" placeholder="tucorreo@dominio.com" value={resetData.email} onChange={(e) => setResetData(prev => ({ ...prev, email: e.target.value }))} required disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label>Tu número de DNI</Label>
                  <Input type="text" placeholder="Ingresa tus 8 dígitos" maxLength={8} value={resetData.dni} onChange={(e) => setResetData(prev => ({ ...prev, dni: e.target.value.replace(/[^0-9]/g, '') }))} required disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label>Tu Rol en el Sistema</Label>
                  <Select value={resetData.role} onValueChange={(val) => setResetData(prev => ({ ...prev, role: val }))} disabled={loading} required>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Selecciona tu rol" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Estudiante</SelectItem>
                      <SelectItem value="teacher">Profesor</SelectItem>
                      <SelectItem value="tutor">Tutor de Aula</SelectItem>
                      <SelectItem value="admin">Administrador / Directivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading || !resetData.role}>
                    {loading ? 'Verificando datos...' : 'Enviar enlace a mi correo'}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full text-gray-500 hover:text-gray-800" onClick={() => { setIsResetMode(false); setResetData({ email: '', dni: '', role: '' }); setError(null); }} disabled={loading}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio de Sesión
                  </Button>
                </div>
              </form>
            </CardContent>
          </>
        ) : (
          
          /* --- VISTA: INICIO DE SESIÓN NORMAL --- */
          <>
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <GraduationCap className="w-8 h-8 text-primary" />
                <CardTitle className="text-2xl font-bold text-foreground">IE La Campiña</CardTitle>
              </div>
              <p className="text-muted-foreground">Aula Virtual</p>
              <p className="text-sm text-muted-foreground mt-2">Inicia sesión con tus credenciales institucionales.</p>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription className="font-medium text-sm">{error}</AlertDescription></Alert>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Correo electrónico</Label>
                  <Input id="login-email" type="email" placeholder="estudiante@ielacampina.edu.co" value={loginData.email} onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))} required disabled={loading} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <button type="button" onClick={() => { setIsResetMode(true); setError(null); }} className="text-xs text-primary font-medium hover:underline focus:outline-none">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <Input id="login-password" type="password" placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))} required disabled={loading} />
                </div>
                <Button type="submit" className="w-full bg-gradient-primary shadow-glow" disabled={loading}>
                  {loading ? 'Verificando...' : 'Iniciar Sesión'}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

export default Auth;