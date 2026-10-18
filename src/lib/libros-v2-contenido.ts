/**
 * Contenido de los "New Books" v2 (BEGINNER / PRACTICAL / FUNCTIONAL).
 *
 * Fuente: paquetes `Books/LGS_<NIVEL>_revisado_v2` (gitignored) copiados a
 * src/data/books/lgs-<nivel>-v2/. Páginas, PDF y retratos viven PRIVADOS en
 * Spaces bajo `materials/interactive/LGS-<NIVEL>-V2/` (scripts/upload-book-v2.js).
 *
 * ⚠️ `activities-with-keys.json`, `checkpoints.json` y `editorial-extensions.json`
 * vienen de `data/server-only`: este módulo es `server-only` y al cliente solo
 * llega lo que proyecta `vistaAlumno()` — sin `correct_option_id`,
 * `evidence_text` ni las preguntas con respuesta de las extensiones.
 */
import 'server-only';
import { LIBROS_V2, SlugLibroV2 } from '@/lib/libros-v2-catalogo';

import begManifest from '@/data/books/lgs-beginner-v2/manifest.json';
import begPages from '@/data/books/lgs-beginner-v2/pages.json';
import begStory from '@/data/books/lgs-beginner-v2/story.json';
import begKeys from '@/data/books/lgs-beginner-v2/activities-with-keys.json';
import begChecks from '@/data/books/lgs-beginner-v2/checkpoints.json';
import begExt from '@/data/books/lgs-beginner-v2/editorial-extensions.json';
import praManifest from '@/data/books/lgs-practical-v2/manifest.json';
import praPages from '@/data/books/lgs-practical-v2/pages.json';
import praStory from '@/data/books/lgs-practical-v2/story.json';
import praKeys from '@/data/books/lgs-practical-v2/activities-with-keys.json';
import praChecks from '@/data/books/lgs-practical-v2/checkpoints.json';
import praExt from '@/data/books/lgs-practical-v2/editorial-extensions.json';
import funcManifest from '@/data/books/lgs-functional-v2/manifest.json';
import funcPages from '@/data/books/lgs-functional-v2/pages.json';
import funcStory from '@/data/books/lgs-functional-v2/story.json';
import funcKeys from '@/data/books/lgs-functional-v2/activities-with-keys.json';
import funcChecks from '@/data/books/lgs-functional-v2/checkpoints.json';
import funcExt from '@/data/books/lgs-functional-v2/editorial-extensions.json';

export const CONTENT_VERSION_V2 = 'v2';
export const SIGNED_URL_TTL_V2 = 600;
export const PASS_PERCENT_V2 = 75;
export const PERSONAJES_V2 = ['Caleb', 'Charlene', 'Clarice', 'Denali', 'Ethan', 'Evan', 'Maria', 'Sara', 'Taylor'];

export interface PaginaV2 {
  page: number;
  id: string;
  stepNumber: number | null;
  kind: string;
  title: string;
  objectKey: string;
}
export interface ActividadV2 {
  id: string;
  stepNumber: number;
  type: 'single_choice' | 'open_response';
  prompt: string;
  options?: { id: string; text: string }[];
  correctOptionId?: string;
  maxLength?: number;
  pageIds: string[];
}
export interface CheckpointV2 {
  id: string;
  stepNumber: number;
  activityIds: string[];
  minimo: number;
  total: number;
  kind: 'core' | 'jump' | 'final' | 'plus';
  required: boolean;
}

interface ContenidoV2 {
  bookCode: string;
  storagePrefix: string;
  pdfKey: string;
  steps: number[];
  paginas: PaginaV2[];
  paginaPorId: Map<string, PaginaV2>;
  actividades: Map<string, ActividadV2>;
  checkpoints: CheckpointV2[];
  checkpointPorId: Map<string, CheckpointV2>;
  episodios: any[];
  extensiones: Record<string, { title: string; text: string }>;
}

const FUENTES: Record<SlugLibroV2, { manifest: any; pages: any[]; story: any[]; keys: any[]; checks: any[]; ext: any; pdf: string }> = {
  beg: { manifest: begManifest, pages: begPages, story: begStory, keys: begKeys, checks: begChecks, ext: begExt, pdf: 'LGS_BEGINNER_revisado.pdf' },
  pra: { manifest: praManifest, pages: praPages, story: praStory, keys: praKeys, checks: praChecks, ext: praExt, pdf: 'LGS_PRACTICAL_revisado.pdf' },
  func: { manifest: funcManifest, pages: funcPages, story: funcStory, keys: funcKeys, checks: funcChecks, ext: funcExt, pdf: 'LGS_FUNCTIONAL_revisado.pdf' },
};

