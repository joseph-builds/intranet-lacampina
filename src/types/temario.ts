export type TemarioEstado = 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado';

export interface Temario {
  id: string;
  curso_id: string;
  profesor_id: string;
  archivo_pdf: string;
  nombre_original: string;
  estado: TemarioEstado;
  retroalimentacion?: string | null;
  revisado_por?: string | null;
  revisado_en?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  course?: {
    id: string;
    name: string;
    code: string;
    classroom?: {
      name: string;
      grade: string;
      education_level?: string;
    };
  };
  profesor?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  revisor?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}
