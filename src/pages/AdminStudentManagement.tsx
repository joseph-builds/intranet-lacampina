import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Edit, Users, BookOpen, Mail, Phone, GraduationCap, ShieldAlert, CheckCircle2, AlertTriangle, CheckSquare, ArrowUpDown, Download, UploadCloud, FileSpreadsheet, Loader2, Trash2, Key, Check } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();
const COLUMNA_CURSO = 'section_course_id'; 

// --- INTERFACES ---
interface Level { id: string; name: string; }
interface Grade { id: string; name: string; level_id: string; level?: Level; }
interface Section { id: string; grade_id: string; name: string; room_number: string; }
interface Student {
  id: string; 
  first_name: string; 
  last_name: string; 
  email: string;
  dni: string | null;
  birth_date: string | null;
  phone: string | null; 
  guardian_name: string | null; 
  emergency_phone: string | null;
  role: string; 
  is_active: boolean; 
  current_grade_id?: string; 
  grade?: Grade;
  section_id?: string; 
  section_name?: string; 
}

interface StudentFormData {
  first_name: string; last_name: string; email: string; dni: string; birth_date: string;
  phone: string; guardian_name: string; emergency_phone: string; 
  current_grade_id: string; section_id: string;
  password?: string;
}

interface CourseDisplay {
  base_course_id: string;
  section_course_id: string | null;
  name: string;
  area: string;
  is_mandatory: boolean;
  isActive: boolean;
}

