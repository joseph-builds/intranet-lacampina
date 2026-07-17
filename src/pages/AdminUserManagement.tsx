import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Table } from '../components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import { Search, UserCog } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import { useToast } from '../components/ui/use-toast';
import { supabase } from '../integrations/supabase/client';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';

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
  { value: 'parent', label: 'Padre' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'directivo', label: 'Directivo' },
];

const AdminUserManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<UserRole | "">("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('id, first_name, last_name, email, role');
      if (error) throw error;
      setProfiles((data || []) as Profile[]);
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Error al cargar usuarios',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handleRoleChange = async (id: string, newRole: UserRole) => {
    setSaving(id);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
      if (error) throw error;
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, role: newRole as UserRole } : p))
      );
      toast({
        title: 'Éxito',
        description: 'Rol actualizado',
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el rol',
        variant: 'destructive',
      });
    }
    setSaving(null);
  };

  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const filteredProfiles = profiles.filter(
    (p) =>
      (!roleFilter || p.role === roleFilter) &&
      (`${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredProfiles.length / rowsPerPage);
  const paginatedProfiles = filteredProfiles.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        
        {/* Encabezado limpio */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <UserCog className="h-8 w-8 text-primary" />
            Gestión de Usuarios
          </h1>
          <p className="text-muted-foreground">
            Administra los roles, accesos y perfiles de toda la plataforma educativa.
          </p>
        </div>

        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            
            {/* Barra de acciones masivas */}
            {selectedIds.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-blue-700">Cambiar rol a {selectedIds.length} usuarios:</span>
                  <Select value={bulkRole} onValueChange={val => setBulkRole(val as UserRole | "") }>
                    <SelectTrigger className="w-48 bg-white">
                      <SelectValue placeholder="Seleccionar nuevo rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
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
                        toast({ title: 'Éxito', description: 'Roles actualizados correctamente' });
                      } catch (e) {
                        toast({ title: 'Error', description: 'No se pudieron actualizar los roles', variant: 'destructive' });
                      }
                      setBulkLoading(false);
                    }}
                    disabled={!bulkRole || bulkLoading}
                  >
                    Aplicar Cambios
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
                    placeholder="Buscar por nombre o correo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={val => setRoleFilter(val as UserRole | "") }>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mostrar</span>
                <Select value={String(rowsPerPage)} onValueChange={val => { setRowsPerPage(Number(val)); setPage(1); }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
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
                <div className="rounded-md border">
                  <Table>
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left w-[50px]">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={selectedIds.length === paginatedProfiles.length && paginatedProfiles.length > 0}
                            onChange={e => {
                              e.target.checked 
                                ? setSelectedIds(paginatedProfiles.map(p => p.id))
                                : setSelectedIds([]);
                            }}
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-sm">Nombre</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-sm">Correo</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-sm">Rol Actual</th>
                        <th className="px-4 py-3 text-center font-medium text-muted-foreground text-sm">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedProfiles.map((profile) => (
                        <tr key={profile.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={selectedIds.includes(profile.id)}
                              onChange={e => {
                                e.target.checked
                                  ? setSelectedIds(ids => [...ids, profile.id])
                                  : setSelectedIds(ids => ids.filter(id => id !== profile.id));
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {profile.first_name} {profile.last_name}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {profile.email}
                          </td>
                          <td className="px-4 py-3">
                            {editingId === profile.id ? (
                              <Select
                                value={profile.role}
                                onValueChange={async (val) => {
                                  await handleRoleChange(profile.id, val as UserRole);
                                  setEditingId(null);
                                }}
                                disabled={saving === profile.id}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.map((role) => (
                                    <SelectItem key={role.value} value={role.value}>
                                      {role.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                                {ROLES.find(r => r.value === profile.role)?.label || profile.role}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(profile.id)}
                                disabled={saving === profile.id}
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  if(confirm(`¿Seguro que deseas eliminar al usuario ${profile.first_name}?`)) {
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
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                {/* Paginación */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
                  <span className="text-sm text-muted-foreground">
                    Mostrando {(page - 1) * rowsPerPage + 1} - {Math.min(page * rowsPerPage, filteredProfiles.length)} de {filteredProfiles.length} usuarios
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      Anterior
                    </Button>
                    <div className="flex items-center px-4 text-sm font-medium">
                      Página {page} de {totalPages || 1}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminUserManagement;