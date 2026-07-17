import { 
  Home, 
  BookOpen, 
  FileText, 
  School,
  Shield,
  Layers, 
  ClipboardList,
  Users,
  UserCog,
  BarChart3,
  Calendar,
  MessageSquare,
  Library,
  Brain,
  HelpCircle,
  Settings,
  Eye
} from 'lucide-react';

export type UserRole = 'admin' | 'teacher' | 'student' | 'parent' | 'tutor' | 'directivo';

export interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles: UserRole[];
}

export const navigationItems: NavItem[] = [
  // Menú para padres en el orden solicitado
  {
    title: 'Panel Padres',
    url: '/parent/admin',
    icon: Users,
    roles: ['parent']
  },
  {
    title: 'Calendario',
    url: '/parent/calendar',
    icon: Calendar,
    roles: ['parent']
  },
  {
    title: 'Mensajes',
    url: '/parent/messages',
    icon: MessageSquare,
    roles: ['parent']
  },
  {
    title: 'Lista de hijos',
    url: '/parent/children',
    icon: Users,
    roles: ['parent']
  },
  {
    title: 'Notificaciones',
    url: '/parent/notifications',
    icon: MessageSquare,
    roles: ['parent']
  },
  {
    title: 'Documentos',
    url: '/parent/documents',
    icon: FileText,
    roles: ['parent']
  },
  {
    title: 'Datos personales',
    url: '/parent/profile',
    icon: UserCog,
    roles: ['parent']
  },
  {
    title: 'Soporte',
    url: '/parent/support',
    icon: HelpCircle,
    roles: ['parent']
  },
  // Menú general para otros roles
  {
    title: 'Dashboard',
    url: '/',
    icon: Home,
    roles: ['admin', 'teacher', 'student', 'tutor', 'directivo']
  },
  {
    title: 'Calendario',
    url: '/calendar',
    icon: Calendar,
    roles: ['admin', 'teacher', 'student', 'tutor', 'directivo']
  },
  {
    title: 'Mensajes',
    url: '/messages',
    icon: MessageSquare,
    roles: ['admin', 'teacher', 'student', 'tutor', 'directivo']
  },
  {
    title: 'Soporte',
    url: '/support',
    icon: HelpCircle,
    roles: ['admin', 'teacher', 'student', 'tutor', 'directivo']
  },
  
  // Dashboard Tutor
  {
    title: 'Dashboard',
    url: '/tutor-dashboard',
    icon: Home,
    roles: ['tutor']
  },
  
  // Dashboard Directivo
  {
    title: 'Supervisión Docente',
    url: '/directivo-dashboard',
    icon: Eye,
    roles: ['directivo', 'admin']
  },
  
  // Aulas Virtuales
  {
    title: 'Aulas Virtuales',
    url: '/virtual-classrooms',
    icon: School,
    roles: ['admin', 'teacher', 'student']
  },
  
  // Cursos
  {
    title: 'Mis Cursos',
    url: '/courses',
    icon: BookOpen,
    roles: ['teacher', 'student']
  },
  
  // Tareas
  {
    title: 'Tareas',
    url: '/assignments',
    icon: FileText,
    roles: ['teacher', 'student', 'tutor']
  },
  
  // Exámenes
  {
    title: 'Exámenes',
    url: '/exams',
    icon: ClipboardList,
    roles: ['teacher', 'student']
  },
  
  // Calendario (duplicado eliminado)
  
  // Biblioteca
  {
    title: 'Biblioteca',
    url: '/library',
    icon: Library,
    roles: ['admin', 'teacher', 'student']
  },
  
  // Mensajes (duplicado eliminado)
  
  // Compañeros (solo estudiantes)
  {
    title: 'Compañeros',
    url: '/classmates',
    icon: Users,
    roles: ['student']
  },
  
  // Juegos Mentales
  {
    title: 'Juegos Mentales',
    url: '/mental-games',
    icon: Brain,
    roles: ['student']
  },
  
  // Soporte (duplicado eliminado)
];

export const adminNavigationItems: NavItem[] = [
  {
    title: 'Gestión de Cursos',
    url: '/admin/courses',
    icon: BookOpen,
    roles: ['admin']
  },
  {
    title: 'Gestión de Estudiantes',
    url: '/admin/students',
    icon: Users,
    roles: ['admin']
  },
  {
    title: "Malla Curricular",
    url: "/admin/malla-curricular",
    icon: Layers,
    roles: ['admin']
  },
  
  {
    title: 'Importación Masiva',
    url: '/admin/bulk-import',
    icon: Users,
    roles: ['admin']
  },
  {
    title: 'Gestión de Usuarios',
    url: '/admin/users',
    icon: UserCog,
    roles: ['admin']
  },
  {
    title: 'Aulas Virtuales',
    url: '/admin/classrooms',
    icon: School,
    roles: ['admin']
  },
  {
    title: 'Reportes',
    url: '/admin/reports',
    icon: BarChart3,
    roles: ['admin']
  },
  {
    title: 'Configuración',
    url: '/admin/settings',
    icon: Settings,
    roles: ['admin']
  }
];

export function getNavigationForRole(role: UserRole, allRoles?: UserRole[]): NavItem[] {
  // Use all roles if provided, otherwise just use the primary role
  const rolesToCheck = allRoles || [role];
  
  if (rolesToCheck.includes('admin')) {
    // Combine all items that match any of the user's roles
    const matchingItems = navigationItems.filter(item => 
      item.roles.some(r => rolesToCheck.includes(r))
    );
    return [...matchingItems, ...adminNavigationItems];
  }
  
  // Filter items that match any of the user's roles
  return navigationItems.filter(item => 
    item.roles.some(r => rolesToCheck.includes(r))
  );
}

export function canAccessRoute(role: UserRole, path: string, allRoles?: UserRole[]): boolean {
  const allItems = [...navigationItems, ...adminNavigationItems];
  const item = allItems.find(item => item.url === path);
  
  if (!item) return true; // Allow access to unregistered routes
  
  // Check if any of the user's roles match
  const rolesToCheck = allRoles || [role];
  return item.roles.some(r => rolesToCheck.includes(r));
}
