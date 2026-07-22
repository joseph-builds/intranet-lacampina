import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Phone, Calendar, Shield, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

// Ahora el esquema solo valida el avatar, ya que el resto no se puede editar
const profileFormSchema = z.object({
  avatar_url: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function Profile() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      avatar_url: profile?.avatar_url || "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        avatar_url: profile.avatar_url || "",
      });
    }
  }, [profile, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!profile) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: data.avatar_url,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Perfil actualizado",
        description: "Tu foto de perfil ha sido actualizada correctamente.",
      });
      
      // Opcional: Recarga la página para que la nueva foto se refleje en el Header de inmediato
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la foto de perfil.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'teacher': return 'Docente';
      case 'student': return 'Estudiante';
      case 'parent': return 'Padre de Familia';
      case 'tutor': return 'Tutor';
      default: return 'Usuario';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'teacher': return 'bg-primary text-primary-foreground';
      case 'student': return 'bg-secondary text-secondary-foreground';
      case 'parent': return 'bg-accent text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-6 bg-gradient-to-br from-background to-muted/30 min-h-screen">
        
        {/* Header del Perfil */}
        <div className="flex items-center gap-6 mb-8 bg-card p-6 rounded-xl shadow-sm border border-border/50">
          <Avatar className="h-24 w-24 border-4 border-primary/20">
            <AvatarImage src={profile.avatar_url || ''} alt="Avatar" className="object-cover" />
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-semibold">
              {getInitials(profile.first_name, profile.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-muted-foreground text-lg">{profile.email}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {profile.roles && profile.roles.length > 0 ? (
                profile.roles.map(role => (
                  <Badge key={role} className={getRoleColor(role)}>
                    <Shield className="w-4 h-4 mr-1" />
                    {getRoleLabel(role)}
                  </Badge>
                ))
              ) : (
                <Badge className={getRoleColor(profile.role)}>
                  <Shield className="w-4 h-4 mr-1" />
                  {getRoleLabel(profile.role)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Contenedor Principal en Grid (Izquierda: Info, Derecha: Editar Avatar) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Tarjeta de Información Personal (Solo lectura) */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-card border-border/50 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Email</p>
                    <p className="font-medium text-sm">{profile.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Teléfono</p>
                    <p className="font-medium text-sm">{profile.phone || 'No registrado'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Miembro desde</p>
                    <p className="font-medium text-sm">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'No disponible'}
                    </p>
                  </div>
                </div>

                <Separator />
                
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Estado de la cuenta</p>
                  <Badge variant={profile.is_active ? "default" : "destructive"}>
                    {profile.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Formulario de Edición (Bloqueado excepto Avatar) */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-card border-border/50 shadow-card h-full">
              <CardHeader>
                <CardTitle>Editar Perfil</CardTitle>
                <CardDescription>
                  Solo puedes modificar tu foto de perfil. Los demás datos personales están bloqueados y son gestionados por el administrador.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    
                    {/* Campos Bloqueados Visualmente */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Nombre</Label>
                        <Input 
                          value={profile.first_name} 
                          disabled 
                          className="bg-muted/50 text-muted-foreground border-border/50 cursor-not-allowed opacity-70" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Apellido</Label>
                        <Input 
                          value={profile.last_name} 
                          disabled 
                          className="bg-muted/50 text-muted-foreground border-border/50 cursor-not-allowed opacity-70" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Teléfono</Label>
                      <Input 
                        value={profile.phone || ''} 
                        disabled 
                        placeholder="Sin teléfono"
                        className="bg-muted/50 text-muted-foreground border-border/50 cursor-not-allowed opacity-70" 
                      />
                    </div>

                    {/* Campo Editable (Avatar) */}
                    <FormField
                      control={form.control}
                      name="avatar_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-primary">URL del Avatar (Tu Foto)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://ejemplo.com/mi-foto.jpg" 
                              {...field}
                              className="bg-background border-border/50 focus:border-primary"
                            />
                          </FormControl>
                          <p className="text-[0.8rem] text-muted-foreground">
                            Pega un enlace directo a una imagen para usarla como foto de perfil.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 transition-all duration-300"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar Foto de Perfil"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}