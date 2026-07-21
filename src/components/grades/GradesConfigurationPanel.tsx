import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, AlertCircle, Plus, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GradesConfigurationPanelProps {
  courseId: string;
  bimestreId: string;
  isClosed: boolean;
}

interface EvalType {
  id: string;
  name: string;
  is_automatic: boolean;
  source_module: string | null;
  course_id?: string | null;
}

interface ConfigItem {
  evaluation_type_id: string;
  weight_percentage: number;
  is_active: boolean;
  selected_assignments: string[]; // For tasks/exams IDs
}

export default function GradesConfigurationPanel({ courseId, bimestreId, isClosed }: GradesConfigurationPanelProps) {
  const [evalTypes, setEvalTypes] = useState<EvalType[]>([]);
  const [configs, setConfigs] = useState<Record<string, ConfigItem>>({});
  const [availableAssignments, setAvailableAssignments] = useState<any[]>([]);
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [addingSectionLoading, setAddingSectionLoading] = useState(false);

  useEffect(() => {
    loadConfigurationData();
  }, [courseId, bimestreId]);

  const loadConfigurationData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Eval Types (Global ones OR those created for this course)
      const { data: typesData, error: typesError } = await supabase
        .from('grade_evaluation_types')
        .select('*')
        .or(`course_id.is.null,course_id.eq.${courseId}`)
        .order('name');
      if (typesError) throw typesError;
      
      // 2. Fetch existing configs
      const { data: configsData, error: configsError } = await supabase
        .from('grade_weight_configurations')
        .select('*')
        .eq('course_id', courseId)
        .eq('bimestre_id', bimestreId);
      if (configsError) throw configsError;

      // 3. Fetch selected assignments/exams
      const { data: selectedData, error: selectedError } = await supabase
        .from('grade_selected_assignments')
        .select('*')
        .eq('course_id', courseId)
        .eq('bimestre_id', bimestreId);
      if (selectedError) throw selectedError;

      // 4. Fetch all course tasks and exams (for checkboxes)
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('id, title, due_date')
        .eq('course_id', courseId)
        .order('due_date', { ascending: false });

      const { data: examsData } = await supabase
        .from('exams')
        .select('id, title, start_time')
        .eq('course_id', courseId)
        .order('start_time', { ascending: false });

      setAvailableAssignments(assignmentsData || []);
      setAvailableExams(examsData || []);
      setEvalTypes(typesData || []);

      // Build config state
      const newConfigs: Record<string, ConfigItem> = {};
      typesData?.forEach(type => {
        const existingConfig = configsData?.find(c => c.evaluation_type_id === type.id);
        const relatedSelected = selectedData?.filter(s => s.evaluation_type_id === type.id) || [];
        
        const selectedIds = relatedSelected.map(s => s.assignment_id || s.exam_id).filter(Boolean) as string[];

        newConfigs[type.id] = {
          evaluation_type_id: type.id,
          weight_percentage: existingConfig ? Number(existingConfig.weight_percentage) : 0,
          is_active: !!existingConfig,
          selected_assignments: selectedIds,
        };
      });

      setConfigs(newConfigs);
    } catch (error: any) {
      console.error('Error loading configuration:', error);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (typeId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setConfigs(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        weight_percentage: numValue
      }
    }));
  };

  const toggleActive = (typeId: string, checked: boolean) => {
    setConfigs(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        is_active: checked,
        weight_percentage: checked ? prev[typeId].weight_percentage : 0
      }
    }));
  };

  const toggleSelection = (typeId: string, itemId: string, checked: boolean) => {
    setConfigs(prev => {
      const current = prev[typeId].selected_assignments;
      return {
        ...prev,
        [typeId]: {
          ...prev[typeId],
          selected_assignments: checked 
            ? [...current, itemId] 
            : current.filter(id => id !== itemId)
        }
      };
    });
  };

  const saveConfiguration = async () => {
    if (isClosed) {
      toast.error('El bimestre está cerrado. No se puede modificar.');
      return;
    }

    // Validate weights sum to 100
    const activeConfigs = Object.values(configs).filter(c => c.is_active);
    const totalWeight = activeConfigs.reduce((sum, c) => sum + c.weight_percentage, 0);
    
    if (activeConfigs.length > 0 && Math.abs(totalWeight - 100) > 0.01) {
      toast.error(`La suma de los pesos debe ser 100%. Actualmente es ${totalWeight}%`);
      return;
    }

    try {
      setSaving(true);
      
      // We will perform updates by deleting existing and inserting new ones for simplicity
      
      // 1. Delete old configs
      await supabase
        .from('grade_weight_configurations')
        .delete()
        .eq('course_id', courseId)
        .eq('bimestre_id', bimestreId);
        
      // 2. Delete old selected assignments
      await supabase
        .from('grade_selected_assignments')
        .delete()
        .eq('course_id', courseId)
        .eq('bimestre_id', bimestreId);

      // 3. Insert new configs
      const configsToInsert = activeConfigs.map(c => ({
        course_id: courseId,
        bimestre_id: bimestreId,
        evaluation_type_id: c.evaluation_type_id,
        weight_percentage: c.weight_percentage
      }));

      if (configsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('grade_weight_configurations')
          .insert(configsToInsert);
        if (insertError) throw insertError;
      }

      // 4. Insert new selected assignments
      const selectionsToInsert: any[] = [];
      activeConfigs.forEach(c => {
        const type = evalTypes.find(t => t.id === c.evaluation_type_id);
        if (type?.is_automatic && c.selected_assignments.length > 0) {
          c.selected_assignments.forEach(itemId => {
            selectionsToInsert.push({
              course_id: courseId,
              bimestre_id: bimestreId,
              evaluation_type_id: c.evaluation_type_id,
              assignment_id: type.source_module === 'assignments' ? itemId : null,
              exam_id: type.source_module === 'exams' ? itemId : null,
            });
          });
        }
      });

      if (selectionsToInsert.length > 0) {
        const { error: selError } = await supabase
          .from('grade_selected_assignments')
          .insert(selectionsToInsert);
        if (selError) throw selError;
      }

      toast.success('Configuración guardada exitosamente');
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomSection = async () => {
    if (!newSectionName.trim()) return;
    
    try {
      setAddingSectionLoading(true);
      const { data, error } = await supabase
        .from('grade_evaluation_types')
        .insert({
          name: newSectionName.trim(),
          is_automatic: false,
          course_id: courseId
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setEvalTypes([...evalTypes, data]);
      setConfigs(prev => ({
        ...prev,
        [data.id]: {
          evaluation_type_id: data.id,
          weight_percentage: 0,
          is_active: true,
          selected_assignments: []
        }
      }));
      
      setNewSectionName('');
      setIsAddingSection(false);
      toast.success('Sección añadida');
    } catch (error: any) {
      console.error('Error adding section:', error);
      toast.error('Error al añadir la sección');
    } finally {
      setAddingSectionLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const activeConfigs = Object.values(configs).filter(c => c.is_active);
  const totalWeight = activeConfigs.reduce((sum, c) => sum + (Number(c.weight_percentage) || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Calificación</CardTitle>
        <CardDescription>
          Selecciona qué rubros aplican para este bimestre y asigna sus pesos en %. La suma debe ser 100%.
          Puedes seleccionar qué tareas o exámenes específicos entran al cálculo automático.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <Alert variant={Math.abs(totalWeight - 100) > 0.01 ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium">
            Peso Total Actual: {totalWeight}% {Math.abs(totalWeight - 100) > 0.01 && "(Debe sumar exactamente 100%)"}
          </AlertDescription>
        </Alert>

        <div className="grid gap-6">
          {evalTypes.map(type => {
            const config = configs[type.id];
            if (!config) return null;

            return (
              <div key={type.id} className={`border rounded-lg p-4 transition-colors ${config.is_active ? 'border-primary/50 bg-primary/5' : 'bg-card'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      id={`enable-${type.id}`} 
                      checked={config.is_active}
                      onCheckedChange={(c) => toggleActive(type.id, !!c)}
                      disabled={isClosed}
                    />
                    <Label htmlFor={`enable-${type.id}`} className="font-semibold text-lg cursor-pointer">
                      {type.name} {type.is_automatic && <span className="text-xs font-normal text-muted-foreground ml-2">(Automático)</span>}
                    </Label>
                  </div>
                  
                  {config.is_active && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`weight-${type.id}`} className="text-sm text-muted-foreground">Peso (%)</Label>
                      <Input 
                        id={`weight-${type.id}`}
                        type="number"
                        min="0"
                        max="100"
                        className="w-24 text-right"
                        value={config.weight_percentage}
                        onChange={(e) => handleWeightChange(type.id, e.target.value)}
                        disabled={isClosed}
                      />
                    </div>
                  )}
                </div>

                {/* Sub-selection for automatic types */}
                {config.is_active && type.is_automatic && type.source_module === 'assignments' && (
                  <div className="pl-7 mt-2 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Selecciona las tareas a incluir:</p>
                    {availableAssignments.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No hay tareas creadas en este curso.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded bg-background">
                        {availableAssignments.map(task => (
                          <div key={task.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`task-${task.id}`} 
                              checked={config.selected_assignments.includes(task.id)}
                              onCheckedChange={(c) => toggleSelection(type.id, task.id, !!c)}
                              disabled={isClosed}
                            />
                            <Label htmlFor={`task-${task.id}`} className="text-sm cursor-pointer truncate" title={task.title}>
                              {task.title}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {config.is_active && type.is_automatic && type.source_module === 'exams' && (
                  <div className="pl-7 mt-2 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Selecciona los exámenes a incluir:</p>
                    {availableExams.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No hay exámenes creados en este curso.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded bg-background">
                        {availableExams.map(exam => (
                          <div key={exam.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`exam-${exam.id}`} 
                              checked={config.selected_assignments.includes(exam.id)}
                              onCheckedChange={(c) => toggleSelection(type.id, exam.id, !!c)}
                              disabled={isClosed}
                            />
                            <Label htmlFor={`exam-${exam.id}`} className="text-sm cursor-pointer truncate" title={exam.title}>
                              {exam.title}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isAddingSection ? (
          <div className="flex items-center gap-3 p-4 border rounded-md bg-muted/30 mt-6">
            <div className="flex-1">
              <Label className="text-xs mb-1 block">Nombre de la nueva sección (Ej: Trabajo de campo)</Label>
              <Input 
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Escribe el nombre..."
                autoFocus
              />
            </div>
            <div className="flex items-end gap-2 mt-5">
              <Button 
                size="sm" 
                onClick={handleAddCustomSection} 
                disabled={!newSectionName.trim() || addingSectionLoading}
              >
                {addingSectionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Añadir'}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setIsAddingSection(false);
                  setNewSectionName('');
                }}
                disabled={addingSectionLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="w-full border-dashed flex items-center justify-center gap-2 mt-6"
            onClick={() => setIsAddingSection(true)}
          >
            <Plus className="h-4 w-4" />
            Añadir sección personalizada
          </Button>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={saveConfiguration} disabled={loading || saving || isClosed || (activeConfigs.length > 0 && Math.abs(totalWeight - 100) > 0.01)}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
