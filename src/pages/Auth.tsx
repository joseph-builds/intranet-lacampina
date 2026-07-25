import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const { user, profile, loading: authLoading, signIn, signOut } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  // Limpiar credenciales al cargar por si quedó algo pegado
  useEffect(() => {
    setLoginData({ email: '', password: '' });
  }, []);

  // Efecto de seguridad por si entra con una sesión inactiva colgada en el caché
  useEffect(() => {
    if (user && !authLoading && profile && profile.is_active === false) {
      signOut();
      setError('Su cuenta ha sido inhabilitada. Por favor, comuníquese con el colegio y un administrador para que le activen su cuenta.');
    }
  }, [user, profile, authLoading, signOut]);

  // Redireccionar SOLAMENTE si está autenticado Y ACTIVO
  if (user && !authLoading && profile) {
    if (profile.is_active) {
      // Redirect based on role
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
    // Si no está activo, no redirigimos para que el formulario se quede y muestre el error.
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Iniciamos sesión en Supabase Auth
      const { data: authData, error: signInError } = await signIn(loginData.email, loginData.password);

      if (signInError) {
        throw signInError;
      }

      // 2. Verificamos INMEDIATAMENTE el estado activo en la tabla profiles
      if (authData?.user) {
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          throw new Error('No se pudo verificar el estado de su cuenta.');
        }

        // 3. BLOQUEO EN LA PUERTA: Si está inactivo, lo sacamos ANTES de darle la bienvenida
        if (userProfile && userProfile.is_active === false) {
          await signOut(); // Cerramos la sesión silenciosamente
          setError('Su cuenta ha sido inhabilitada. Por favor, comuníquese con el colegio y un administrador para que le activen su cuenta.');
          setLoading(false);
          return; // ROMPEMOS EL FLUJO AQUÍ. El toast de bienvenida nunca se ejecutará.
        }
      }

      // 4. Si pasa todos los filtros, es activo y le damos la bienvenida
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente.",
      });

    } catch (err: any) {
      // Manejo de errores de credenciales (correo/contraseña incorrectos)
      if (err.message === 'Invalid login credentials') {
        setError('El correo o la contraseña son incorrectos.');
      } else {
        setError(err.message || 'Error inesperado al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-glow border-0">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <GraduationCap className="w-8 h-8 text-primary" />
            <CardTitle className="text-2xl font-bold text-foreground">
              IE La Campiña
            </CardTitle>
          </div>
          <p className="text-muted-foreground">Aula Virtual</p>
          <p className="text-sm text-muted-foreground mt-2">
            Inicia sesión con tus credenciales institucionales.
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Correo electrónico</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="estudiante@ielacampina.edu.co"
                value={loginData.email}
                onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginData.password}
                onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                required
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-primary shadow-glow" 
              disabled={loading}
            >
              {loading ? 'Verificando credenciales...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;