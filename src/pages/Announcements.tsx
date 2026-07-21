import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Calendar as CalendarIcon, Paperclip, Trash2, Plus, FileText, Image as ImageIcon, Loader2, Users, BellRing, Edit, FileSpreadsheet, FileIcon, CheckSquare } from 'lucide-react';

interface Attachment { url: string; name: string; type: string; }

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_roles: string[];
  has_calendar_event: boolean;
  start_date: string | null;
  end_date: string | null;
  attachments: Attachment[]; // Nueva estructura JSON
  created_at: string;
}

const ROLES_TARGET = [
  { id: 'student', label: 'Estudiantes', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'teacher', label: 'Profesores', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'tutor', label: 'Tutores', color: 'bg-purple-100 text-purple-800 border-purple-200' }
];

export default function Announcements() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para Modal y Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados de Selección Masiva
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Formulario
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['student', 'teacher', 'tutor']);
  const [hasCalendar, setHasCalendar] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Archivos
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (profile) fetchAnnouncements();
  }, [profile]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      let query = supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (profile?.role !== 'admin') query = query.contains('target_roles', [profile?.role]);
      const { data, error } = await query;
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los comunicados.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter(f => f.size <= 5 * 1024 * 1024); // Máximo 5MB
      if (validFiles.length < selectedFiles.length) {
        toast({ title: "Archivos pesados", description: "Algunos archivos superan los 5MB y fueron descartados.", variant: "destructive" });
      }
      setFiles(prev => [...prev, ...validFiles]);
      e.target.value = ''; // Resetear input
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments(existingAttachments.filter((_, i) => i !== index));
  };

  const openEditModal = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setTitle(announcement.title);
    setContent(announcement.content);
    setSelectedRoles(announcement.target_roles);
    setHasCalendar(announcement.has_calendar_event);
    setStartDate(announcement.start_date || '');
    setEndDate(announcement.end_date || '');
    setExistingAttachments(announcement.attachments || []);
    setFiles([]);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoles.length === 0) return toast({ title: "Audiencia requerida", variant: "destructive" });
    if (hasCalendar && (!startDate || !endDate)) return toast({ title: "Fechas requeridas", variant: "destructive" });

    setIsSubmitting(true);
    try {
      let uploadedAttachments: Attachment[] = [...existingAttachments];

      // Subir archivos nuevos
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('announcements').upload(fileName, file);
        if (uploadError) throw new Error("Fallo al subir archivo: " + file.name);
        
        const url = supabase.storage.from('announcements').getPublicUrl(fileName).data.publicUrl;
        uploadedAttachments.push({ url, name: file.name, type: file.type });
      }

      const payload = {
        title: title.trim(),
        content: content.trim(),
        target_roles: selectedRoles,
        has_calendar_event: hasCalendar,
        start_date: hasCalendar ? startDate : null,
        end_date: hasCalendar ? endDate : null,
        attachments: uploadedAttachments,
        created_by: profile?.id
      };

      if (editingId) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', editingId);
        if (error) throw error;
        toast({ title: "Comunicado Actualizado" });
      } else {
        const { error } = await supabase.from('announcements').insert(payload);
        if (error) throw error;
        toast({ title: "Comunicado Publicado" });
      }

      setIsModalOpen(false);
      resetForm();
      fetchAnnouncements();

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar los ${selectedIds.length} comunicados seleccionados?`)) return;
    try {
      const { error } = await supabase.from('announcements').delete().in('id', selectedIds);
      if (error) throw error;
      toast({ title: "Comunicados eliminados masivamente" });
      setAnnouncements(prev => prev.filter(a => !selectedIds.includes(a.id)));
      setSelectedIds([]);
    } catch (error) {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };
  const handleDeleteSingle = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar definitivamente este comunicado?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Comunicado eliminado" });
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id)); // Lo limpia de la selección si estaba marcado
    } catch (error) {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setEditingId(null); setTitle(''); setContent(''); setHasCalendar(false); setStartDate(''); setEndDate(''); setFiles([]); setExistingAttachments([]); setSelectedRoles(['student', 'teacher', 'tutor']);
  };

  // Helper para iconos de archivos
  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    return <FileIcon className="w-5 h-5 text-gray-500" />;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl"><BellRing className="h-8 w-8" /></div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Mural de Anuncios</h1>
              <p className="text-slate-500 font-medium mt-1">Total registrados: {announcements.length}</p>
            </div>
          </div>
          
          {profile?.role === 'admin' && (
            <div className="flex gap-2">
              {selectedIds.length > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete} className="shadow-md font-bold animate-in fade-in">
                  <Trash2 className="w-4 h-4 mr-2" /> Borrar ({selectedIds.length})
                </Button>
              )}
              <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md font-bold px-6">
                    <Plus className="w-5 h-5 mr-2" /> Emitir Comunicado
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
                  <DialogHeader className="border-b pb-4 mb-4">
                    <DialogTitle className="text-2xl text-slate-800 flex items-center gap-2"><Megaphone className="w-6 h-6 text-blue-600"/> {editingId ? 'Editar Comunicado' : 'Nuevo Comunicado Institucional'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Campos de texto */}
                    <div className="space-y-4">
                      <div>
                        <Label className="font-bold text-slate-700 text-sm">Título del Comunicado <span className="text-red-500">*</span></Label>
                        <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Feriado por Semana Santa" className="mt-1" />
                      </div>
                      <div>
                        <Label className="font-bold text-slate-700 text-sm">Presentación / Cuerpo del Mensaje <span className="text-red-500">*</span></Label>
                        <Textarea required value={content} onChange={e => setContent(e.target.value)} placeholder="Escribe el detalle completo aquí..." className="mt-1 min-h-[140px]" />
                      </div>
                    </div>

                    {/* Roles y Calendario en 2 columnas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <Label className="font-bold text-slate-800 flex items-center gap-2 mb-3"><Users className="w-4 h-4"/> Audiencia Destino</Label>
                        <div className="flex flex-col gap-2">
                          {ROLES_TARGET.map(role => (
                            <label key={role.id} className="flex items-center space-x-3 bg-white px-3 py-2 rounded-lg border cursor-pointer hover:border-blue-300">
                              <Checkbox checked={selectedRoles.includes(role.id)} onCheckedChange={(c) => c ? setSelectedRoles([...selectedRoles, role.id]) : setSelectedRoles(selectedRoles.filter(r => r !== role.id))} />
                              <span className="font-semibold text-slate-700 text-sm">{role.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={`p-4 rounded-xl border transition-colors ${hasCalendar ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-bold text-slate-800 flex items-center gap-2 text-sm"><CalendarIcon className="w-4 h-4 text-indigo-600"/> Añadir al Calendario</Label>
                          <Switch checked={hasCalendar} onCheckedChange={setHasCalendar} />
                        </div>
                        {hasCalendar && (
                          <div className="space-y-3 animate-in fade-in">
                            <div><Label className="text-xs">Inicio</Label><Input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                            <div><Label className="text-xs">Fin</Label><Input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Subida Múltiple de Archivos */}
                    <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <Label className="font-bold text-slate-800 flex items-center gap-2"><Paperclip className="w-5 h-5 text-slate-600"/> Adjuntar Documentos o Imágenes</Label>
                      <div className="mt-3">
                        <Input type="file" multiple onChange={handleFileChange} className="bg-slate-50 cursor-pointer" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" />
                      </div>
                      
                      {/* Lista de archivos a subir / existentes */}
                      {(files.length > 0 || existingAttachments.length > 0) && (
                        <div className="mt-4 space-y-2">
                          {existingAttachments.map((att, i) => (
                            <div key={`old-${i}`} className="flex items-center justify-between p-2 bg-gray-50 border rounded-md text-sm">
                              <div className="flex items-center gap-2 truncate">{getFileIcon(att.type)} <span className="truncate">{att.name} (Ya subido)</span></div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeExistingAttachment(i)} className="text-red-500 h-6 w-6 p-0"><Trash2 className="w-4 h-4"/></Button>
                            </div>
                          ))}
                          {files.map((file, i) => (
                            <div key={`new-${i}`} className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded-md text-sm">
                              <div className="flex items-center gap-2 truncate">{getFileIcon(file.type)} <span className="truncate">{file.name} (Nuevo)</span></div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(i)} className="text-red-500 h-6 w-6 p-0"><Trash2 className="w-4 h-4"/></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                      <Button type="submit" className="bg-blue-600" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : (editingId ? 'Guardar Cambios' : 'Publicar')}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* FEED DE ANUNCIOS */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2].map(i => <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse"></div>)}
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed shadow-sm">
            <Megaphone className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-2xl font-black text-slate-700">Mural Despejado</h3>
          </div>
        ) : (
          <div className="grid gap-8">
            {announcements.map((announcement) => {
              const images = announcement.attachments?.filter(a => a.type.includes('image')) || [];
              const documents = announcement.attachments?.filter(a => !a.type.includes('image')) || [];

              return (
                <Card key={announcement.id} className={`border-slate-200 shadow-md hover:shadow-lg transition-all rounded-2xl relative ${selectedIds.includes(announcement.id) ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}`}>
                  
                  {/* Checkbox para Admin */}
                  {profile?.role === 'admin' && (
                    <div className="absolute top-4 left-4 z-10 bg-white/80 p-1 rounded-md">
                      <Checkbox 
                        checked={selectedIds.includes(announcement.id)} 
                        onCheckedChange={(c) => c ? setSelectedIds([...selectedIds, announcement.id]) : setSelectedIds(selectedIds.filter(id => id !== announcement.id))}
                        className="w-5 h-5 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                      />
                    </div>
                  )}

                  <div className={`h-1.5 w-full ${announcement.has_calendar_event ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`}></div>
                  
                  <CardHeader className={`pb-4 pt-6 ${profile?.role === 'admin' ? 'px-12' : 'px-6'}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <CardTitle className="text-2xl font-black text-slate-800 leading-tight">{announcement.title}</CardTitle>
                        <CardDescription className="mt-1 text-sm font-medium text-slate-500">
                          {new Date(announcement.created_at).toLocaleString('es-PE', { dateStyle: 'full', timeStyle: 'short' })}
                        </CardDescription>
                      </div>
                      {profile?.role === 'admin' && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(announcement)} className="text-blue-500 hover:bg-blue-50 rounded-full"><Edit className="w-5 h-5"/></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSingle(announcement.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"><Trash2 className="w-5 h-5" /></Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="px-6 pb-6 space-y-6">
                    {/* Sección Presentación */}
                    <div className="prose max-w-none">
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed font-medium text-lg">{announcement.content}</p>
                    </div>

                    {/* Sección Galería de Imágenes */}
                    {images.length > 0 && (
                      <div className="pt-4 border-t border-slate-100">
                        <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                          {images.map((img, idx) => (
                            <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border shadow-sm group">
                              <img src={img.url} alt={img.name} className="w-full h-48 md:h-64 object-cover transform group-hover:scale-105 transition-transform duration-300" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sección Documentos y Calendario */}
                    {(documents.length > 0 || announcement.has_calendar_event) && (
                      <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                        {announcement.has_calendar_event && (
                          <div className="flex items-center gap-2 text-indigo-700 text-sm font-bold bg-indigo-50 px-4 py-3 rounded-xl border border-indigo-100 w-fit">
                            <CalendarIcon className="w-5 h-5" /> Agendado: {announcement.start_date} al {announcement.end_date || announcement.start_date}
                          </div>
                        )}
                        
                        {documents.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {documents.map((doc, idx) => (
                              <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all group">
                                <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">{getFileIcon(doc.type)}</div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-700 truncate group-hover:text-blue-700">{doc.name}</p>
                                  <p className="text-[10px] text-slate-400 font-medium uppercase">Haga clic para descargar</p>
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}