import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Save, X, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

interface Bimestre {
  id: string;
  name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
}

export default function AdminBimestres() {
  const [bimestres, setBimestres] = useState<Bimestre[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    academic_year: new Date().getFullYear().toString(),
    start_date: '',
    end_date: '',
    is_closed: false
  });

  useEffect(() => {
    fetchBimestres();
  }, []);

  const fetchBimestres = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('academic_bimestres')
        .select('*')
        .order('academic_year', { ascending: false })
        .order('start_date', { ascending: true });

      if (error) throw error;
      setBimestres(data || []);
    } catch (error: any) {
      console.error('Error fetching bimestres:', error);
      toast.error('Error al cargar los bimestres');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.academic_year || !formData.start_date || !formData.end_date) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('academic_bimestres')
          .update(formData)
          .eq('id', isEditing);
          
        if (error) throw error;
        toast.success('Bimestre actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('academic_bimestres')
          .insert([formData]);
          
        if (error) throw error;
        toast.success('Bimestre creado exitosamente');
      }
      
      setIsCreating(false);
      setIsEditing(null);
      fetchBimestres();
    } catch (error: any) {
      console.error('Error saving bimestre:', error);
      toast.error(error.message || 'Error al guardar el bimestre');
    }
  };

  const startEdit = (b: Bimestre) => {
    setFormData({
      name: b.name,
      academic_year: b.academic_year,
      start_date: b.start_date,
      end_date: b.end_date,
      is_closed: b.is_closed
    });
    setIsEditing(b.id);
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setIsCreating(false);
    setFormData({
      name: '',
      academic_year: new Date().getFullYear().toString(),
      start_date: '',
      end_date: '',
      is_closed: false
    });
  };

  const toggleClosed = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('academic_bimestres')
        .update({ is_closed: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      toast.success(`Bimestre ${!currentStatus ? 'cerrado' : 'abierto'}`);
      fetchBimestres();
    } catch (error: any) {
      console.error('Error toggling status:', error);
      toast.error('Error al cambiar el estado del bimestre');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Periodos Académicos (Bimestres)</h1>
            <p className="text-muted-foreground mt-2">
              Gestiona los bimestres del año lectivo. Estos definirán cuándo se pueden ingresar notas.
            </p>
          </div>
          {!isCreating && !isEditing && (
            <Button onClick={() => {
              setIsCreating(true);
              setFormData({
                name: '1er Bimestre',
                academic_year: new Date().getFullYear().toString(),
                start_date: '',
                end_date: '',
                is_closed: false
              });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Bimestre
            </Button>
          )}
        </div>
      {(isCreating || isEditing) && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>{isEditing ? 'Editar Bimestre' : 'Crear Nuevo Bimestre'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre (ej. 1er Bimestre)</Label>
                <Input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="2do Bimestre"
                />
              </div>
              <div className="space-y-2">
                <Label>Año Académico</Label>
                <Input 
                  value={formData.academic_year}
                  onChange={e => setFormData({...formData, academic_year: e.target.value})}
                  placeholder="2024"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Inicio</Label>
                <Input 
                  type="date"
                  value={formData.start_date}
                  onChange={e => setFormData({...formData, start_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Fin</Label>
                <Input 
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData({...formData, end_date: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bimestre</TableHead>
              <TableHead>Año</TableHead>
              <TableHead>Fechas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
              </TableRow>
            ) : bimestres.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay bimestres registrados
                </TableCell>
              </TableRow>
            ) : (
              bimestres.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.academic_year}</TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {new Date(b.start_date).toLocaleDateString()} - {new Date(b.end_date).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.is_closed ? "destructive" : "default"} className="flex w-fit items-center gap-1">
                      {b.is_closed ? "Cerrado" : "Abierto"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">
                          {b.is_closed ? 'Abrir' : 'Cerrar'}
                        </Label>
                        <Switch 
                          checked={b.is_closed}
                          onCheckedChange={() => toggleClosed(b.id, b.is_closed)}
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(b)} disabled={b.is_closed}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      </div>
    </DashboardLayout>
  );
}
