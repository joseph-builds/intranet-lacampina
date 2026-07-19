import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Search, UserCog, Pencil, Trash2, ShieldAlert, Plus, GraduationCap, User, CheckSquare, Edit, IdCard, Calendar, BookOpen, School, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox'; 
import { useAuth } from '@/hooks/useAuth';

const CURRENT_YEAR = new Date().getFullYear();

type UserRole = 'admin' | 'teacher' | 'student' | 'tutor';

interface Profile {
  id: string;
  dni: string | null;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  current_grade_id: string | null;
  phone?: string;
  birth_date?: string | null;
}

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'teacher', label: 'Profesor' },
  { value: 'tutor', label: 'Tutor de Aula' },
  { value: 'student', label: 'Estudiante' }
];

const RoleBadge = ({ role }: { role: UserRole | string }) => {
  const roleStyles: Record<string, string> = {
    admin: "bg-red-100 text-red-800 border-red-200",
    teacher: "bg-blue-100 text-blue-800 border-blue-200",
    tutor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    student: "bg-green-100 text-green-800 border-green-200",
  };
  const label = ROLES.find(r => r.value === role)?.label || role;
  const style = roleStyles[role] || "bg-gray-100 text-gray-800 border-gray-200";
  return <Badge variant="outline" className={`${style} font-semibold shadow-sm`}>{label}</Badge>;
};

