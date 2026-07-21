import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Settings, Table as TableIcon } from 'lucide-react';
import GradesConfigurationPanel from './GradesConfigurationPanel';
import GradesSpreadsheet from './GradesSpreadsheet';

export default function TeacherGradesConfig({ courseId }: { courseId: string }) {
  const [bimestres, setBimestres] = useState<any[]>([]);
  const [selectedBimestreId, setSelectedBimestreId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('spreadsheet'); // spreadsheet or config

  useEffect(() => {
    fetchBimestres();
  }, []);

  const fetchBimestres = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('academic_bimestres')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) throw error;
      setBimestres(data || []);
      
      // Auto-select current active bimestre
      if (data && data.length > 0) {
        const today = new Date();
        const current = data.find(b => {
          const start = new Date(b.start_date);
          const end = new Date(b.end_date);
          return today >= start && today <= end;
        });
        
        if (current) {
          setSelectedBimestreId(current.id);
        } else {
          // Defaults to first open or just first
          const firstOpen = data.find(b => !b.is_closed);
          setSelectedBimestreId(firstOpen ? firstOpen.id : data[0].id);
        }
      }
    } catch (error: any) {
      console.error('Error fetching bimestres:', error);
      toast.error('Error al cargar bimestres');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (bimestres.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No hay bimestres configurados por administración. Por favor contacta al administrador.</p>
        </CardContent>
      </Card>
    );
  }

  const selectedBimestre = bimestres.find(b => b.id === selectedBimestreId);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center bg-muted/30">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <span className="font-semibold whitespace-nowrap">Bimestre:</span>
            <Select value={selectedBimestreId} onValueChange={setSelectedBimestreId}>
              <SelectTrigger className="w-[200px] bg-background">
                <SelectValue placeholder="Selecciona un bimestre" />
              </SelectTrigger>
              <SelectContent>
                {bimestres.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.academic_year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBimestre?.is_closed && (
              <span className="text-sm font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-md">
                Cerrado
              </span>
            )}
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="spreadsheet" className="flex items-center gap-2">
                <TableIcon className="h-4 w-4" />
                Planilla
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuración
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {selectedBimestreId && (
        <div className="mt-4">
          {activeTab === 'config' ? (
            <GradesConfigurationPanel 
              courseId={courseId} 
              bimestreId={selectedBimestreId} 
              isClosed={selectedBimestre?.is_closed}
            />
          ) : (
            <GradesSpreadsheet 
              courseId={courseId} 
              bimestreId={selectedBimestreId} 
              isClosed={selectedBimestre?.is_closed}
            />
          )}
        </div>
      )}
    </div>
  );
}
