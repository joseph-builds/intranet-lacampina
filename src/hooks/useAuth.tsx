import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================================================
// ESCUDO DE SESIÓN: CLIENTE AISLADO
// Evita que el Admin pierda su sesión al registrar alumnos.
// ============================================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const memoryStorage = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {}
};

const isolatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'isolated-admin-auth-token',
    autoRefreshToken: false,
    persistSession: false, 
    detectSessionInUrl: false,
    storage: memoryStorage
  }
});
// ============================================================================

export type UserRole = 'admin' | 'teacher' | 'student' | 'parent' | 'tutor' | 'directivo';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole; // Primary role from profiles table
  roles: UserRole[]; // All roles from user_roles table
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  student_code?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole) => void;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: { first_name: string; last_name: string; role: string; document_number: string }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  createUserByAdmin: (userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: string;
    phone?: string;
    current_grade_id?: string;
    guardian_name?: string;
    emergency_phone?: string;
    dni?: string;           // Agregado para que no tire error en Typescript
    birth_date?: string;    // Agregado para que no tire error en Typescript
  }) => Promise<{ data?: any, error: any }>; // Añadido 'data' para el frontend
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'User:', session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile
          setTimeout(async () => {
            console.log('Fetching profile for user:', session.user.id);
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            if (error) {
              console.error('Error fetching profile:', error);
              setProfile(null);
              setLoading(false);
              return;
            }
            
            console.log('Profile data received:', profileData);
            
            if (profileData) {
              // Fetch user roles from user_roles table
              const { data: rolesData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id);

              console.log('Roles data received:', rolesData);

              // Get all roles or use profile role as fallback
              const allRoles = rolesData && rolesData.length > 0 
                ? rolesData.map(r => r.role as UserRole)
                : [profileData.role as UserRole];

              console.log('All roles:', allRoles);

              // Use the first role as the primary role
              const primaryRole = allRoles[0];

              const profile = {
                ...profileData,
                role: primaryRole,
                roles: allRoles
              };
              
              console.log('Final profile:', profile);
              setProfile(profile);

              // Load active role from localStorage or use primary role
              const savedActiveRole = localStorage.getItem('activeRole') as UserRole;
              if (savedActiveRole && allRoles.includes(savedActiveRole)) {
                setActiveRoleState(savedActiveRole);
              } else {
                setActiveRoleState(primaryRole);
              }
            
              // Fetch unread notifications for students
              if (profile && profile.role === 'student') {
                const { data: notifications } = await supabase
                  .from('notifications')
                  .select('id, message, type')
                  .eq('user_id', profile.id)
                  .eq('is_read', false)
                  .order('created_at', { ascending: false })
                  .limit(3);

                if (notifications && notifications.length > 0) {
                  notifications.forEach((notif) => {
                    toast.info(notif.message, {
                      description: notif.type === 'overdue' ? 'Tarea vencida' : 'Tarea pendiente',
                    });
                  });
                }
              }
            }
            
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch user profile
        setTimeout(async () => {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching profile:', error);
            setProfile(null);
            setLoading(false);
            return;
          }
          
          if (profileData) {
            // Fetch user roles from user_roles table
            const { data: rolesData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id);

            // Get all roles or use profile role as fallback
            const allRoles = rolesData && rolesData.length > 0 
              ? rolesData.map(r => r.role as UserRole)
              : [profileData.role as UserRole];

            // Use the first role as the primary role
            const primaryRole = allRoles[0];

            const profile = {
              ...profileData,
              role: primaryRole,
              roles: allRoles
            };
            
            setProfile(profile);

            // Load active role from localStorage or use primary role
            const savedActiveRole = localStorage.getItem('activeRole') as UserRole;
            if (savedActiveRole && allRoles.includes(savedActiveRole)) {
              setActiveRoleState(savedActiveRole);
            } else {
              setActiveRoleState(primaryRole);
            }
          }
          
          setLoading(false);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, userData: { first_name: string; last_name: string; role: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://intranet.ie1267bicentenario.edu.pe/",
        data: userData
      }
    });
    return { error };
  };

  // ============================================================================
  // LOGICA CORREGIDA (Con el upsert original tuyo y protección Anti-Errores)
  // ============================================================================
  const createUserByAdmin = async (userData: any) => {
    try {
      // 1. Usamos la conexión aislada para no desloguear al admin
      const { data, error } = await isolatedSupabase.auth.signUp({
        email: userData.email.trim(),
        password: userData.password,
        options: {
          data: {
            first_name: userData.first_name.trim(),
            last_name: userData.last_name.trim(),
            role: userData.role,
          },
          emailRedirectTo: window.location.origin,
        }
      });

      if (error) {
        const isRateLimit = error?.message?.includes('429') || error?.message?.includes('rate_limit') || error?.message?.includes('over_email');
        if (isRateLimit) {
          return { error: new Error('Límite de creación de usuarios alcanzado. Espera 1 minuto y vuelve a intentarlo.') };
        }
        if (error?.message?.includes('already') || error?.message?.includes('exists')) {
          return { error: new Error('Ya existe un usuario con ese email.') };
        }
        return { error };
      }

      if (!data?.user) {
        return { error: new Error('No se pudo crear el usuario') };
      }

      // 2. Generar el código de estudiante único (Arregla el error 23505 del student_code)
      let studentCode = null;
      if (userData.role === 'student') {
         const randomLetters = Math.random().toString(36).substring(2, 6).toUpperCase();
         const randomNumbers = Math.floor(1000 + Math.random() * 9000);
         studentCode = `EST-${new Date().getFullYear()}-${randomLetters}${randomNumbers}`;
      }

      // 3. Esperar al trigger como lo tenías tú
      let profileFound = false;
      for (let i = 0; i < 10; i++) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (existingProfile) {
          profileFound = true;
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }

      // 4. Tu UPSERT original (Se ejecuta sí o sí para evitar "tiempos de espera agotados")
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: data.user.id,
          email: userData.email.trim(),
          first_name: userData.first_name.trim(),
          last_name: userData.last_name.trim(),
          role: userData.role,
          phone: userData.phone?.trim() || null,
          is_active: true,
          student_code: studentCode,
          dni: userData.dni?.trim() || null, // <-- Aseguramos que guarde el DNI
          birth_date: userData.birth_date || null,
          current_grade_id: userData.role === 'student' ? (userData.current_grade_id || null) : null,
          guardian_name: userData.role === 'student' ? (userData.guardian_name?.trim() || null) : null,
          emergency_phone: userData.role === 'student' ? (userData.emergency_phone?.trim() || null) : null,
        }, { onConflict: 'user_id' });

      // 5. ROLLBACK si el DNI o Código chocan en la base de datos
      if (profileError) {
        console.error('Error actualizando profile:', profileError);
        
        // ¡Importante! Borramos al usuario de la autenticación para que no queden cuentas fantasmas.
        await supabase.rpc('delete_user_admin_v2', { target_user_id: data.user.id, target_email: userData.email });
        
        // Error 23505 = Datos duplicados (casi siempre el DNI)
        if (profileError.code === '23505') {
            return { error: new Error(`Conflicto: El DNI (${userData.dni}) ya está siendo usado por otro alumno en el sistema.`) };
        }
        return { error: profileError };
      }

      return { data: { id: data.user.id }, error: null };
    } catch (err: any) {
      console.error('Error en createUserByAdmin:', err);
      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('activeRole');
  };

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
    localStorage.setItem('activeRole', role);
    // Reload to update navigation and permissions
    window.location.reload();
  };

  const value = {
    user,
    profile,
    session,
    loading,
    activeRole,
    setActiveRole,
    signIn,
    signUp,
    signOut,
    createUserByAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}