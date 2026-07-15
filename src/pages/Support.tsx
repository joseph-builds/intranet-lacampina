import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function Support() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Soporte Técnico</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Centro de Ayuda</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              El canal de soporte técnico se encuentra en mantenimiento. Muy pronto podrás reportar tus incidencias desde aquí.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}