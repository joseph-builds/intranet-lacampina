import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function Library() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Biblioteca Digital</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Material Académico y Recursos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              El módulo de biblioteca está en construcción. Muy pronto podrás consultar el catálogo de libros, lecturas y recursos digitales aquí.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}