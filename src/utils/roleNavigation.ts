import { 
  Home, 
  BookOpen, 
  FileText, 
  School,
  Layers, 
  ClipboardList,
  Users,
  UserCog,
  Calendar,
  Megaphone, 
  Library,
  Brain
} from 'lucide-react'; // Ya eliminamos los iconos de Soporte y Supervisión

export type UserRole = 'admin' | 'teacher' | 'student' | 'tutor';

export interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles: UserRole[];
}

// NAVEGACIÓN PRINCIPAL
export const navigationItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/',
    icon: Home,
    roles: ['admin', 'teacher', 'student', 'tutor']
  },
  {
    title: 'Calendario',
    url: '/calendar',
    icon: Calendar,
    roles: ['admin', 'teacher', 'student', 'tutor']
  },
  {
    title: 'Anuncios',
    url: '/anuncios', 
    icon: Megaphone,
    roles: ['admin', 'teacher', 'student', 'tutor']
  },
  
  // Dashboard específico para Tutor
  {
    title: 'Dashboard',
    url: '/tutor-dashboard',
    icon: Home,
    roles: ['tutor']
  },
  
  // Aulas Virtuales (Profesores)
  {
    title: 'Aulas Virtuales',
    url: '/teacher/classrooms',
    icon: School,
    roles: ['teacher']
  },
  
  // Cursos, Tareas, Exámenes y Biblioteca
  {
    title: 'Mis Cursos',
    url: '/courses',
    icon: BookOpen,
    roles: ['teacher', 'student']
  },
  {
    title: 'Tareas',
    url: '/assignments',
    icon: FileText,
    roles: ['teacher', 'student', 'tutor']
  },
  {
    title: 'Exámenes',
    url: '/exams',
    icon: ClipboardList,
    roles: ['teacher', 'student']
  },
  {
    title: 'Biblioteca',
    url: '/library',
    icon: Library,
    roles: ['admin', 'teacher', 'student']
  },
  
  // Opciones exclusivas de Estudiantes
  {
    title: 'Compañeros',
    url: '/classmates',
    icon: Users,
    roles: ['student']
  },
  {
    title: 'Juegos Mentales',
    url: '/mental-games',
    icon: Brain,
    roles: ['student']
  },
];

// NAVEGACIÓN DE ADMINISTRACIÓN (Solo Admin)
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
  }
];

export function getNavigationForRole(role: UserRole, allRoles?: UserRole[]): NavItem[] {
  const rolesToCheck = allRoles || [role];
  
  if (rolesToCheck.includes('admin')) {
    const matchingItems = navigationItems.filter(item => 
      item.roles.some(r => rolesToCheck.includes(r))
    );
    return [...matchingItems, ...adminNavigationItems];
  }
  
  return navigationItems.filter(item => 
    item.roles.some(r => rolesToCheck.includes(r))
  );
}

export function canAccessRoute(role: UserRole, path: string, allRoles?: UserRole[]): boolean {
  const allItems = [...navigationItems, ...adminNavigationItems];
  const item = allItems.find(item => item.url === path);
  if (!item) return true; 
  const rolesToCheck = allRoles || [role];
  return item.roles.some(r => rolesToCheck.includes(r));
}