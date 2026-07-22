import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import PdfAnnotator, { PdfAnnotatorRef } from "@/components/assignments/PdfAnnotator";

export default function GradingView() {
    const { submissionId } = useParams();
    const navigate = useNavigate();
    
    // Referencia para dar órdenes al PdfAnnotator
    const annotatorRef = useRef<PdfAnnotatorRef>(null);

    const [submission, setSubmission] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [pdfUrl, setPdfUrl] = useState<string>("");
    
    // Estados de calificación
    const [score, setScore] = useState("");
    const [feedback, setFeedback] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if(!submissionId) return;
        fetchData();
    }, [submissionId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("assignment_submissions")
                .select(`*, student:profiles!assignment_submissions_student_id_fkey(first_name, last_name), assignment:assignments(id, title)`)
                .eq("id", submissionId)
                .single();
            
            if(error) throw error;

            // --- LÓGICA DE DETECCIÓN DE ARCHIVO CORREGIDA ---
            let finalPath = data.file_path;
            let finalName = data.file_name;

            // Si no hay path directo, buscamos en el array student_files
            if (!finalPath && data.student_files && Array.isArray(data.student_files) && data.student_files.length > 0) {
                 // Prioridad 1: Buscar un PDF en la lista
                 const pdfFile = data.student_files.find((f: any) => 
                    (f.mime_type && f.mime_type.toLowerCase().includes('pdf')) || 
                    (f.file_name && f.file_name.toLowerCase().endsWith('.pdf')) ||
                    (f.fileName && f.fileName.toLowerCase().endsWith('.pdf'))
                 );
                 
                 // Si no hay PDF, tomamos el primer archivo que haya
                 const fileToUse = pdfFile || data.student_files[0];
                 
                 // Normalizamos nombres (puede venir como file_path o filePath)
                 finalPath = fileToUse.file_path || fileToUse.filePath;
                 finalName = fileToUse.file_name || fileToUse.fileName;
            }

            // Asignamos los valores encontrados al objeto data para que el HTML los use
            data.file_path = finalPath;
            data.file_name = finalName;

            setSubmission(data);
            
            let initialScore = "";
            if (data.feedback_files && Array.isArray(data.feedback_files)) {
                const meta = data.feedback_files.find((f: any) => f.is_metadata);
                if (meta && meta.numeric_score !== undefined) {
                    initialScore = String(meta.numeric_score);
                }
            }
            if (!initialScore && data.score) {
                initialScore = data.score;
                if (initialScore === 'AD') initialScore = '18';
                else if (initialScore === 'A') initialScore = '15';
                else if (initialScore === 'B') initialScore = '12';
                else if (initialScore === 'C') initialScore = '08';
            }
            setScore(initialScore);
            setFeedback(data.feedback || "");

            // Generar URL firmada si encontramos un path válido
            if (finalPath) {
                const { data: urlData } = await supabase.storage.from("student-submissions").createSignedUrl(finalPath, 3600);
                if(urlData) setPdfUrl(urlData.signedUrl);
            } else {
                console.warn("No se encontró ningún archivo PDF en esta entrega.");
            }
        } catch(err) {
            console.error(err);
            toast.error("Error cargando datos");
        } finally { setLoading(false); }
    };
    const handleSaveAll = async () => {
        const numericScore = Number(score);
        if (isNaN(numericScore) || numericScore < 0 || numericScore > 20) {
            toast.error("La calificación debe ser un número entre 0 y 20");
            return;
        }

        let letterGrade = 'C';
        if (numericScore >= 18) letterGrade = 'AD';
        else if (numericScore >= 14) letterGrade = 'A';
        else if (numericScore >= 11) letterGrade = 'B';

        try {
            setIsSaving(true);
            toast.loading("Guardando calificación y PDF...", { id: "saving" });

            let feedbackFilesData: any[] = [];
            if (submission.feedback_files && Array.isArray(submission.feedback_files)) {
                feedbackFilesData = submission.feedback_files.filter((f: any) => !f.is_metadata);
            }

            feedbackFilesData.push({
                is_metadata: true,
                numeric_score: numericScore
            });

            // 1. Guardar Nota y Feedback en Base de Datos
            const { error: dbError } = await supabase
                .from("assignment_submissions")
                .update({
                    score: letterGrade,
                    feedback: feedback,
                    feedback_files: feedbackFilesData as any,
                    graded_at: new Date().toISOString()
                })
                .eq("id", submissionId);

            if (dbError) throw dbError;

            // 2. Si hay PDF, pedirle al hijo que lo guarde
            if (annotatorRef.current && pdfUrl) {
                const pdfSuccess = await annotatorRef.current.savePdfOnly();
                if (!pdfSuccess) console.error("La nota se guardó, pero hubo un error generando el PDF.");
            }

            toast.success("¡Calificación completada!", { id: "saving" });
            
            // 3. Volver a la lista de tareas
            navigate(`/assignments/${submission.assignment.id}/review`);

        } catch (error: any) {
            console.error(error);
            toast.error("Error al guardar: " + error.message, { id: "saving" });
        } finally {
            setIsSaving(false);
        }
    };

    if(loading) return <div className="h-screen w-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-50">
            {/* Header */}
            <header className="h-14 border-b bg-white flex items-center px-4 justify-between shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Volver
                    </Button>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm">{submission?.assignment.title}</span>
                        <span className="text-xs text-muted-foreground">Alumno: {submission?.student.first_name} {submission?.student.last_name}</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Panel Izquierdo: PDF */}
                <div className="flex-1 min-w-0 relative border-r bg-gray-100">
                    {pdfUrl ? (
                        <PdfAnnotator 
                            ref={annotatorRef}
                            pdfUrl={pdfUrl}
                            fileName={submission.file_name || "archivo.pdf"}
                            submissionId={submission.id}
                            storagePath={submission.file_path} // Ahora esto contiene la ruta correcta detectada
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                             <p>No se pudo cargar el PDF para visualizar.</p>
                             <p className="text-xs text-gray-400">(Puede que el alumno no haya adjuntado un archivo válido)</p>
                        </div>
                    )}
                </div>

                {/* Panel Derecho: Notas */}
                <div className="w-80 shrink-0 bg-white p-6 shadow-xl z-10 flex flex-col gap-6 overflow-y-auto">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <span className="w-1 h-6 bg-blue-600 rounded-full block"></span>
                            Evaluar
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="score">Calificación (0 - 20)</Label>
                                <div className="flex flex-col gap-2">
                                    <Input
                                        id="score"
                                        type="number"
                                        min={0}
                                        max={20}
                                        placeholder="Ingresa la nota"
                                        value={score}
                                        onChange={(e) => setScore(e.target.value)}
                                        className="w-full"
                                    />
                                    {score && !isNaN(Number(score)) && (
                                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg border block text-center">
                                            Equivale a: {(() => {
                                                const num = Number(score);
                                                if (num >= 18) return "AD (Destacado)";
                                                if (num >= 14) return "A (Esperado)";
                                                if (num >= 11) return "B (Proceso)";
                                                return "C (Inicio)";
                                            })()}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Feedback General</Label>
                                <Textarea 
                                    placeholder="Escribe comentarios..." 
                                    className="min-h-[200px] resize-none"
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-4 border-t">
                        <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-md" 
                            onClick={handleSaveAll}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 w-4 h-4" />}
                            Guardar y Terminar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}