const AdminUserManagement: React.FC = () => {
  const { createUserByAdmin } = useAuth();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");

  // Acciones y Modales
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<UserRole | "">("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Estructura Académica y Cargas
  const [levels, setLevels] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [sectionCourses, setSectionCourses] = useState<any[]>([]);
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);

  // Formularios
  const [newUser, setNewUser] = useState({ 
    dni: '', first_name: '', last_name: '', email: '', password: '', phone: '', birth_date: '', 
    role: 'student' as UserRole, current_grade_id: '', current_section_id: '', guardian_name: '', emergency_phone: '' 
  });
  
  const [editUser, setEditUser] = useState<any>({ 
    id: '', dni: '', first_name: '', last_name: '', email: '', phone: '', birth_date: '', role: 'student', newPassword: '' 
  });

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Usuarios
      const { data: usersData, error } = await supabase.from('profiles').select('*').order('last_name');
      if (error) throw error;
      setProfiles((usersData || []) as Profile[]);

      // 2. Estructura Académica Base
      const [levelsRes, gradesRes] = await Promise.all([
        supabase.from('academic_levels').select('*').order('level_order'),
        supabase.from('academic_grades').select('*, level:academic_levels(name)').order('grade_order')
      ]);
      if (levelsRes.data) setLevels(levelsRes.data);
      if (gradesRes.data) setGrades(gradesRes.data);

      // 3. Secciones y Cargas del Año Actual
      const { data: secsData } = await supabase.from('sections').select('*, grade:academic_grades(name)').eq('academic_year', CURRENT_YEAR);
      const activeSecs = secsData || [];
      setSections(activeSecs);

      if (activeSecs.length > 0) {
        const secIds = activeSecs.map(s => s.id);
        const [coursesRes, enrollsRes] = await Promise.all([
          supabase.from('section_courses').select('*, section:sections(name, grade:academic_grades(name)), base:base_courses(name)').in('section_id', secIds),
          supabase.from('student_sections').select('*').eq('academic_year', CURRENT_YEAR).in('section_id', secIds)
        ]);
        if (coursesRes.data) setSectionCourses(coursesRes.data);
        if (enrollsRes.data) setStudentEnrollments(enrollsRes.data);
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Error al cargar los datos del sistema.', variant: 'destructive' });
    }
    setLoading(false);
  };

  // ----- CREAR USUARIO -----
  const openCreateModal = () => {
    setNewUser({ dni: '', first_name: '', last_name: '', email: '', password: '', phone: '', birth_date: '', role: 'student', current_grade_id: '', current_section_id: '', guardian_name: '', emergency_phone: '' });
    setCreateModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    if (!newUser.dni.trim() || newUser.dni.length < 8) {
      toast({ title: "Error", description: "El DNI es obligatorio y debe ser válido.", variant: "destructive" });
      setCreating(false); return;
    }

    try {
      // 1. Crear el Auth User
      const { error } = await createUserByAdmin({
        email: newUser.email.trim(),
        password: newUser.password,
        first_name: newUser.first_name.trim(),
        last_name: newUser.last_name.trim(),
        role: newUser.role,
        phone: newUser.phone.trim() || undefined,
        current_grade_id: newUser.role === 'student' && newUser.current_grade_id ? newUser.current_grade_id : undefined,
        guardian_name: newUser.role === 'student' ? newUser.guardian_name.trim() || undefined : undefined,
        emergency_phone: newUser.role === 'student' ? newUser.emergency_phone.trim() || undefined : undefined,
      });

      if (error) throw error;

      // 2. Buscar al usuario recién creado para actualizar sus datos extra y sección
      const { data: newCreatedUser } = await supabase.from('profiles').select('id').eq('email', newUser.email.trim()).single();
      
      if (newCreatedUser) {
        // Actualizar DNI y Fecha de Nacimiento (Asegurando la inyección)
        await supabase.from('profiles').update({
          dni: newUser.dni.trim(),
          birth_date: newUser.birth_date || null
        }).eq('id', newCreatedUser.id);

        // Si es estudiante y seleccionó una sección, lo matriculamos en el año actual
        if (newUser.role === 'student' && newUser.current_section_id) {
          await supabase.from('student_sections').insert({
            student_id: newCreatedUser.id,
            section_id: newUser.current_section_id,
            academic_year: CURRENT_YEAR
          });
        }
      }

      toast({ title: "Éxito", description: `Usuario y cuenta registrados correctamente.` });
      setCreateModalOpen(false);
      fetchAllData(); // Refrescar todo
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo crear el usuario.", variant: "destructive" });
    } finally { setCreating(false); }
  };

  // ----- EDITAR USUARIO -----
  const openEditModal = (profile: Profile) => {
    setEditUser({ 
      id: profile.id, dni: profile.dni || '', first_name: profile.first_name, last_name: profile.last_name, 
      email: profile.email, phone: profile.phone || '', birth_date: profile.birth_date || '', 
      role: profile.role, newPassword: '' 
    });
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        dni: editUser.dni.trim(),
        first_name: editUser.first_name.trim(),
        last_name: editUser.last_name.trim(),
        phone: editUser.phone.trim() || null,
        birth_date: editUser.birth_date || null,
        role: editUser.role
      }).eq('id', editUser.id);
      
      if (profileError) throw profileError;

      if (editUser.newPassword && editUser.newPassword.trim() !== '') {
        if (editUser.newPassword.length < 6) throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
        const { error: pwdError } = await supabase.rpc('update_user_password_admin', { target_user_id: editUser.id, new_password: editUser.newPassword });
        if (pwdError) throw pwdError;
      }

      toast({ title: "Éxito", description: "Perfil del usuario actualizado." });
      setEditModalOpen(false);
      fetchAllData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo actualizar el perfil.", variant: "destructive" });
    } finally { setCreating(false); }
  };

  // ----- ELIMINACIÓN MASIVA E INDIVIDUAL -----
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setSaving(id);
    try {
      await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', id);
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      toast({ title: "Estado de acceso actualizado" });
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
    setSaving(null);
  };

  const validateStudentDeletion = (user: Profile) => {
    if (user.role === 'student' && user.current_grade_id) return false;
    return true;
  };

  const handleEliminarIndividual = async (profile: Profile) => {
    if (!validateStudentDeletion(profile)) {
      toast({ title: "Acción Bloqueada", description: "Este estudiante está asignado a un grado. Desvincúlalo desde 'Aulas Virtuales' antes de eliminar su registro.", variant: "destructive" });
      return;
    }
    if (!confirm(`¿Eliminar definitivamente al usuario ${profile.first_name}? Esta acción borrará su cuenta de acceso.`)) return;
    
    setSaving(profile.id);
    try {
      const { error } = await supabase.rpc('delete_user_admin_v2', { target_user_id: profile.id, target_email: profile.email });
      if (error) throw error;
      setProfiles(prev => prev.filter(p => p.id !== profile.id));
      toast({ title: "Usuario eliminado" });
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    setSaving(null);
  };

  const handleBulkDelete = async () => {
    const usersToDelete = profiles.filter(p => selectedIds.includes(p.id));
    const blockedUsers = usersToDelete.filter(p => !validateStudentDeletion(p));
    
    if (blockedUsers.length > 0) {
      toast({ title: "Acción Interrumpida", description: `Seleccionaste ${blockedUsers.length} estudiante(s) con matrícula activa. Desvincúlalos primero.`, variant: "destructive" });
      return;
    }

    if (!confirm(`¿Eliminar definitivamente a los ${selectedIds.length} usuarios seleccionados?`)) return;
    
    setBulkLoading(true);
    try {
      for (const user of usersToDelete) {
        await supabase.rpc('delete_user_admin_v2', { target_user_id: user.id, target_email: user.email });
      }
      setSelectedIds([]);
      fetchAllData();
      toast({ title: "Usuarios eliminados" });
    } catch (error) { toast({ title: "Error masivo", variant: "destructive" }); }
    setBulkLoading(false);
  };

  const handleBulkRoleChange = async () => {
    if (!bulkRole) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ role: bulkRole }).in('id', selectedIds);
      if (error) throw error;
      setProfiles(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, role: bulkRole as UserRole } : p));
      setSelectedIds([]); setBulkRole("");
      toast({ title: 'Roles actualizados masivamente' });
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    setBulkLoading(false);
  };

  // ----- RENDERIZAR CARGA ACADÉMICA -----
  const renderCargaAcademica = (profile: Profile) => {
    if (profile.role === 'admin') return <span className="text-gray-400 text-xs italic">Gestión del sistema</span>;

    if (profile.role === 'student') {
      const myEnrollment = studentEnrollments.find(e => e.student_id === profile.id);
      const mySection = sections.find(s => s.id === myEnrollment?.section_id);
      if (mySection) return <Badge variant="outline" className="bg-green-50 text-green-700">Aula {mySection.name} ({mySection.grade?.name})</Badge>;
      return <span className="text-red-500 text-xs flex items-center"><ShieldAlert className="w-3 h-3 mr-1"/> Sin matrícula {CURRENT_YEAR}</span>;
    }

    if (profile.role === 'tutor') {
      const myTutorships = sections.filter(s => s.tutor_id === profile.id);
      if (myTutorships.length === 0) return <span className="text-gray-400 text-xs">Sin aulas a cargo</span>;
      return (
        <div className="flex flex-col gap-1">
          {myTutorships.map(s => <span key={s.id} className="text-xs font-medium text-indigo-700 flex items-center gap-1"><School className="w-3 h-3"/> Aula {s.name} ({s.grade?.name})</span>)}
        </div>
      );
    }

    if (profile.role === 'teacher') {
      const myCourses = sectionCourses.filter(c => c.teacher_id === profile.id);
      if (myCourses.length === 0) return <span className="text-gray-400 text-xs">No dicta cursos</span>;
      
      const uniqueAulas = new Set(myCourses.map(c => c.section_id)).size;
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1">
              <BookOpen className="w-3 h-3"/> {myCourses.length} cursos en {uniqueAulas} aulas <Info className="w-3 h-3 ml-1 text-blue-400"/>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-blue-700 flex items-center gap-2"><BookOpen className="w-5 h-5"/> Carga Académica de {profile.first_name}</DialogTitle>
              <DialogDescription>Listado de cursos asignados para el año {CURRENT_YEAR}.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto space-y-2 mt-2">
              {myCourses.map(c => (
                <div key={c.id} className="flex justify-between items-center p-2 bg-gray-50 border rounded-md text-sm">
                  <span className="font-semibold text-gray-800">{c.base?.name}</span>
                  <Badge variant="outline" className="text-xs bg-white text-gray-600 border-gray-300">Aula {c.section?.name} ({c.section?.grade?.name})</Badge>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      );
    }
  };

  // Filtrado y Paginación
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchesSearch = `${p.first_name} ${p.last_name} ${p.email} ${p.dni || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchesRole = !roleFilter || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [profiles, search, roleFilter]);

  const totalPages = Math.ceil(filteredProfiles.length / rowsPerPage);
  const paginatedProfiles = useMemo(() => filteredProfiles.slice((page - 1) * rowsPerPage, page * rowsPerPage), [filteredProfiles, page, rowsPerPage]);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3 text-gray-900">
              <UserCog className="h-8 w-8 text-blue-600" /> Directorio de Usuarios
            </h1>
            <p className="text-muted-foreground">Administra perfiles, roles, credenciales y verifica la carga académica ({CURRENT_YEAR}).</p>
          </div>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 shadow-md whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Registro
          </Button>
        </div>

        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            
            {/* BARRA DE ACCIONES MASIVAS */}
            {selectedIds.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in shadow-sm">
                <div className="flex items-center gap-3">
                  <CheckSquare className="text-blue-600 w-5 h-5"/>
                  <span className="text-sm font-bold text-blue-800">{selectedIds.length} seleccionados</span>
                  
                  <div className="flex items-center gap-2 ml-4 border-l border-blue-300 pl-4">
                    <Select value={bulkRole} onValueChange={val => setBulkRole(val as UserRole | "")}>
                      <SelectTrigger className="w-48 bg-white h-9"><SelectValue placeholder="Cambiar rol a..." /></SelectTrigger>
                      <SelectContent>{ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button className="bg-blue-600 h-9" size="sm" onClick={handleBulkRoleChange} disabled={!bulkRole || bulkLoading}>Aplicar Rol</Button>
                  </div>
                </div>
                <Button variant="destructive" size="sm" className="h-9" onClick={handleBulkDelete} disabled={bulkLoading}>
                  <Trash2 className="w-4 h-4 mr-2"/> Eliminar Registros
                </Button>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex gap-3 flex-1 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Buscar por DNI, nombre o correo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={roleFilter} onValueChange={val => { setRoleFilter(val as UserRole | ""); setPage(1); }}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar por rol" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    {ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="py-12 space-y-4">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          <Checkbox checked={selectedIds.length === paginatedProfiles.length && paginatedProfiles.length > 0} onCheckedChange={(checked) => { if (checked) setSelectedIds(paginatedProfiles.map(p => p.id)); else setSelectedIds([]); }} />
                        </TableHead>
                        <TableHead>Identificación / Nombre</TableHead>
                        <TableHead>Rol de Acceso</TableHead>
                        <TableHead>Carga / Ubicación ({CURRENT_YEAR})</TableHead>
                        <TableHead className="text-center w-28">Acceso</TableHead>
                        <TableHead className="text-right pr-6">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y">
                      {paginatedProfiles.map((profile) => (
                        <TableRow key={profile.id} className={`hover:bg-gray-50 ${selectedIds.includes(profile.id) ? 'bg-blue-50/50' : ''}`}>
                          <TableCell className="text-center">
                            <Checkbox checked={selectedIds.includes(profile.id)} onCheckedChange={(checked) => { if (checked) setSelectedIds(ids => [...ids, profile.id]); else setSelectedIds(ids => ids.filter(id => id !== profile.id)); }} />
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-gray-900">{profile.last_name}, {profile.first_name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-600">{profile.dni || 'Sin DNI'}</span>
                              <span>{profile.email}</span>
                            </div>
                          </TableCell>
                          <TableCell><RoleBadge role={profile.role} /></TableCell>
                          <TableCell>
                            {renderCargaAcademica(profile)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={profile.is_active} disabled={saving === profile.id} onCheckedChange={() => handleToggleStatus(profile.id, profile.is_active)} />
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <Button size="sm" variant="ghost" onClick={() => openEditModal(profile)} className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEliminarIndividual(profile)} disabled={saving === profile.id} className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 ml-1">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedProfiles.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-12 text-gray-500 font-medium">No se encontraron usuarios.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4 border-t pt-4">
                    <span className="text-sm text-muted-foreground">Mostrando {(page - 1) * rowsPerPage + 1} - {Math.min(page * rowsPerPage, filteredProfiles.length)} de {filteredProfiles.length} usuarios</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
                      <div className="flex items-center px-4 text-sm font-medium bg-gray-50 rounded-md border">Página {page} de {totalPages || 1}</div>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}>Siguiente</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* MODAL CREAR USUARIO (Estilo Gestión Estudiantes) */}
        <Dialog open={createModalOpen} onOpenChange={(open) => { if (!open) setCreateModalOpen(false); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2"><User className="h-5 w-5 text-blue-600" /> Registrar Nuevo Usuario y Cuenta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-6 mt-2">
              
              {/* Selector de Rol Principal */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                <Label className="text-blue-800 font-bold ml-2">¿Qué tipo de usuario vas a registrar?</Label>
                <Select value={newUser.role} onValueChange={val => setNewUser({...newUser, role: val as UserRole, current_grade_id: '', current_section_id: ''})}>
                  <SelectTrigger className="w-[250px] bg-white"><SelectValue/></SelectTrigger>
                  <SelectContent>{ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

               {/* 1. Datos Personales */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2 flex items-center gap-2"><IdCard className="h-4 w-4" /> 1. Datos Personales</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><Label>DNI *</Label><Input value={newUser.dni} onChange={e => setNewUser({...newUser, dni: e.target.value})} required maxLength={8} /></div>
                  <div><Label>Nombres *</Label><Input value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} required /></div>
                  <div><Label>Apellidos *</Label><Input value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} required /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><Label>Correo (Login) *</Label><Input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required /></div>
                  <div><Label>Contraseña Inicial *</Label><Input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required minLength={6} placeholder="Ej: colegio123" /></div>
                  <div><Label className="text-gray-500">Teléfono Celular (Opcional)</Label><Input value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-500">Fecha Nacimiento (Opcional)</Label>
                    <div className="relative">
                      <Input type="date" value={newUser.birth_date} onChange={e => setNewUser({...newUser, birth_date: e.target.value})} className="pl-10"/>
                      <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3"/>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Ubicación Académica (Solo Estudiantes) */}
              {newUser.role === 'student' && (
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2 mb-2"><School className="h-4 w-4" /> 2. Ubicación Académica ({CURRENT_YEAR})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-gray-500 mb-1 block">Grado a cursar (Opcional)</Label>
                      <Select value={newUser.current_grade_id} onValueChange={val => setNewUser({...newUser, current_grade_id: val, current_section_id: ''})}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Dejar sin asignar temporalmente" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="" className="text-gray-400 italic">No asignar aún</SelectItem>
                          {levels.map((level: any) => (
                            <div key={level.id}>
                              <div className="px-2 py-1.5 text-xs font-bold text-gray-400 uppercase bg-gray-50">{level.name}</div>
                              {grades.filter((g: any) => g.level_id === level.id).map((grade: any) => <SelectItem key={grade.id} value={grade.id} className="pl-6">{grade.name}</SelectItem>)}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-gray-500 mb-1 block">Aula Virtual / Sección (Opcional)</Label>
                      <Select value={newUser.current_section_id} onValueChange={val => setNewUser({...newUser, current_section_id: val})} disabled={!newUser.current_grade_id}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Sin aula asignada (General)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="" className="text-gray-400 italic">Solo matricular en grado</SelectItem>
                          {sections.filter(s => s.grade_id === newUser.current_grade_id).map((sec: any) => (
                            <SelectItem key={sec.id} value={sec.id}>Aula "{sec.name}"</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Apoderado (Solo Estudiantes) */}
              {newUser.role === 'student' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2 flex items-center gap-2"><User className="h-4 w-4" /> 3. Apoderado / Contacto</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><Label className="text-gray-600">Nombre del Apoderado</Label><Input value={newUser.guardian_name} onChange={e => setNewUser({...newUser, guardian_name: e.target.value})} placeholder="Nombre completo" /></div>
                    <div><Label className="text-red-500">Teléfono de Emergencia</Label><Input value={newUser.emergency_phone} onChange={e => setNewUser({...newUser, emergency_phone: e.target.value})} placeholder="Nro para llamadas urgentes" className="border-red-200" /></div>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4 border-t mt-6">
                <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={creating}>{creating ? 'Registrando...' : 'Registrar Cuenta y Perfil'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL EDITAR USUARIO (Replicando formato) */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { if (!open) setEditModalOpen(false); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2"><Pencil className="h-5 w-5 text-indigo-600" /> Editar Perfil y Accesos</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateUser} className="space-y-6 mt-4">
              
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-md flex items-center justify-between">
                <Label className="text-indigo-800 font-bold ml-2">Rol del Usuario en el Sistema</Label>
                <Select value={editUser.role} onValueChange={val => setEditUser({...editUser, role: val as UserRole})}>
                  <SelectTrigger className="w-[250px] bg-white"><SelectValue/></SelectTrigger>
                  <SelectContent>{ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2 flex items-center gap-2"><IdCard className="h-4 w-4" /> Datos de Identificación</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><Label>DNI *</Label><Input value={editUser.dni} onChange={e => setEditUser({...editUser, dni: e.target.value})} required maxLength={8} /></div>
                  <div><Label>Nombres *</Label><Input value={editUser.first_name} onChange={e => setEditUser({...editUser, first_name: e.target.value})} required /></div>
                  <div><Label>Apellidos *</Label><Input value={editUser.last_name} onChange={e => setEditUser({...editUser, last_name: e.target.value})} required /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><Label className="text-gray-500">Correo (Solo Lectura)</Label><Input value={editUser.email} disabled className="bg-gray-100" /></div>
                  <div><Label className="text-orange-500">Nueva Contraseña (Opcional)</Label><Input type="password" value={editUser.newPassword} onChange={e => setEditUser({...editUser, newPassword: e.target.value})} placeholder="Escribir para cambiar" className="border-orange-200" /></div>
                  <div><Label className="text-gray-500">Teléfono Celular</Label><Input value={editUser.phone} onChange={e => setEditUser({...editUser, phone: e.target.value})} /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-500">Fecha Nacimiento</Label>
                    <div className="relative">
                      <Input type="date" value={editUser.birth_date} onChange={e => setEditUser({...editUser, birth_date: e.target.value})} className="pl-10"/>
                      <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3"/>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={creating}>{creating ? 'Guardando...' : 'Guardar Cambios'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default AdminUserManagement;