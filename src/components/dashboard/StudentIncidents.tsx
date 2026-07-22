import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BookOpen,
  Heart,
  Shield,
  Star,
  Calendar as CalendarIcon,
  FileText,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Incident {
  id: string;
  incident_type: string;
  severity: string;
  description: string;
  action_taken: string | null;
  status: string;
  incident_date: string;
  created_at: string;
}

const INCIDENT_TYPES: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  conductual: { label: "Conductual", icon: AlertTriangle, badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  académica: { label: "Académica", icon: BookOpen, badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  salud_accidente: { label: "Salud / Accidente", icon: Heart, badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  convivencia_bullying: { label: "Convivencia / Bullying", icon: Shield, badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  positiva_reconocimiento: { label: "Positiva / Reconocimiento", icon: Star, badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

const SEVERITY_COLORS: Record<string, string> = {
  leve: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  moderada: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  grave: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  abierta: { label: "Abierta", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  en_seguimiento: { label: "En seguimiento", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  cerrada: { label: "Cerrada", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

export function StudentIncidents() {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) fetchIncidents();
  }, [profile]);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("student_incidents")
        .select("id, incident_type, severity, description, action_taken, status, incident_date, created_at")
        .eq("student_id", profile!.id)
        .order("incident_date", { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Mis Incidencias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Mis Incidencias
          {incidents.length > 0 && (
            <Badge variant="secondary" className="ml-2">{incidents.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {incidents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-30 text-green-500" />
            <p className="font-medium">Sin incidencias registradas</p>
            <p className="text-sm mt-1">¡Sigue así! No tienes incidencias en tu historial.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => {
              const typeConf = INCIDENT_TYPES[incident.incident_type] || INCIDENT_TYPES.conductual;
              const TypeIcon = typeConf.icon;
              const sevColor = SEVERITY_COLORS[incident.severity] || SEVERITY_COLORS.leve;
              const statusConf = STATUS_CONFIG[incident.status] || STATUS_CONFIG.abierta;

              return (
                <div
                  key={incident.id}
                  className="p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <TypeIcon className="h-4 w-4 shrink-0" />
                    <Badge className={typeConf.badge} variant="secondary">{typeConf.label}</Badge>
                    <Badge className={sevColor} variant="secondary">{incident.severity}</Badge>
                    <Badge className={statusConf.color} variant="secondary">{statusConf.label}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {format(new Date(incident.incident_date + "T12:00:00"), "dd MMM yyyy", { locale: es })}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed">{incident.description}</p>

                  {incident.action_taken && (
                    <div className="text-sm mt-2 p-2 rounded bg-muted/50 border">
                      <span className="font-medium text-muted-foreground">Acción tomada: </span>
                      {incident.action_taken}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
