import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Table } from '../components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import { Search, UserCog, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { useToast } from '../components/ui/use-toast';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import type { UserRole } from '../utils/roleNavigation';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
}

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'teacher', label: 'Profesor' },
  { value: 'student', label: 'Estudiante' },
  { value: 'parent', label: 'Padre / Apoderado' },
  { value: 'tutor', label: 'Tutor de Aula' },
  { value: 'directivo', label: 'Directivo' },
];

const RoleBadge = ({ role }: { role: UserRole | string }) => {
  const roleStyles: Record<string, string> = {
    admin: "bg-red-100 text-red-800 border-red-200",
    teacher: "bg-blue-100 text-blue-800 border-blue-200",
    tutor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    student: "bg-green-100 text-green-800 border-green-200",
    parent: "bg-yellow-100 text-yellow-800 border-yellow-200",
    directivo: "bg-orange-100 text-orange-800 border-orange-200",
  };
  const label = ROLES.find(r => r.value === role)?.label || role;
  const style = roleStyles[role] || "bg-gray-100 text-gray-800 border-gray-200";
  
  return <Badge variant="outline" className={`${style} font-semibold shadow-sm`}>{label}</Badge>;
};

const AdminUserManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<UserRole | "">("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchProfiles(); }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('id, first_name, last_name, email, role');
      if (error) throw error;
      setProfiles((data || []) as Profile[]);
    } catch (e) {
      toast({ title: 'Error', description: 'Error al cargar usuarios', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleRoleChange = async (id: string, newRole: UserRole) => {
    setSaving(id);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
      if (error) throw error;
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role: newRole as UserRole } : p)));
      toast({ title: 'Éxito', description: 'Rol de acceso actualizado.' });
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo actualizar el rol', variant: 'destructive' });
    }
    setSaving(null);
  };

  // OPTIMIZACIÓN: Memoizamos los filtros para que la interfaz no se trabe al teclear rápido
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchesSearch = `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(search.toLowerCase());
      const matchesRole = !roleFilter || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [profiles, search, roleFilter]);

  const totalPages = Math.ceil(filteredProfiles.length / rowsPerPage);
  const paginatedProfiles = useMemo(() => {
    return filteredProfiles.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  }, [filteredProfiles, page, rowsPerPage]);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        
        {/* Encabezado limpio */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <UserCog className="h-8 w-8 text-primary" />
            Gestión de Usuarios y Roles
          </h1>
          <p className="text-muted-foreground">
            Administra los roles, accesos y permisos de toda la plataforma educativa. Ten precaución al asignar roles de Administrador o Directivo.
          </p>
        </div>

        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            
            {/* Barra de acciones masivas */}
            {selectedIds.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg animate-in fade-in slide-in-from-top-2 shadow-sm">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="text-indigo-600 w-5 h-5"/>
                  <span className="text-sm font-bold text-indigo-800">Cambiar rol a {selectedIds.length} usuarios:</span>
                  <Select value={bulkRole} onValueChange={val => setBulkRole(val as UserRole | "") }>
                    <SelectTrigger className="w-48 bg-white border-indigo-300">
                      <SelectValue placeholder="Seleccionar nuevo rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 shadow-md"
                    size="sm"
                    onClick={async () => {
                      if (!bulkRole) return;
                      setBulkLoading(true);
                      try {
                        const { error } = await supabase.from('profiles').update({ role: bulkRole }).in('id', selectedIds);
                        if (error) throw error;
                        setProfiles(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, role: bulkRole as UserRole } : p));
                        setSelectedIds([]);
                        setBulkRole("");
                        toast({ title: 'Éxito', description: 'Actualización masiva completada correctamente.' });
                      } catch (e) {
                        toast({ title: 'Error', description: 'No se pudieron actualizar los roles', variant: 'destructive' });
                      }
                      setBulkLoading(false);
                    }}
                    disabled={!bulkRole || bulkLoading}
                  >
                    Aplicar Cambios a Todos
                  </Button>
                </div>
              </div>
            )}

            {/* Buscador y Filtros */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex gap-3 flex-1 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nombre o correo electrónico..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={val => { setRoleFilter(val as UserRole | ""); setPage(1); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar por rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    {ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mostrar</span>
                <Select value={String(rowsPerPage)} onValueChange={val => { setRowsPerPage(Number(val)); setPage(1); }}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabla */}
            {loading ? (
              <div className="py-12 space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left w-[50px]">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 w-4 h-4 cursor-pointer text-indigo-600 focus:ring-indigo-500"
                            checked={selectedIds.length === paginatedProfiles.length && paginatedProfiles.length > 0}
                            onChange={e => e.target.checked ? setSelectedIds(paginatedProfiles.map(p => p.id)) : setSelectedIds([])}
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 text-sm">Nombre del Usuario</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 text-sm">Correo Electrónico</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 text-sm">Rol de Acceso</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-600 text-sm">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedProfiles.map((profile) => (
                        <tr key={profile.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(profile.id) ? 'bg-indigo-50/50' : ''}`}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 w-4 h-4 cursor-pointer text-indigo-600 focus:ring-indigo-500"
                              checked={selectedIds.includes(profile.id)}
                              onChange={e => e.target.checked ? setSelectedIds(ids => [...ids, profile.id]) : setSelectedIds(ids => ids.filter(id => id !== profile.id))}
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {profile.first_name} {profile.last_name}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm">
                            {profile.email}
                          </td>
                          <td className="px-4 py-3">
                            {editingId === profile.id ? (
                              <Select
                                value={profile.role}
                                onValueChange={async (val) => { await handleRoleChange(profile.id, val as UserRole); setEditingId(null); }}
                                disabled={saving === profile.id}
                              >
                                <SelectTrigger className="h-8 border-blue-400 bg-blue-50 focus:ring-blue-500">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <RoleBadge role={profile.role} />
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <Button
                                size="sm" variant="ghost" title="Editar Rol"
                                onClick={() => setEditingId(profile.id)} disabled={saving === profile.id}
                                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm" variant="ghost" title="Eliminar Usuario"
                                onClick={async () => {
                                  if(confirm(`¿Estás completamente seguro de eliminar el acceso al usuario ${profile.first_name}? Esta acción es destructiva.`)) {
                                    setSaving(profile.id);
                                    try {
                                      const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
                                      if (error) throw error;
                                      setProfiles(prev => prev.filter(p => p.id !== profile.id));
                                      toast({ title: 'Usuario eliminado' });
                                    } catch (e) {
                                      toast({ title: 'Error al eliminar', variant: 'destructive' });
                                    }
                                    setSaving(null);
                                  }
                                }}
                                disabled={saving === profile.id}
                                className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paginatedProfiles.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-gray-500 font-medium">
                            No se encontraron usuarios que coincidan con la búsqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4 border-t pt-4">
                    <span className="text-sm text-muted-foreground">
                      Mostrando {(page - 1) * rowsPerPage + 1} - {Math.min(page * rowsPerPage, filteredProfiles.length)} de {filteredProfiles.length} usuarios
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
                      <div className="flex items-center px-4 text-sm font-medium bg-gray-50 rounded-md border">
                        Página {page} de {totalPages || 1}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}>Siguiente</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminUserManagement;