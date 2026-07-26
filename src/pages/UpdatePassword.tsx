import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const UpdatePassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Escuchar si Supabase detecta el token de recuperación en la URL
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log("Modo recuperación activado.");
      }
    });
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Las contraseñas no coinciden.');
    }

    setLoading(true);

    try {
      // Le decimos a Supabase que actualice la contraseña de este usuario
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccess(true);
      toast({
        title: "¡Contraseña actualizada!",
        description: "Iniciando sesión de forma segura...",
      });

      // Redirigir al panel principal después de 2 segundos
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Hubo un problema al actualizar la contraseña. El enlace puede haber caducado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-glow border-0">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <div className="bg-primary/10 p-3 rounded-full"><Lock className="w-6 h-6 text-primary" /></div>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Crear Nueva Contraseña</CardTitle>
          <CardDescription>Escribe una nueva contraseña segura para tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {success ? (
            <div className="flex flex-col items-center justify-center py-6 animate-in fade-in">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-lg font-bold text-gray-800">¡Contraseña Guardada!</h3>
              <p className="text-sm text-gray-500 text-center mt-2">Redirigiendo a tu cuenta...</p>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Nueva Contraseña</Label>
                <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={loading} minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Confirmar Contraseña</Label>
                <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} minLength={6} />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar y Entrar al Sistema'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatePassword;