/**
 * Contenido del "Book ESS New" — libro ST00-00 (LGS ESSENTIAL v1.0.0).
 *
 * Fuente: paquete de integración (Books/LGS_ESSENTIAL_integracion_v1, fuera de
 * git) copiado a src/data/books/st00-00/. Las páginas y el PDF corregido viven
 * PRIVADOS en Spaces (scripts/upload-book-ess.js).
 *
 * ⚠️ `activities.answer-key.json` trae la clave de respuestas: este módulo es
 * `server-only` y nada de él se envía al cliente salvo lo que proyecta
 * `actividadesParaAlumno()` (sin `correct_option_id` ni `explanation`).
 */
import 'server-only';
import manifest from '@/data/books/st00-00/manifest.json';
import answerKey from '@/data/books/st00-00/activities.answer-key.json';
import assessmentsFile from '@/data/books/st00-00/assessments.json';

export const BOOK_CODE = 'ST00-00';
export const CONTENT_VERSION = manifest.content_version; // '1.0.0'
export const BOOK_TITLE = manifest.title;
export const BOOK_NIVEL = manifest.academic_level; // 'ESS'
export const BOOK_STEP = manifest.academic_step;   // 'Step 0'
export const PDF_KEY = 'materials/interactive/ST00-00/LGS_ESSENTIAL.pdf';
export const SIGNED_URL_TTL = 600;
export const TOTAL_UNIDADES = manifest.units; // 12
export const FINAL_ID = 'ESS-FINAL';

export interface PaginaLibro {
  page: number;
  id: string;
  unitId: string | null;
  kind: string;
  title: string;
  objectKey: string;
  requerida: boolean;
  activityIds: string[];
}

interface Opcion { id: string; text: string }
interface ActividadClave {
  id: string;
  unit_id: string | null;
  type: 'single_choice' | 'open_response';
  prompt: string;
  options?: Opcion[];
  correct_option_id?: string;
  explanation?: string;
  points?: number;
  max_length?: number;
}
export interface Evaluacion {
  id: string;
  unitId: string | null;
  activityIds: string[];
  aprobarCon: number;
  total: number;
}

export const PAGINAS: PaginaLibro[] = manifest.pages.map((p: any) => ({
  page: p.page,
  id: p.id,
  unitId: p.unit_id,
  kind: p.kind,
  title: p.title,
  objectKey: p.object_key,
  requerida: !!p.required_reading,
  activityIds: p.activity_ids || [],
}));
const PAGINA_POR_ID = new Map(PAGINAS.map((p) => [p.id, p]));
export const PAGINAS_REQUERIDAS = PAGINAS.filter((p) => p.requerida).length;

const ACTIVIDADES = new Map<string, ActividadClave>(
  (answerKey.activities as ActividadClave[]).map((a) => [a.id, a]),
);

export const EVALUACIONES: Evaluacion[] = assessmentsFile.assessments.map((a: any) => ({
  id: a.id,
  unitId: a.unit_id,
  activityIds: a.activity_ids,
  aprobarCon: a.pass_correct_count,
  total: a.total_points,
}));
const EVALUACION_POR_ID = new Map(EVALUACIONES.map((e) => [e.id, e]));

export function paginaPorId(id: string): PaginaLibro | undefined {
  return PAGINA_POR_ID.get(id);
}
export function evaluacionPorId(id: string): Evaluacion | undefined {
  return EVALUACION_POR_ID.get(id);
}
export function actividad(id: string): ActividadClave | undefined {
  return ACTIVIDADES.get(id);
}

/** Proyección para el alumno: enunciado y opciones, NUNCA la clave ni la explicación. */
export function actividadesParaAlumno() {
  return Array.from(ACTIVIDADES.values()).map((a) => ({
    id: a.id,
    unitId: a.unit_id,
    type: a.type,
    prompt: a.prompt,
    options: a.type === 'single_choice' ? (a.options || []).map((o) => ({ id: o.id, text: o.text })) : undefined,
    maxLength: a.type === 'open_response' ? a.max_length ?? 4000 : undefined,
  }));
}

/** Unidades (ESS-U01…U12) con el título de su primera página de lección. */
export function unidades() {
  const out: { id: string; numero: number; titulo: string; primeraPagina: number }[] = [];
  for (const p of PAGINAS) {
    if (!p.unitId || out.some((u) => u.id === p.unitId)) continue;
    out.push({ id: p.unitId, numero: Number(p.unitId.replace(/\D/g, '')), titulo: p.title, primeraPagina: p.page });
  }
  return out;
}
