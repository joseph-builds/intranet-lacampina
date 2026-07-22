import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  BookOpen,
  Heart,
  Shield,
  Star,
  Plus,
  Edit,
  Filter,
  Calendar as CalendarIcon,
  User,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string;
}

interface Incident {
  id: string;
  student_id: string;
  classroom_id: string;
  incident_type: string;
  severity: string;
  description: string;
  action_taken: string | null;
  status: string;
  recorded_by: string;
  incident_date: string;
  created_at: string;
  updated_at: string;
  student?: { first_name: string; last_name: string };
}

interface IncidentsManagerProps {
  classroomId: string;
  students: Student[];
}

const INCIDENT_TYPES = [
  { value: "conductual", label: "Conductual", icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "académica", label: "Académica", icon: BookOpen, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "salud_accidente", label: "Salud / Accidente", icon: Heart, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "convivencia_bullying", label: "Convivencia / Bullying", icon: Shield, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "positiva_reconocimiento", label: "Positiva / Reconocimiento", icon: Star, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
];

const SEVERITY_OPTIONS = [
  { value: "leve", label: "Leve", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "moderada", label: "Moderada", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "grave", label: "Grave", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const STATUS_OPTIONS = [
  { value: "abierta", label: "Abierta", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "en_seguimiento", label: "En seguimiento", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "cerrada", label: "Cerrada", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
];

const emptyForm = {
  student_id: "",
  incident_type: "",
  severity: "",
  description: "",
  action_taken: "",
  incident_date: new Date().toISOString().split("T")[0],
};

export function IncidentsManager({ classroomId, students }: IncidentsManagerProps) {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (classroomId) fetchIncidents();
  }, [classroomId]);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("student_incidents")
        .select("*, student:profiles!student_incidents_student_id_fkey(first_name, last_name)")
        .eq("classroom_id", classroomId)
        .order("incident_date", { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      toast.error("Error al cargar las incidencias");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingIncident(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (incident: Incident) => {
    setEditingIncident(incident);
    setFormData({
      student_id: incident.student_id,
      incident_type: incident.incident_type,
      severity: incident.severity,
      description: incident.description,
      action_taken: incident.action_taken || "",
      incident_date: incident.incident_date,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.student_id || !formData.incident_type || !formData.severity || !formData.description.trim() || !formData.incident_date) {
      toast.error("Completa todos los campos requeridos");
      return;
    }

    try {
      setSaving(true);

      if (editingIncident) {
        // Update
        const { error } = await supabase
          .from("student_incidents")
          .update({
            student_id: formData.student_id,
            incident_type: formData.incident_type,
            severity: formData.severity,
            description: formData.description.trim(),
            action_taken: formData.action_taken.trim() || null,
            incident_date: formData.incident_date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingIncident.id);

        if (error) throw error;
        toast.success("Incidencia actualizada correctamente");
      } else {
        // Create
        const { error } = await supabase
          .from("student_incidents")
          .insert({
            student_id: formData.student_id,
            classroom_id: classroomId,
            incident_type: formData.incident_type,
            severity: formData.severity,
            description: formData.description.trim(),
            action_taken: formData.action_taken.trim() || null,
            status: "abierta",
            recorded_by: profile!.id,
            incident_date: formData.incident_date,
          });

        if (error) throw error;
        toast.success("Incidencia registrada correctamente");
      }

      setDialogOpen(false);
      fetchIncidents();
    } catch (error) {
      console.error("Error saving incident:", error);
      toast.error("Error al guardar la incidencia");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (incidentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("student_incidents")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", incidentId);

      if (error) throw error;
      toast.success("Estado actualizado");
      fetchIncidents();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Error al actualizar el estado");
    }
  };

  const getTypeConfig = (type: string) => INCIDENT_TYPES.find(t => t.value === type) || INCIDENT_TYPES[0];
  const getSeverityConfig = (sev: string) => SEVERITY_OPTIONS.find(s => s.value === sev) || SEVERITY_OPTIONS[0];
  const getStatusConfig = (st: string) => STATUS_OPTIONS.find(s => s.value === st) || STATUS_OPTIONS[0];

  const filteredIncidents = incidents.filter(inc => {
    if (filterType !== "all" && inc.incident_type !== filterType) return false;
    if (filterSeverity !== "all" && inc.severity !== filterSeverity) return false;
    if (filterStatus !== "all" && inc.status !== filterStatus) return false;
    return true;
  });

  // Stats
  const openCount = incidents.filter(i => i.status === "abierta").length;
  const followUpCount = incidents.filter(i => i.status === "en_seguimiento").length;
  const positiveCount = incidents.filter(i => i.incident_type === "positiva_reconocimiento").length;

  return (
    <div className="space-y-4">
      {/* Summary mini-cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border bg-card text-center">
          <div className="text-2xl font-bold">{incidents.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 text-center">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{openCount}</div>
          <div className="text-xs text-blue-600 dark:text-blue-500">Abiertas</div>
        </div>
        <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-950/30 text-center">
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{followUpCount}</div>
          <div className="text-xs text-yellow-600 dark:text-yellow-500">En seguimiento</div>
        </div>
        <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/30 text-center">
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">{positiveCount}</div>
          <div className="text-xs text-green-600 dark:text-green-500">Positivas</div>
        </div>
      </div>

      {/* Filters + Create button */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Registro de Incidencias
              </CardTitle>
              <CardDescription>Gestiona las incidencias de los estudiantes del aula</CardDescription>
            </div>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Incidencia
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters row */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {INCIDENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Gravedad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda gravedad</SelectItem>
                {SEVERITY_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Incidents list */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando incidencias...</div>
          ) : filteredIncidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay incidencias registradas</p>
              <p className="text-sm mt-1">Haz clic en "Nueva Incidencia" para registrar una</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIncidents.map((incident) => {
                const typeConf = getTypeConfig(incident.incident_type);
                const sevConf = getSeverityConfig(incident.severity);
                const statusConf = getStatusConfig(incident.status);
                const TypeIcon = typeConf.icon;

                return (
                  <div
                    key={incident.id}
                    className={`p-4 rounded-lg border ${typeConf.border} ${typeConf.bg} transition-colors hover:shadow-sm`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      {/* Left: Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <TypeIcon className={`h-4 w-4 ${typeConf.color}`} />
                          <Badge className={typeConf.badge} variant="secondary">{typeConf.label}</Badge>
                          <Badge className={sevConf.color} variant="secondary">{sevConf.label}</Badge>
                          <Badge className={statusConf.color} variant="secondary">{statusConf.label}</Badge>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span className="font-medium text-foreground">
                            {incident.student?.last_name}, {incident.student?.first_name}
                          </span>
                          <span>•</span>
                          <CalendarIcon className="h-3.5 w-3.5" />
                          <span>{format(new Date(incident.incident_date + "T12:00:00"), "dd MMM yyyy", { locale: es })}</span>
                        </div>

                        <p className="text-sm leading-relaxed">{incident.description}</p>

                        {incident.action_taken && (
                          <div className="text-sm mt-1 p-2 rounded bg-background/50 border">
                            <span className="font-medium text-muted-foreground">Acción tomada: </span>
                            {incident.action_taken}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col gap-2 items-end shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(incident)} className="gap-1.5">
                          <Edit className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Select
                          value={incident.status}
                          onValueChange={(val) => handleStatusChange(incident.id, val)}
                        >
                          <SelectTrigger className="w-[150px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIncident ? "Editar Incidencia" : "Registrar Nueva Incidencia"}</DialogTitle>
            <DialogDescription>
              {editingIncident ? "Modifica los datos de la incidencia" : "Completa los datos para registrar una nueva incidencia"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Warning about permanence - only show on create */}
            {!editingIncident && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">Importante:</span> Una vez creada, la incidencia no se podrá eliminar del sistema. Asegúrate de que los datos sean correctos antes de registrarla.
                </p>
              </div>
            )}
            {/* Student select */}
            <div className="space-y-2">
              <Label>Estudiante *</Label>
              <Select value={formData.student_id} onValueChange={(v) => setFormData(prev => ({ ...prev, student_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estudiante" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.last_name}, {s.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Tipo de Incidencia *</Label>
              <Select value={formData.incident_type} onValueChange={(v) => setFormData(prev => ({ ...prev, incident_type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label>Gravedad *</Label>
              <Select value={formData.severity} onValueChange={(v) => setFormData(prev => ({ ...prev, severity: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la gravedad" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Fecha del incidente *</Label>
              <Input
                type="date"
                value={formData.incident_date}
                onChange={(e) => setFormData(prev => ({ ...prev, incident_date: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descripción del hecho *</Label>
              <Textarea
                placeholder="Describe lo ocurrido con el mayor detalle posible..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>

            {/* Action taken */}
            <div className="space-y-2">
              <Label>Acción tomada</Label>
              <Textarea
                placeholder="Ej: se conversó con el alumno, se citó al padre, se derivó a psicología..."
                value={formData.action_taken}
                onChange={(e) => setFormData(prev => ({ ...prev, action_taken: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editingIncident ? "Actualizar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
