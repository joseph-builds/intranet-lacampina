import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function Messages() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Mensajes</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Bandeja de entrada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              El módulo de mensajes está en construcción. Aquí integraremos el chat pronto.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}