const cache = new Map<SlugLibroV2, ContenidoV2>();

/** Contenido completo (incluye claves) — SOLO para el servicio. */
export function contenidoV2(slug: SlugLibroV2): ContenidoV2 {
  const hit = cache.get(slug);
  if (hit) return hit;
  const f = FUENTES[slug];
  const meta = LIBROS_V2[slug];
  if (f.manifest.book_code !== meta.bookCode) throw new Error(`book_code inesperado en ${slug}`);

  const paginas: PaginaV2[] = f.pages.map((p: any) => ({
    page: p.page, id: p.id, stepNumber: p.step_number ?? null, kind: p.kind, title: p.title, objectKey: p.object_key,
  }));
  const actividades = new Map<string, ActividadV2>(
    f.keys.map((a: any) => [a.id, {
      id: a.id,
      stepNumber: a.step_number,
      type: a.type,
      prompt: a.prompt,
      options: a.type === 'single_choice' ? (a.options || []).map((o: any) => ({ id: o.id, text: o.text })) : undefined,
      correctOptionId: a.correct_option_id,
      maxLength: a.type === 'open_response' ? a.max_length ?? 6000 : undefined,
      pageIds: a.page_ids || (a.page_id ? [a.page_id] : []),
    }]),
  );

  const checkpoints: CheckpointV2[] = f.checks.map((c: any) => ({
    id: c.id,
    stepNumber: c.step_number,
    activityIds: c.activity_ids,
    minimo: c.minimum_correct,
    total: c.activity_ids.length,
    kind: c.kind === 'jump' ? 'jump' : c.kind === 'final' || c.activity_ids.length > 4 ? 'final' : 'core',
    required: c.required !== false,
  }));
  // Reading Plus (FUNCTIONAL): práctica opcional por step, con su propio registro de intentos.
  const plusPorStep = new Map<number, string[]>();
  for (const a of actividades.values()) {
    if (a.id.includes('-PLUS-')) plusPorStep.set(a.stepNumber, [...(plusPorStep.get(a.stepNumber) || []), a.id]);
  }
  for (const [step, ids] of plusPorStep) {
    checkpoints.push({
      id: `${meta.bookCode}-S${String(step).padStart(2, '0')}-PLUS`,
      stepNumber: step, activityIds: ids, minimo: Math.ceil((ids.length * PASS_PERCENT_V2) / 100), total: ids.length,
      kind: 'plus', required: false,
    });
  }

  const extensiones: Record<string, { title: string; text: string }> = {};
  for (const [k, v] of Object.entries(f.ext || {})) extensiones[k] = { title: (v as any).title, text: (v as any).text };

  const c: ContenidoV2 = {
    bookCode: meta.bookCode,
    storagePrefix: f.manifest.storage_prefix,
    pdfKey: `${f.manifest.storage_prefix}/${f.pdf}`,
    steps: f.manifest.academic_steps.map((s: string) => Number(String(s).replace(/\D/g, ''))),
    paginas,
    paginaPorId: new Map(paginas.map((p) => [p.id, p])),
    actividades,
    checkpoints,
    checkpointPorId: new Map(checkpoints.map((x) => [x.id, x])),
    // Episodios para el alumno: sin el bloque `questions` (las preguntas reales van por actividades).
    episodios: f.story.map(({ questions, ...e }: any) => e),
    extensiones,
  };
  cache.set(slug, c);
  return c;
}

export function claveRetrato(c: ContenidoV2, nombre: string): string {
  return `${c.storagePrefix}/characters/${nombre}.png`;
}

/** Proyección para el alumno: estructura, enunciados y opciones — NUNCA claves. */
export function vistaAlumno(c: ContenidoV2) {
  const titulo = (a: ActividadV2) => {
    const p = a.pageIds.map((id) => c.paginaPorId.get(id)).find(Boolean);
    return p ? `Página ${p.page} · ${p.title}` : a.id;
  };
  return {
    steps: c.steps,
    paginas: c.paginas.map(({ objectKey, ...p }) => p),
    actividades: Array.from(c.actividades.values()).map((a) => ({
      id: a.id,
      stepNumber: a.stepNumber,
      type: a.type,
      prompt: a.prompt,
      options: a.options,
      maxLength: a.maxLength,
      title: a.type === 'open_response' ? titulo(a) : undefined,
    })),
    checkpoints: c.checkpoints,
    episodios: c.episodios,
    extensiones: c.extensiones,
  };
}
