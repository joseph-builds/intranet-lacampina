import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ParentLayout } from '@/components/layout/ParentLayout';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileText, Megaphone, FileSpreadsheet, FileIcon, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Attachment { url: string; name: string; type: string; }

interface CalendarEvent {
  id: string;
  title: string;
  content: string;
  start_date: string;
  end_date: string;
  attachments: Attachment[];
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function Calendar() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const Layout = profile?.role === 'parent' ? ParentLayout : DashboardLayout;

  // Rango de años para el selector (5 años atrás, 5 adelante)
  const currentYearBase = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYearBase - 5 + i);

  useEffect(() => {
    if (profile) fetchCalendarEvents();
  }, [profile, currentDate]);

  const fetchCalendarEvents = async () => {
    try {
      let query = supabase.from('announcements').select('*').eq('has_calendar_event', true).not('start_date', 'is', null);
      if (profile?.role !== 'admin') query = query.contains('target_roles', [profile?.role]);

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error cargando calendario", error);
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleMonthChange = (val: string) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(val), 1));
  const handleYearChange = (val: string) => setCurrentDate(new Date(parseInt(val), currentDate.getMonth(), 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const getTodayString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (type.includes('excel') || type.includes('spreadsheet')) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    return <FileIcon className="w-5 h-5 text-gray-500" />;
  };

  const renderCells = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const todayStr = getTodayString();
    
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-28 md:h-36 bg-slate-50/50 border border-slate-100 rounded-xl"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const currentCellDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = currentCellDate === todayStr;

      const dayEvents = events.filter(ev => {
        if (!ev.start_date) return false;
        return currentCellDate >= ev.start_date && currentCellDate <= (ev.end_date || ev.start_date);
      });

      cells.push(
        <div key={d} className={`h-28 md:h-36 p-2 border rounded-xl overflow-hidden flex flex-col transition-all group ${isToday ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-sm font-black w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-600 group-hover:bg-slate-100'}`}>
              {d}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {dayEvents.map(ev => {
              const isStart = ev.start_date === currentCellDate;
              return (
                <div key={ev.id} onClick={() => setSelectedEvent(ev)} className={`text-[10px] md:text-xs font-bold truncate px-2 py-1.5 rounded-md cursor-pointer shadow-sm ${isStart ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-indigo-100 text-indigo-800 border-l-2 border-indigo-500 hover:bg-indigo-200'}`} title={ev.title}>
                  {ev.title}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return cells;
  };

  const selectedImages = selectedEvent?.attachments?.filter(a => a.type.includes('image')) || [];
  const selectedDocs = selectedEvent?.attachments?.filter(a => !a.type.includes('image')) || [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl"><CalendarIcon className="h-8 w-8" /></div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Calendario Académico</h1>
            </div>
          </div>
          {profile?.role === 'admin' && (
            <Button onClick={() => window.location.href = '/anuncios'} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-11 px-6 shadow-md">
              <Megaphone className="w-5 h-5 mr-2" /> Agendar Evento
            </Button>
          )}
        </div>

        <Card className="border-0 shadow-xl bg-white overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            {/* CONTROLES RÁPIDOS DE FECHA */}
            <div className="flex flex-wrap items-center justify-between p-4 md:p-6 bg-slate-50 border-b border-slate-100 gap-4">
              
              <div className="flex items-center gap-3">
                <Select value={currentDate.getMonth().toString()} onValueChange={handleMonthChange}>
                  <SelectTrigger className="w-[140px] bg-white font-bold text-lg border-slate-200 focus:ring-indigo-500"><SelectValue /></SelectTrigger>
                  <SelectContent>{monthNames.map((m, i) => <SelectItem key={i} value={i.toString()} className="font-medium">{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={currentDate.getFullYear().toString()} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-[100px] bg-white font-bold text-lg border-slate-200 focus:ring-indigo-500"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()} className="font-medium">{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                <Button variant="ghost" size="icon" onClick={prevMonth} className="hover:bg-slate-100"><ChevronLeft className="w-5 h-5" /></Button>
                <Button variant="ghost" onClick={() => setCurrentDate(new Date())} className="font-bold px-6 hover:bg-slate-100">Hoy</Button>
                <Button variant="ghost" size="icon" onClick={nextMonth} className="hover:bg-slate-100"><ChevronRight className="w-5 h-5" /></Button>
              </div>
            </div>

            {/* CUADRÍCULA */}
            <div className="p-4 md:p-6 bg-white">
              <div className="grid grid-cols-7 gap-2 md:gap-4 mb-4">
                {dayNames.map(day => <div key={day} className="text-center font-black text-xs md:text-sm uppercase tracking-widest text-slate-400 py-2">{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2 md:gap-4">
                {renderCells()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MODAL DEL EVENTO MEJORADO */}
        <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
          <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-white/20 text-white border-0 uppercase font-bold tracking-wider">Evento Oficial</Badge>
                <span className="text-sm font-bold opacity-90">{selectedEvent?.start_date} {selectedEvent?.end_date && selectedEvent.end_date !== selectedEvent.start_date ? ` al ${selectedEvent.end_date}` : ''}</span>
              </div>
              <DialogTitle className="text-2xl md:text-3xl font-black">{selectedEvent?.title}</DialogTitle>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Sección Presentación */}
              <div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-2">Detalles del Evento</h4>
                <DialogDescription className="text-slate-700 text-base md:text-lg whitespace-pre-wrap font-medium">{selectedEvent?.content}</DialogDescription>
              </div>
              
              {/* Sección Imágenes */}
              {selectedImages.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <div className={`grid gap-2 ${selectedImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {selectedImages.map((img, idx) => (
                      <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer">
                        <img src={img.url} alt={img.name} className="w-full h-48 object-cover rounded-xl border shadow-sm hover:opacity-90" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Sección Documentos */}
              {selectedDocs.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Documentos Adjuntos</h4>
                  <div className="grid gap-3">
                    {selectedDocs.map((doc, idx) => (
                      <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
                        <div className="p-2 bg-white rounded-lg shadow-sm group-hover:shadow-md">{getFileIcon(doc.type)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700">{doc.name}</p>
                          <p className="text-xs text-slate-500 font-medium">Clic para abrir</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
}