const AdminStudentManagement = () => {
  const { toast } = useToast();
  const { createUserByAdmin } = useAuth(); 
  
  const [students, setStudents] = useState<Student[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [studentMallaCourses, setStudentMallaCourses] = useState<CourseDisplay[]>([]);
  const [exemptions, setExemptions] = useState<string[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkGradeModalOpen, setIsBulkGradeModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [deletingStudents, setDeletingStudents] = useState<Student[]>([]);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatusValue, setBulkStatusValue] = useState<'active' | 'inactive'>('active');
  const [bulkGradeValue, setBulkGradeValue] = useState('unassigned');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [nivelFilter, setNivelFilter] = useState('all');
  const [gradoFilter, setGradoFilter] = useState('all');
  
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [newManualPassword, setNewManualPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const initialFormState: StudentFormData = {
    first_name: '', last_name: '', email: '', dni: '', birth_date: '', phone: '', 
    guardian_name: '', emergency_phone: '', current_grade_id: 'unassigned', section_id: 'unassigned',
    password: 'colegio123' 
  };
  const [formData, setFormData] = useState<StudentFormData>(initialFormState);

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { setGradoFilter('all'); }, [nivelFilter]);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchLevelsAndGrades(), fetchStudents()]);
    setLoading(false);
  };

  const fetchLevelsAndGrades = async () => {
    try {
      const [levelsRes, gradesRes, sectionsRes] = await Promise.all([
        supabase.from('academic_levels').select('*').order('level_order'),
        supabase.from('academic_grades').select('*, level:academic_levels(id, name)').order('grade_order'),
        supabase.from('sections').select('*').eq('academic_year', CURRENT_YEAR).order('name')
      ]);
      if (levelsRes.data) setLevels(levelsRes.data);
      if (gradesRes.data) setGrades(gradesRes.data);
      if (sectionsRes.data) setSections(sectionsRes.data as Section[]);
    } catch (error) {
      console.error("Error cargando estructura académica", error);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data: perfiles, error } = await supabase
        .from('profiles')
        .select(`
          id, first_name, last_name, email, dni, birth_date, phone, guardian_name, emergency_phone, is_active, role, current_grade_id,
          grade:academic_grades(id, name, level:academic_levels(id, name))
        `)
        .eq('role', 'student')
        .order('first_name', { ascending: true });

      if (error) throw error;

      const { data: matriculas } = await supabase
        .from('student_sections')
        .select('student_id, section_id, sections(id, name)')
        .eq('academic_year', CURRENT_YEAR);

      const alumnosMapeados = (perfiles || []).map(perfil => {
        const matricula = matriculas?.find(m => m.student_id === perfil.id);
        return {
          ...perfil,
          section_id: matricula?.section_id,
          section_name: matricula?.sections?.name
        } as Student;
      });

      setStudents(alumnosMapeados);
      setSelectedIds([]);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los estudiantes.", variant: "destructive" });
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const searchStr = `${student.first_name} ${student.last_name} ${student.email} ${student.dni || ''} ${student.guardian_name || ''}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && student.is_active) || (filterStatus === 'inactive' && !student.is_active);
      const studentLevelId = student.grade?.level?.id || 'unassigned';
      const studentGradeId = student.grade?.id || 'unassigned';
      const matchesNivel = nivelFilter === 'all' || studentLevelId === nivelFilter;
      const matchesGrado = gradoFilter === 'all' || studentGradeId === gradoFilter;
      return matchesSearch && matchesStatus && matchesNivel && matchesGrado;
    });
  }, [students, searchTerm, filterStatus, nivelFilter, gradoFilter]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedStudents = useMemo(() => {
    let sortable = [...filteredStudents];
    if (sortConfig !== null) {
      sortable.sort((a: any, b: any) => {
        let aValue = '', bValue = '';
        if (sortConfig.key === 'name') {
          aValue = `${a.first_name} ${a.last_name}`.toLowerCase();
          bValue = `${b.first_name} ${b.last_name}`.toLowerCase();
        } else if (sortConfig.key === 'grade') {
          aValue = a.grade?.name?.toLowerCase() || 'zzz';
          bValue = b.grade?.name?.toLowerCase() || 'zzz';
        } else {
          aValue = (a[sortConfig.key] || '').toString().toLowerCase();
          bValue = (b[sortConfig.key] || '').toString().toLowerCase();
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      sortable.sort((a, b) => a.first_name.localeCompare(b.first_name));
    }
    return sortable;
  }, [filteredStudents, sortConfig]);

  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage);
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedStudents, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, nivelFilter, gradoFilter, itemsPerPage]);

  const availableGradesForFilter = useMemo(() => {
    if (nivelFilter === 'all') return grades;
    return grades.filter(g => g.level_id === nivelFilter);
  }, [grades, nivelFilter]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageIds = paginatedStudents.map(c => c.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      setSelectedIds(prev => prev.filter(id => !paginatedStudents.map(c => c.id).includes(id)));
    }
  };
  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) setSelectedIds(prev => [...prev, id]);
    else setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
  };
  const isAllPageSelected = paginatedStudents.length > 0 && paginatedStudents.every(c => selectedIds.includes(c.id));

  // --- LÓGICA DE ELIMINACIÓN Y SEGURIDAD ---
  const blockedFromDeletion = useMemo(() => deletingStudents.filter(s => s.current_grade_id), [deletingStudents]);
  const safeToDelete = useMemo(() => deletingStudents.filter(s => !s.current_grade_id), [deletingStudents]);

  const handleBulkDelete = async () => {
    if (safeToDelete.length === 0) return;
    setSaving(true);
    try {
      for (const student of safeToDelete) {
        const { error } = await supabase.rpc('delete_user_admin_v2', { 
          target_user_id: student.id,
          target_email: student.email 
        });
        if (error) throw error;
      }
      toast({ title: "Estudiantes eliminados", description: `Se eliminaron ${safeToDelete.length} estudiante(s) por completo del sistema.` });
      setIsDeleteModalOpen(false);
      setDeletingStudents([]);
      await fetchStudents();
    } catch (error: any) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleBulkStatus = async () => {
    setSaving(true);
    try {
      const isActive = bulkStatusValue === 'active';
      const { data, error } = await supabase.from('profiles').update({ is_active: isActive }).in('id', selectedIds).select();
      if (error || !data || data.length === 0) throw new Error("Fallo de permisos.");
      toast({ title: "Estados actualizados", description: `Se modificó el estado de ${data.length} estudiante(s).` });
      setIsBulkStatusModalOpen(false);
      fetchStudents();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); } finally { setSaving(false); }
  };

  const handleBulkGrade = async () => {
    setSaving(true);
    try {
      const gradeId = bulkGradeValue === 'unassigned' ? null : bulkGradeValue;
      const { data, error } = await supabase.from('profiles').update({ current_grade_id: gradeId }).in('id', selectedIds).select();
      if (error || !data || data.length === 0) throw new Error("Fallo de permisos.");
      
      await supabase.from('student_sections').delete().in('student_id', selectedIds).eq('academic_year', CURRENT_YEAR);

      toast({ title: "Grados actualizados", description: `Se asignó el nuevo grado a ${data.length} estudiante(s).` });
      setIsBulkGradeModalOpen(false);
      fetchStudents();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); } finally { setSaving(false); }
  };

  const handleManualPasswordChange = async (studentEmail: string) => {
    if (newManualPassword.length < 6) {
      return toast({ title: "Atención", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
    }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.rpc('force_reset_password_by_email', { target_email: studentEmail, new_password: newManualPassword });
      if (error) throw error;
      toast({ title: "Contraseña Actualizada", description: "El alumno ya puede ingresar con la nueva clave." });
      setNewManualPassword('');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsChangingPassword(false); }
  };

  const handleToggleStatus = async (student: Student, newStatus: boolean) => {
    try {
      const { data, error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', student.id).select();
      if (error || !data || data.length === 0) throw new Error("Fallo de permisos.");
      toast({ title: "Estado actualizado", description: `El alumno ha sido ${newStatus ? 'activado' : 'desmatriculado'}.` });
      fetchStudents(); 
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const guardarMatriculaAula = async (studentId: string, sectionId: string) => {
    if (sectionId === 'unassigned') {
      await supabase.from('student_sections').delete().eq('student_id', studentId).eq('academic_year', CURRENT_YEAR);
    } else {
      await supabase.from('student_sections').delete().eq('student_id', studentId).eq('academic_year', CURRENT_YEAR);
      await supabase.from('student_sections').insert({ student_id: studentId, section_id: sectionId, academic_year: CURRENT_YEAR });
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dni || !formData.first_name || !formData.last_name || !formData.email) {
      return toast({ title: "Campos obligatorios", description: "DNI, Nombres, Apellidos y Correo son requeridos.", variant: "destructive" });
    }
    if (!editingStudent && (!formData.password || formData.password.length < 6)) {
      return toast({ title: "Contraseña inválida", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
    }

    setSaving(true);
    try {
      if (editingStudent) {
        const payload: any = {
          first_name: formData.first_name.trim(), last_name: formData.last_name.trim(),
          dni: formData.dni.trim(), phone: formData.phone.trim() || null,
          guardian_name: formData.guardian_name.trim() || null, emergency_phone: formData.emergency_phone.trim() || null,
          birth_date: formData.birth_date || null, current_grade_id: formData.current_grade_id === 'unassigned' ? null : formData.current_grade_id,
        };
        const { data, error } = await supabase.from('profiles').update(payload).eq('id', editingStudent.id).select();
        if (error || !data || data.length === 0) throw new Error("No se pudo actualizar la ficha.");
        
        await guardarMatriculaAula(editingStudent.id, formData.section_id);
        toast({ title: "Éxito", description: "Ficha del estudiante actualizada." });
      } else {
        const isDup = students.some(s => s.dni === formData.dni.trim() || s.email === formData.email.trim());
        if (isDup) throw new Error("Ya existe un estudiante con este DNI o Correo.");

        const { error: authError } = await createUserByAdmin({
          email: formData.email.trim(), password: formData.password || 'colegio123',
          first_name: formData.first_name.trim(), last_name: formData.last_name.trim(), role: 'student'
        });
        if (authError) throw authError; 

        const { data: newProfile } = await supabase.from('profiles').select('id').eq('email', formData.email.trim()).single();
        const { error: profileError } = await supabase.from('profiles').update({
          dni: formData.dni.trim(), phone: formData.phone.trim() || null,
          guardian_name: formData.guardian_name.trim() || null, emergency_phone: formData.emergency_phone.trim() || null,
          birth_date: formData.birth_date || null, current_grade_id: formData.current_grade_id === 'unassigned' ? null : formData.current_grade_id,
        }).eq('email', formData.email.trim());
        if (profileError) throw new Error("Se creó la cuenta, pero hubo un error guardando el DNI.");

        if (newProfile && formData.section_id !== 'unassigned') {
           await guardarMatriculaAula(newProfile.id, formData.section_id);
        }
        toast({ title: "Cuenta Creada", description: "El estudiante ya puede iniciar sesión." });
      }
      closeModal();
      fetchStudents(); 
    } catch (error: any) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const openCreateModal = () => { setEditingStudent(null); setFormData(initialFormState); setNewManualPassword(''); setIsModalOpen(true); };
  
  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setNewManualPassword('');
    setFormData({
      first_name: student.first_name || '', last_name: student.last_name || '', email: student.email || '',
      dni: student.dni || '', birth_date: student.birth_date || '',
      phone: student.phone || '', guardian_name: student.guardian_name || '', emergency_phone: student.emergency_phone || '',
      current_grade_id: student.current_grade_id || 'unassigned',
      section_id: student.section_id || 'unassigned' 
    });
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditingStudent(null); setFormData(initialFormState); setNewManualPassword(''); };

  // --- LOGICA REPARADA Y OPTIMIZADA DE CURSOS/EXONERACIONES ---
  const openEnrollModal = async (student: Student) => {
    setSelectedStudent(student);
    setStudentMallaCourses([]);
    setExemptions([]);
    setIsEnrollModalOpen(true);
    
    if (student.current_grade_id) {
      setLoadingCourses(true);
      try {
        const { data: baseCourses, error: baseErr } = await supabase.from('base_courses').select('id, name, area, is_mandatory, course:courses(is_active)').eq('grade_id', student.current_grade_id).order('name');
        if (baseErr) throw baseErr;

        // 1. Verificar si el alumno realmente tiene Aula Asignada en BD
        let currentSectionId = student.section_id;
        if (!currentSectionId) {
            const { data: matricula } = await supabase.from('student_sections').select('section_id').eq('student_id', student.id).eq('academic_year', CURRENT_YEAR).maybeSingle();
            if (matricula) currentSectionId = matricula.section_id;
        }

        let secCourseMap: Record<string, string> = {};
        
        // 2. Si tiene aula, buscamos los cursos de esa aula. Si le faltan cursos de la malla, los AUTO-SINCRONIZAMOS (Solución del bug rojo).
        if (currentSectionId) {
           const { data: secCourses } = await supabase.from('section_courses').select('id, base_course_id').eq('section_id', currentSectionId);
           
           const missingBaseCourses = (baseCourses || []).filter((bc: any) => !secCourses?.some(sc => sc.base_course_id === bc.id));
           
           if (missingBaseCourses.length > 0) {
               // Auto-sincronizamos los cursos que faltan en el aula
               const inserts = missingBaseCourses.map((bc: any) => ({ section_id: currentSectionId, base_course_id: bc.id }));
               const { data: newSecCourses } = await supabase.from('section_courses').insert(inserts).select('id, base_course_id');
               
               [...(secCourses || []), ...(newSecCourses || [])].forEach(sc => { secCourseMap[sc.base_course_id] = sc.id; });
           } else {
               secCourses?.forEach(sc => { secCourseMap[sc.base_course_id] = sc.id; });
           }
        }

        const combinedCourses: CourseDisplay[] = (baseCourses || []).map((bc: any) => ({
           base_course_id: bc.id,
           section_course_id: secCourseMap[bc.id] || null, 
           name: bc.name,
           area: bc.area,
           is_mandatory: bc.is_mandatory,
           isActive: Array.isArray(bc.course) ? bc.course[0]?.is_active : bc.course?.is_active
        }));
        setStudentMallaCourses(combinedCourses);

        const { data: exempData } = await supabase.from('student_course_exemptions').select(COLUMNA_CURSO).eq('student_id', student.id);
        setExemptions(exempData?.map(e => e[COLUMNA_CURSO]) || []);
      } catch (err: any) { 
        toast({ title: "Error cargando cursos", description: err.message, variant: "destructive" }); 
      } finally { setLoadingCourses(false); }
    }
  };

  const handleToggleExemption = async (scId: string | null, isExempted: boolean) => {
    if (!selectedStudent) return;
    if (!scId) {
      toast({ title: "Aula requerida", description: "Para guardar exoneraciones, primero debes asignar una Sección (Aula Virtual) al estudiante editando su ficha y dándole a Guardar.", variant: "destructive" });
      return;
    }
    try {
      if (isExempted) {
        const {error} = await supabase.from('student_course_exemptions').insert({ student_id: selectedStudent.id, [COLUMNA_CURSO]: scId });
        if(error) throw error;
        setExemptions(prev => [...prev, scId]);
        toast({ title: "Exonerado", description: "El alumno ya no llevará este curso." });
      } else {
        const {error} = await supabase.from('student_course_exemptions').delete().eq('student_id', selectedStudent.id).eq(COLUMNA_CURSO, scId);
        if(error) throw error;
        setExemptions(prev => prev.filter(id => id !== scId));
        toast({ title: "Inscrito", description: "El alumno ha sido reincorporado al curso." });
      }
    } catch (error:any) { toast({ title: "Error al guardar", description: error.message, variant: "destructive" }); }
  };

  const downloadTemplate = () => {
    const headers = "DNI;Nombres;Apellidos;Correo;Telefono;Apoderado;Telefono_Emergencia\n";
    const example1 = "77665544;Juan Luis;Perez Garcia;juan.perez@colegio.edu.pe;987654321;Maria Garcia;999888777\n";
    const example2 = "11223344;Ana;Lopez Ruiz;ana.lopez@colegio.edu.pe;;;\n";
    const blob = new Blob(['\uFEFF' + headers + example1 + example2], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "plantilla_estudiantes_colegio.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length <= 1) throw new Error("El archivo está vacío o solo contiene la cabecera.");

        const validRowsToCreate = [];
        const duplicates = [];
        const separator = rows[0].includes(';') ? ';' : ',';

        for (let i = 1; i < rows.length; i++) {
          const regex = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
          const cols = rows[i].split(regex).map(col => col.replace(/^"|"$/g, '').trim());
          if (cols.length < 4) continue;

          const dni = cols[0], first_name = cols[1], last_name = cols[2], email = cols[3];
          const phone = cols[4] || null, guardian_name = cols[5] || null, emergency_phone = cols[6] || null;
          
          if (!dni || !first_name || !last_name || !email) continue;

          const isDupInDB = students.some(s => s.dni === dni || s.email === email);
          const isDupInList = validRowsToCreate.some(s => s.dni === dni || s.email === email);

          if (isDupInDB || isDupInList) {
            duplicates.push(dni);
          } else {
            validRowsToCreate.push({ dni, first_name, last_name, email, phone, guardian_name, emergency_phone });
          }
        }

        let insertedCount = 0;
        let authErrors = 0;

        if (validRowsToCreate.length > 0) {
           toast({ title: "Procesando Excel...", description: "Creando cuentas de acceso. Esto puede demorar unos segundos." });
           
           for (const row of validRowsToCreate) {
             const { error: authError } = await createUserByAdmin({
                email: row.email,
                password: 'colegio123',
                first_name: row.first_name,
                last_name: row.last_name,
                role: 'student'
             });

             if (authError) {
                 authErrors++;
             } else {
                 await supabase.from('profiles').update({
                    dni: row.dni,
                    phone: row.phone || null,
                    guardian_name: row.guardian_name || null,
                    emergency_phone: row.emergency_phone || null
                 }).eq('email', row.email);

                 insertedCount++;
             }
           }
        }

        let message = `Se crearon accesos para ${insertedCount} estudiantes.`;
        if (duplicates.length > 0) message += ` Se omitieron ${duplicates.length} duplicados.`;
        if (authErrors > 0) message += ` Fallaron ${authErrors} correos.`;

        toast({ title: "Importación finalizada", description: message });
        await fetchStudents();
      } catch (error: any) {
        toast({ title: "Fallo en Importación", description: error.message, variant: "destructive" });
      } finally {
        setIsUploading(false);
        e.target.value = ''; 
      }
    };
    reader.readAsText(file);
  };

  const aulasDelGrado = sections.filter(s => s.grade_id === formData.current_grade_id);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800">
              <Users className="h-8 w-8 text-blue-600" /> Gestión de Estudiantes
            </h1>
            <p className="text-gray-600 mt-1">Administra cuentas, alumnos, secciones y su matrícula.</p>
          </div>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 shadow-md">
            <Plus className="w-4 h-4 mr-2" />Nuevo Estudiante
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
            <div className="p-4">
              <div className="text-sm font-medium text-gray-600 flex items-center justify-between">Total Registrados <Users className="inline h-5 w-5 text-blue-500" /></div>
              <div className="text-3xl font-bold text-gray-800">{students.length}</div>
            </div>
          </Card>
          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
            <div className="p-4">
              <div className="text-sm font-medium text-gray-600 flex items-center justify-between">Alumnos Activos <CheckCircle2 className="inline h-5 w-5 text-green-500" /></div>
              <div className="text-3xl font-bold text-gray-800">{students.filter(s => s.is_active).length}</div>
            </div>
          </Card>
          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-red-400">
            <div className="p-4">
              <div className="text-sm font-medium text-gray-600 flex items-center justify-between">Desmatriculados <ShieldAlert className="inline h-5 w-5 text-red-400" /></div>
              <div className="text-3xl font-bold text-gray-800">{students.filter(s => !s.is_active).length}</div>
            </div>
          </Card>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[250px] flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar alumno, DNI o apoderado..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-full" />
              </div>
              <Select value={nivelFilter} onValueChange={(val) => { setNivelFilter(val); setGradoFilter('all'); }}>
                <SelectTrigger className="min-w-[180px] w-auto"><SelectValue placeholder="Niveles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Niveles</SelectItem>
                  {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={gradoFilter} onValueChange={setGradoFilter} disabled={nivelFilter === 'all'}>
                <SelectTrigger className="min-w-[180px] w-auto"><SelectValue placeholder="Grados" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Grados</SelectItem>
                  {availableGradesForFilter.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="min-w-[160px] w-auto"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Desmatriculados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-gray-600">Mostrar</span>
              <Select value={String(itemsPerPage)} onValueChange={val => setItemsPerPage(Number(val))}>
                <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="bg-blue-50/50 p-3 flex flex-wrap items-center justify-between rounded-md border border-blue-200 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-blue-700 font-medium">
                <CheckSquare className="w-5 h-5" /> {selectedIds.length} alumno(s) seleccionado(s)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="bg-white border-blue-200 hover:bg-blue-50" onClick={() => setIsBulkStatusModalOpen(true)}>Cambiar Estado</Button>
                <Button variant="outline" size="sm" className="bg-white border-blue-200 hover:bg-blue-50" onClick={() => setIsBulkGradeModalOpen(true)}>Asignar Grado</Button>
                <Button variant="destructive" size="sm" onClick={() => { 
                  setDeletingStudents(students.filter(s => selectedIds.includes(s.id))); 
                  setIsDeleteModalOpen(true); 
                }}>Eliminar Seleccionados</Button>
              </div>
            </div>
          )}
        </div>

        <Card className="border-0 shadow-sm rounded-lg overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-500 animate-pulse">Cargando base de datos de estudiantes...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/80">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" checked={isAllPageSelected} onChange={(e) => handleSelectAll(e.target.checked)} />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-100 group select-none" onClick={() => requestSort('name')}>
                        <div className="flex items-center gap-1">Estudiante <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'name' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} /></div>
                      </TableHead>
                      <TableHead className="w-24 cursor-pointer hover:bg-gray-100 group select-none" onClick={() => requestSort('dni')}>
                        <div className="flex items-center gap-1">DNI <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'dni' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-100 group select-none" onClick={() => requestSort('grade')}>
                        <div className="flex items-center gap-1">Ubicación Académica <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'grade' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} /></div>
                      </TableHead>
                      <TableHead>Apoderado / Contacto</TableHead>
                      <TableHead className="text-center w-28">Estado</TableHead>
                      <TableHead className="text-right pr-6 w-32">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" /> No se encontraron estudiantes.</TableCell>
                      </TableRow>
                    ) : (
                      paginatedStudents.map((student) => (
                        <TableRow key={student.id} className={`hover:bg-gray-50/50 ${!student.is_active ? 'bg-red-50/30 opacity-75' : ''} ${selectedIds.includes(student.id) ? 'bg-blue-50/30' : ''}`}>
                          <TableCell className="text-center">
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" checked={selectedIds.includes(student.id)} onChange={(e) => handleSelectOne(student.id, e.target.checked)} />
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-gray-900">{student.first_name} {student.last_name}</div>
                            <div className="text-xs text-gray-500 flex items-center mt-1"><Mail className="w-3 h-3 mr-1" /> {student.email}</div>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-gray-600">{student.dni || '-'}</TableCell>
                          <TableCell>
                            {student.grade ? (
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`${student.is_active ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'} font-semibold`}>{student.grade.name}</Badge>
                                  {student.section_id ? (
                                    <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 text-[10px] px-1.5 py-0 border-green-200 border">Aula {student.section_name}</Badge>
                                  ) : (
                                    <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 flex items-center"><ShieldAlert className="w-3 h-3 mr-1"/> No asignado</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 pl-1">{student.grade.level?.name}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-orange-500 italic flex items-center"><ShieldAlert className="w-3 h-3 mr-1"/> Sin grado</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.guardian_name ? (
                              <div className="text-sm font-medium text-gray-700">{student.guardian_name}</div>
                            ) : <span className="text-xs text-gray-400 italic">No registrado</span>}
                            {student.emergency_phone ? (
                              <div className="text-xs text-red-600 flex items-center mt-1 font-medium"><Phone className="w-3 h-3 mr-1" /> {student.emergency_phone}</div>
                            ) : (
                              student.phone && <div className="text-xs text-gray-500 flex items-center mt-1"><Phone className="w-3 h-3 mr-1" /> {student.phone}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                             <div className="flex items-center justify-center gap-2">
                                <Switch checked={student.is_active} onCheckedChange={(val) => handleToggleStatus(student, val)} />
                                <span className={`text-[11px] font-bold w-12 text-left ${student.is_active ? "text-green-600" : "text-red-500"}`}>{student.is_active ? 'ACTIVO' : 'INACTIVO'}</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50" onClick={() => openEnrollModal(student)} title="Ver Cursos/Matrícula"><BookOpen className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50" onClick={() => openEditModal(student)} title="Editar Ficha"><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" onClick={() => { setDeletingStudents([student]); setIsDeleteModalOpen(true); }} title="Eliminar Alumno"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white border-t">
              <div className="text-sm text-gray-500 mb-4 sm:mb-0">Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sortedStudents.length)} de {sortedStudents.length} estudiantes</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button>
                <div className="flex items-center px-4 py-2 text-sm font-medium bg-white rounded-md border">Página {currentPage} de {Math.max(1, totalPages)}</div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Siguiente</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="pt-6">
          <Card className="border border-blue-100 bg-blue-50/20 shadow-sm">
            <CardHeader className="pb-3 border-b bg-white rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800"><FileSpreadsheet className="w-5 h-5" /> Importación Masiva de Estudiantes</CardTitle>
              <CardDescription>Sube un archivo CSV para matricular a decenas de alumnos en un solo clic y generar sus cuentas de acceso.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                    <div>
                      <h4 className="font-semibold text-gray-800">Columnas del Archivo CSV</h4>
                      <p className="text-sm text-gray-600 mb-1">Obligatorias: <span className="font-bold text-red-600">DNI, Nombres, Apellidos, Correo</span></p>
                      <p className="text-sm text-gray-500 mb-3">Opcionales: <span className="font-medium">Telefono, Apoderado, Telefono_Emergencia</span></p>
                      <Button variant="outline" size="sm" onClick={downloadTemplate} className="border-blue-300 text-blue-700 hover:bg-blue-50"><Download className="w-4 h-4 mr-2" /> Descargar Plantilla .CSV</Button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                    <div>
                      <h4 className="font-semibold text-gray-800">Sube tu archivo completado</h4>
                      <p className="text-sm text-gray-500">Se crearán las cuentas automáticamente con la contraseña: <strong>colegio123</strong>.</p>
                    </div>
                  </div>
                </div>
                <div className="relative border-2 border-dashed border-blue-200 rounded-xl p-8 text-center bg-white hover:bg-blue-50/50 cursor-pointer">
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-4"><Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" /><p className="text-sm font-medium">Creando cuentas y registros...</p></div>
                  ) : (
                    <>
                      <UploadCloud className="w-12 h-12 mx-auto text-blue-400 mb-3" />
                      <p className="text-sm font-medium text-gray-700">Haz clic para buscar un archivo CSV</p>
                      <Input type="file" accept=".csv" className="hidden" id="file-upload" onChange={handleFileUpload} disabled={isUploading}/>
                      <label htmlFor="file-upload" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md text-sm cursor-pointer hover:bg-blue-700">Seleccionar Archivo</label>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={isModalOpen} onOpenChange={(open) => { if(!open) closeModal(); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">{editingStudent ? 'Editar Ficha del Estudiante' : 'Registrar Nuevo Estudiante y Cuenta'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveStudent} className="space-y-6 mt-4">
              
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2">1. Datos Personales</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>DNI <span className="text-red-500">*</span></Label><Input value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} required autoFocus maxLength={8}/></div>
                  <div className="space-y-2"><Label>Nombres <span className="text-red-500">*</span></Label><Input value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required /></div>
                  <div className="space-y-2"><Label>Apellidos <span className="text-red-500">*</span></Label><Input value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required /></div>
                  
                  <div className="space-y-2"><Label>Correo (Login) <span className="text-red-500">*</span></Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required disabled={!!editingStudent} className={editingStudent ? "bg-gray-100 cursor-not-allowed" : ""}/></div>
                  
                  {!editingStudent && (
                    <div className="space-y-2">
                      <Label>Contraseña Inicial <span className="text-red-500">*</span></Label>
                      <Input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={6}/>
                      <p className="text-[10px] text-gray-500">Por defecto es "colegio123".</p>
                    </div>
                  )}
                  
                  <div className="space-y-2"><Label>Teléfono Celular <span className="text-gray-400 font-normal text-xs ml-1">(Opcional)</span></Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Fecha Nacimiento <span className="text-gray-400 font-normal text-xs ml-1">(Opcional)</span></Label><Input type="date" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} /></div>
                </div>
              </div>

              {editingStudent && (
                <div className="bg-indigo-50 p-4 rounded-md border border-indigo-100 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="w-5 h-5 text-indigo-600"/>
                    <Label className="text-indigo-900 font-bold text-base">Actualizar Contraseña de Acceso</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input type="text" placeholder="Nueva contraseña (mín. 6 caracteres)" className="bg-white border-indigo-200" value={newManualPassword} onChange={(e) => setNewManualPassword(e.target.value)} />
                    <Button type="button" className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap" onClick={() => handleManualPasswordChange(editingStudent.email)} disabled={isChangingPassword || newManualPassword.length < 6}>
                      {isChangingPassword ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <Check className="w-4 h-4 mr-2"/>} Cambiar
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2">2. Ubicación Académica ({CURRENT_YEAR})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                  
                  <div className="space-y-2">
                    <Label>Grado a cursar <span className="text-gray-400 font-normal text-xs ml-1">(Opcional)</span></Label>
                    <Select 
                      value={formData.current_grade_id} 
                      onValueChange={val => setFormData({...formData, current_grade_id: val, section_id: 'unassigned'})}
                    >
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar grado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-orange-600 font-medium">Dejar sin asignar temporalmente</SelectItem>
                        {levels.map(level => (
                          <div key={`group-${level.id}`}>
                            <div className="px-2 py-1.5 text-xs font-bold text-gray-400 uppercase bg-gray-50">{level.name}</div>
                            {grades.filter(g => g.level_id === level.id).map(grade => (
                              <SelectItem key={grade.id} value={grade.id} className="pl-6">{grade.name}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Aula Virtual / Sección <span className="text-gray-400 font-normal text-xs ml-1">(Opcional)</span></Label>
                    <Select 
                      disabled={formData.current_grade_id === 'unassigned' || aulasDelGrado.length === 0} 
                      value={formData.section_id} 
                      onValueChange={val => setFormData({...formData, section_id: val})}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={aulasDelGrado.length === 0 && formData.current_grade_id !== 'unassigned' ? "No hay aulas creadas" : "Seleccionar sección"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-gray-500">Sin aula asignada (General)</SelectItem>
                        {aulasDelGrado.map(sec => (
                          <SelectItem key={sec.id} value={sec.id}>Aula {sec.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase border-b pb-2">3. Apoderado / Contacto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Nombre del Apoderado</Label><Input value={formData.guardian_name} onChange={e => setFormData({...formData, guardian_name: e.target.value})} placeholder="Nombre completo" /></div>
                  <div className="space-y-2"><Label className="text-red-600">Teléfono de Emergencia</Label><Input value={formData.emergency_phone} onChange={e => setFormData({...formData, emergency_phone: e.target.value})} placeholder="Nro para llamadas urgentes" className="border-red-200 focus-visible:ring-red-500" /></div>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 text-white" disabled={saving}>{saving ? 'Guardando...' : (editingStudent ? 'Actualizar Ficha' : 'Registrar Cuenta y Perfil')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteModalOpen} onOpenChange={(open) => { setIsDeleteModalOpen(open); if (!open) setDeletingStudents([]); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Advertencia de Eliminación</DialogTitle>
            </DialogHeader>
            <div className="py-2 text-gray-700">
              {blockedFromDeletion.length > 0 ? (
                <div className="mb-4">
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
                    <div className="flex items-center gap-2 text-red-800 font-bold mb-2"><ShieldAlert className="w-5 h-5" /> ACCIÓN BLOQUEADA</div>
                    <p className="text-sm text-red-700 mb-2">No puedes eliminar a los siguientes alumnos porque <strong>tienen un Grado asignado</strong>. Edita sus fichas a "Sin asignar temporalmente" primero para poder eliminarlos del sistema:</p>
                    <ul className="list-disc list-inside text-xs font-semibold text-red-900 max-h-32 overflow-y-auto pl-2">
                      {blockedFromDeletion.map(s => <li key={s.id}>{s.first_name} {s.last_name}</li>)}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="mb-3">¿Seguro que deseas eliminar a {deletingStudents.length > 1 ? `estos ${deletingStudents.length} estudiantes` : 'este estudiante'}? Esta acción es irreversible.</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancelar</Button></DialogClose>
              {safeToDelete.length > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />} Eliminar Totalmente
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkStatusModalOpen} onOpenChange={setIsBulkStatusModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Cambiar Estado Masivamente</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <Label>Selecciona el nuevo estado para los {selectedIds.length} alumnos:</Label>
              <Select value={bulkStatusValue} onValueChange={(val: any) => setBulkStatusValue(val)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activos / Matriculados</SelectItem>
                  <SelectItem value="inactive">Inactivos / Desmatriculados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkStatusModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleBulkStatus} disabled={saving}>{saving ? 'Aplicando...' : 'Aplicar Cambios'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkGradeModalOpen} onOpenChange={setIsBulkGradeModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Asignar Grado Masivamente</DialogTitle>
              <DialogDescription>Los alumnos perderán su asignación de aula actual si cambian de grado.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <Label>Selecciona el grado para los {selectedIds.length} alumnos:</Label>
              <Select value={bulkGradeValue} onValueChange={setBulkGradeValue}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned" className="text-orange-600 font-medium">Dejar sin asignar</SelectItem>
                  {levels.map(level => (
                    <div key={`bulk-group-${level.id}`}>
                      <div className="px-2 py-1.5 text-xs font-bold text-gray-400 uppercase bg-gray-50">{level.name}</div>
                      {grades.filter(g => g.level_id === level.id).map(grade => (
                        <SelectItem key={grade.id} value={grade.id} className="pl-6">{grade.name}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkGradeModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleBulkGrade} disabled={saving}>{saving ? 'Aplicando...' : 'Aplicar Grado'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEnrollModalOpen} onOpenChange={setIsEnrollModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-600" /> Cursos y Exoneraciones</DialogTitle>
              <DialogDescription>{selectedStudent?.first_name} {selectedStudent?.last_name}</DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {!selectedStudent?.current_grade_id ? (
                <div className="text-center p-6 bg-orange-50 rounded-lg border border-orange-200">
                  <ShieldAlert className="w-10 h-10 text-orange-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-orange-800">Estudiante sin grado asignado</h3>
                  <p className="text-sm text-orange-600 mt-2">Para ver la malla de cursos, asígnale un grado primero.</p>
                </div>
              ) : loadingCourses ? (
                <div className="flex flex-col items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" /><p className="text-sm text-gray-500">Cargando malla curricular y sincronizando...</p></div>
              ) : studentMallaCourses.length === 0 ? (
                <div className="text-center p-6 bg-gray-50 rounded-lg border"><p className="text-gray-500">No hay cursos registrados para este grado en la malla maestra.</p></div>
              ) : (
                <div className="space-y-4">
                  {!selectedStudent.section_id && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded text-sm flex gap-2">
                      <ShieldAlert className="w-5 h-5 shrink-0 text-amber-500"/>
                      <p><strong>Aviso:</strong> El estudiante no tiene Aula Virtual asignada. Puedes ver su malla de cursos, pero para guardar exoneraciones necesitarás asignarle una Sección editando su ficha.</p>
                    </div>
                  )}
                  <p className="text-sm text-gray-600">Malla curricular correspondiente a {selectedStudent.grade?.name}.</p>
                  
                  <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-2">
                    {studentMallaCourses.map(course => {
                      const typeLabel = course.is_mandatory ? "Obligatorio" : "Electivo";
                      const isExempted = exemptions.includes(course.section_course_id || 'unmatchable_id');

                      return (
                        <div key={course.base_course_id} className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors ${course.isActive ? 'bg-white' : 'bg-gray-100 opacity-75'}`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className={`font-semibold ${course.isActive ? 'text-gray-800' : 'text-gray-500 line-through'}`}>{course.name}</div>
                              {!course.isActive && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 py-0 h-4">Desactivado global</Badge>}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                               <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 ${course.is_mandatory ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{typeLabel}</Badge>
                               <span>• {course.area}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${isExempted ? 'text-red-500' : 'text-green-600'}`}>{isExempted ? 'Exonerado' : 'Inscrito'}</span>
                            <Switch checked={!isExempted} onCheckedChange={(checked) => handleToggleExemption(course.section_course_id, !checked)} disabled={!course.isActive} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEnrollModalOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminStudentManagement;