import 'server-only';
import { randomUUID } from 'crypto';
import {
  EjerciciosInteractivosRepository,
  Ejercicio,
  EjercicioTipo,
} from '@/repositories/ejercicios-interactivos.repository';
import { NivelesRepository } from '@/repositories/niveles.repository';
import { EjerciciosIntentosRepository } from '@/repositories/ejercicios-intentos.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { randomUUID as uuid } from 'crypto';

/**
 * Fase 2 del Material Interactivo — ejercicios de PRÁCTICA auto-gradables por step.
 *
 * - Se generan por IA (OpenAI gpt-4o-mini) desde NIVELES.contenido y se CACHEAN
 *   por (nivel, step) en EJERCICIOS_INTERACTIVOS → 1 generación por step, reusada
 *   entre estudiantes.
 * - Tipos: multiple_choice / true_false / fill_blank (auto-gradables SIN IA).
 * - Solo práctica: NO crea bookings ni avanza step.
 */

const NUM_EJERCICIOS = 8;
const APROBACION_MIN = 70;  // % mínimo para "aprobado"

// Niveles cuyos enunciados van en ESPAÑOL (estudiantes principiantes). De P1 en
// adelante los enunciados van en inglés (inmersión).
const NIVELES_EN_ESPANOL = new Set(['ESS', 'BN1', 'BN2', 'BN3']);
function idiomaDeNivel(nivel: string): 'es' | 'en' {
  const code = String(nivel || '').replace(/\s*JUMP\s*/i, '').trim().toUpperCase();
  return NIVELES_EN_ESPANOL.has(code) ? 'es' : 'en';
}

// Número global del step (1..45 para BN1..F3). "Step 36" / "TRAINING - Step 36" → 36.
const MAX_STEP_NUM = 45;
export function extractStepNum(step: string): number | null {
  const m = String(step || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export interface ProgresoEjercicios { generados: number; total: number; quedan: number }

/** Pregunta tal como la ve el estudiante (SIN la respuesta correcta). */
export interface EjercicioPublico {
  tipo: EjercicioTipo;
  enunciado: string;
  opciones?: string[];
}

export interface ResultadoPregunta {
  correcto: boolean;
  respuestaCorrecta: number | boolean | string;
  explicacion?: string;
}

function stripAnswers(preguntas: Ejercicio[]): EjercicioPublico[] {
  return preguntas.map(p => ({
    tipo: p.tipo,
    enunciado: p.enunciado,
    ...(p.opciones ? { opciones: p.opciones } : {}),
  }));
}

/** Normaliza texto para comparar fill_blank (minúsculas, sin acentos/puntuación, espacios colapsados). */
function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class EjerciciosInteractivosServiceClass {
  /**
   * Devuelve los ejercicios (sin respuestas) del step. Si no hay set cacheado,
   * lo genera con IA y lo guarda. Lanza NotFoundError si el step no tiene contenido.
   */
  async getForStep(nivel: string, step: string): Promise<{ nivel: string; step: string; preguntas: EjercicioPublico[] }> {
    let set = await EjerciciosInteractivosRepository.findByNivelStep(nivel, step);
    if (!set || !Array.isArray(set.preguntas) || set.preguntas.length === 0) {
      const contenido = await NivelesRepository.findContenidoByNivelAndStep(nivel, step);
      if (!contenido) {
        throw new NotFoundError('ContenidoStep', `${nivel} ${step}`);
      }
      const preguntas = await this.generarConIA(contenido, nivel, step);
      await EjerciciosInteractivosRepository.upsert({
        _id: randomUUID(),
        nivel, step, preguntas, generatedBy: 'openai:gpt-4o-mini',
      });
      set = { _id: '', nivel, step, preguntas, generatedBy: null, _createdDate: '', _updatedDate: '' };
    }
    return { nivel, step, preguntas: stripAnswers(set.preguntas) };
  }

  /**
   * Califica las respuestas del estudiante contra el set cacheado (sin IA).
   * `answers[i]` es la respuesta a la pregunta i: number (MC index), boolean (TF)
   * o string (fill_blank).
   */
  async grade(nivel: string, step: string, answers: any[]): Promise<{
    total: number; correctas: number; porcentaje: number; aprobado: boolean; consejo: string; resultados: ResultadoPregunta[];
  }> {
    const set = await EjerciciosInteractivosRepository.findByNivelStep(nivel, step);
    if (!set || !Array.isArray(set.preguntas) || set.preguntas.length === 0) {
      throw new NotFoundError('EjerciciosSet', `${nivel} ${step}`);
    }
    if (!Array.isArray(answers)) throw new ValidationError('answers debe ser un array');

    // 1) Auto-gradables sin IA (MC, TF, fill_blank).
    const resultados: ResultadoPregunta[] = set.preguntas.map((p, i) => {
      const a = answers[i];
      let correcto = false;
      if (p.tipo === 'multiple_choice') {
        correcto = Number(a) === Number(p.respuestaCorrecta);
      } else if (p.tipo === 'true_false') {
        correcto = Boolean(a) === Boolean(p.respuestaCorrecta);
      } else if (p.tipo === 'fill_blank') {
        const cand = norm(a);
        const validas = [p.respuestaCorrecta, ...(p.aceptadas || [])].map(norm).filter(Boolean);
        correcto = cand.length > 0 && validas.includes(cand);
      } else {
        // sentence: se evalúa con IA más abajo (placeholder por ahora).
        correcto = false;
      }
      return { correcto, respuestaCorrecta: p.respuestaCorrecta, explicacion: p.explicacion };
    });

    // 2) Construcción de frase (sentence): evaluación con IA en un solo llamado.
    const sentenceIdx = set.preguntas
      .map((p, i) => (p.tipo === 'sentence' ? i : -1))
      .filter(i => i >= 0);
    if (sentenceIdx.length > 0) {
      const items = sentenceIdx.map(i => ({
        enunciado: set.preguntas[i].enunciado,
        criterio: set.preguntas[i].criterio || '',
        ejemplo: String(set.preguntas[i].respuestaCorrecta || ''),
        respuesta: String(answers[i] ?? ''),
      }));
      const evals = await this.evaluarFrases(items, nivel, step);
      sentenceIdx.forEach((qi, k) => {
        const ev = evals[k];
        resultados[qi] = {
          correcto: ev.correcto,
          respuestaCorrecta: set.preguntas[qi].respuestaCorrecta, // frase de ejemplo
          explicacion: ev.explicacion || set.preguntas[qi].explicacion,
        };
      });
    }

    const correctas = resultados.filter(r => r.correcto).length;
    const total = resultados.length;
    const porcentaje = total ? Math.round((correctas / total) * 100) : 0;
    const aprobado = porcentaje >= APROBACION_MIN;
    // Consejo final generado por IA (aprobación/ánimo si aprobó, tip de estudio
    // si no). Degrada a un mensaje fijo si OpenAI falla → nunca rompe la práctica.
    const consejo = await this.generarConsejo(set.preguntas, resultados, porcentaje, aprobado, nivel, step);
    return { total, correctas, porcentaje, aprobado, consejo, resultados };
  }

  /**
   * Evalúa con IA una tanda de ejercicios de construcción de frase. Un solo
   * llamado para todas. Cada item trae enunciado, criterio, frase de ejemplo y
   * la respuesta del estudiante. Devuelve {correcto, explicacion} en el mismo
   * orden. Si la IA falla, degrada de forma indulgente (práctica sin nota):
   * cuenta como correcto si el estudiante escribió algo con sustancia.
   */
  private async evaluarFrases(
    items: { enunciado: string; criterio: string; ejemplo: string; respuesta: string }[],
    nivel: string, step: string,
  ): Promise<{ correcto: boolean; explicacion: string }[]> {
    const idioma = idiomaDeNivel(nivel);
    const fbLang = idioma === 'es' ? 'ESPAÑOL' : 'ENGLISH';
    // Fallback indulgente: ≥3 palabras con letras → correcto.
    const fallback = items.map(it => {
      const palabras = String(it.respuesta || '').trim().split(/\s+/).filter(w => /[\p{L}]/u.test(w));
      const ok = palabras.length >= 3;
      return {
        correcto: ok,
        explicacion: ok
          ? (idioma === 'es' ? 'Registramos tu intento (evaluación automática no disponible).' : 'We recorded your attempt (auto-evaluation unavailable).')
          : (idioma === 'es' ? 'Escribe una oración completa.' : 'Write a complete sentence.'),
      };
    });
    // Si nadie respondió con sustancia, no gastamos el llamado a la IA.
    if (!items.some(it => String(it.respuesta || '').trim().length > 0)) return fallback;
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You grade short English sentence-construction exercises (level ${nivel}, ${step}). For EACH item you receive: the instruction, the grading criterion, an example correct answer, and the student's sentence. Mark "correcto":true only if the student's sentence (a) is written in English, (b) is grammatically acceptable, and (c) satisfies the instruction and criterion. Be lenient with capitalization/minor typos, strict about the target grammar/vocabulary. If the answer is empty or off-task, "correcto":false. Write "explicacion" (short, ≤1 sentence, encouraging) in ${fbLang}. Return ONLY a JSON object {"results":[{"correcto":bool,"explicacion":"..."}]} in the SAME order as the items.`,
          },
          {
            role: 'user',
            content: JSON.stringify({ items: items.map(it => ({ instruction: it.enunciado, criterion: it.criterio, example: it.ejemplo, student: it.respuesta })) }),
          },
        ],
      });
      const parsed = JSON.parse(resp.choices[0].message.content || '{}');
      const arr = Array.isArray(parsed.results) ? parsed.results : [];
      return items.map((_, i) => {
        const r = arr[i];
        if (!r || typeof r.correcto !== 'boolean') return fallback[i];
        return { correcto: Boolean(r.correcto), explicacion: String(r.explicacion || fallback[i].explicacion) };
      });
    } catch {
      return fallback;
    }
  }

  /** Feedback final del estudiante generado por IA (en español, breve). */
  private async generarConsejo(
    preguntas: Ejercicio[], resultados: ResultadoPregunta[], porcentaje: number,
    aprobado: boolean, nivel: string, step: string,
  ): Promise<string> {
    const fallback = aprobado
      ? '¡Buen trabajo! Vas por buen camino, sigue practicando.'
      : 'Aún no llegas al 70%. Repasa el contenido del step y vuelve a intentarlo, ¡tú puedes!';
    try {
      const falladas = preguntas.filter((_, i) => !resultados[i]?.correcto).map(p => p.enunciado).slice(0, 6);
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        messages: [
          {
            role: 'system',
            content: `Eres un profesor de inglés motivador. Un estudiante (nivel ${nivel}, ${step}) hizo una práctica y obtuvo ${porcentaje}% (${aprobado ? 'APROBÓ, ≥70%' : 'NO alcanzó el 70%'}). Escribe en ESPAÑOL, 2-3 frases, tuteando al estudiante: si aprobó, felicítalo brevemente y anímalo a seguir; si no aprobó, dale un consejo concreto de estudio basado en los temas que falló. No menciones el porcentaje exacto. Sé cálido y breve.`,
          },
          {
            role: 'user',
            content: falladas.length ? `Preguntas que falló:\n- ${falladas.join('\n- ')}` : 'No falló ninguna pregunta.',
          },
        ],
      });
      return resp.choices[0].message.content?.trim() || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * (Admin) Fuerza la regeneración del set del step: llama a la IA de nuevo y
   * reemplaza el set cacheado. Lanza NotFoundError si el step no tiene contenido.
   */
  async regenerateForStep(nivel: string, step: string): Promise<{ count: number }> {
    const contenido = await NivelesRepository.findContenidoByNivelAndStep(nivel, step);
    if (!contenido) throw new NotFoundError('ContenidoStep', `${nivel} ${step}`);
    const preguntas = await this.generarConIA(contenido, nivel, step);
    await EjerciciosInteractivosRepository.upsert({
      _id: randomUUID(), nivel, step, preguntas, generatedBy: 'openai:gpt-4o-mini',
    });
    return { count: preguntas.length };
  }

  /** (Admin) Lista los sets ya generados. */
  async listSets() {
    return EjerciciosInteractivosRepository.listAll();
  }

  // ── Cupo por estudiante (1 intento por step) + progreso ──

  /** ¿Ya completó el estudiante el ejercicio de este step? */
  async getEstadoStep(studentId: string, nivel: string, step: string): Promise<{
    yaCompletado: boolean; porcentaje: number | null; aprobado: boolean | null;
  }> {
    const intento = await EjerciciosIntentosRepository.findByStudentStep(studentId, nivel, step);
    return {
      yaCompletado: !!intento,
      porcentaje: intento?.porcentaje ?? null,
      aprobado: intento?.aprobado ?? null,
    };
  }

  /**
   * Progreso del estudiante: cuántos ejercicios ha generado y cuántos le quedan
   * HASTA SU STEP ACTUAL (total = número del step actual, 1..45).
   */
  async getProgreso(studentId: string, currentStep: string): Promise<ProgresoEjercicios> {
    const n = extractStepNum(currentStep);
    const total = n && n >= 1 ? Math.min(n, MAX_STEP_NUM) : 0;
    const generados = total > 0 ? await EjerciciosIntentosRepository.countUpToStep(studentId, total) : 0;
    return { generados, total, quedan: Math.max(0, total - generados) };
  }

  /** Registra el intento del step (idempotente: 1 por step). */
  async registrarIntento(input: {
    studentId: string; numeroId: string | null; nivel: string; step: string;
    porcentaje: number; aprobado: boolean;
  }): Promise<boolean> {
    return EjerciciosIntentosRepository.insertIfAbsent({
      _id: uuid(),
      studentId: input.studentId,
      numeroId: input.numeroId,
      nivel: input.nivel,
      step: input.step,
      stepNum: extractStepNum(input.step),
      porcentaje: input.porcentaje,
      aprobado: input.aprobado,
    });
  }

  // ── IA ──
  private async generarConIA(contenido: string, nivel: string, step: string): Promise<Ejercicio[]> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const idioma = idiomaDeNivel(nivel);
    // Regla de idioma de los ENUNCIADOS. El contenido inglés que se enseña
    // (palabras/frases target) siempre queda en inglés; solo cambia el idioma
    // de las instrucciones/preguntas.
    const langRule = idioma === 'es'
      ? `LANGUAGE: This is a BEGINNER level. Write ALL instructions, questions, true_false statements and multiple_choice options in SPANISH so the student understands the task. EXCEPTION: keep in English any English word/phrase that is the actual target being tested (e.g. vocabulary, a verb form). For "sentence" exercises the student must WRITE IN ENGLISH, so the instruction (in Spanish) must explicitly say "Escribe una oración en inglés ...".`
      : `LANGUAGE: Write ALL instructions, questions, statements and options in ENGLISH.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an English teacher creating ${NUM_EJERCICIOS} short PRACTICE exercises for level ${nivel}, ${step}, based on the lesson content.

Return a JSON object with an "exercises" array of exactly ${NUM_EJERCICIOS} items, in this order: 4 multiple_choice, 2 true_false, then 2 sentence (the last two). Types:
- {"tipo":"multiple_choice","enunciado":"...","opciones":["a","b","c","d"],"respuestaCorrecta":<index 0-3>,"explicacion":"short why"}
- {"tipo":"true_false","enunciado":"...","respuestaCorrecta":<true|false>,"explicacion":"short why"}
- {"tipo":"sentence","enunciado":"instruction asking the student to WRITE a full English sentence that demonstrates the target","criterio":"what the sentence must contain/demonstrate to be correct (grammar/vocabulary target)","respuestaCorrecta":"one example of a correct sentence","explicacion":"short why"}

${langRule}

Rules: keep each enunciado one sentence; the 2 "sentence" exercises ask the student to CONSTRUCT an English sentence (no blanks, no options) — always fill "criterio" and give an example in "respuestaCorrecta"; the multiple_choice and true_false must be auto-gradable; always include a brief "explicacion". Output ONLY the JSON object.`,
        },
        { role: 'user', content: `Lesson content:\n\n${String(contenido).substring(0, 4000)}` },
      ],
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    const arr = Array.isArray(parsed.exercises) ? parsed.exercises : [];
    const clean: Ejercicio[] = arr
      .filter((q: any) => q && ['multiple_choice', 'true_false', 'fill_blank', 'sentence'].includes(q.tipo))
      .map((q: any) => {
        if (q.tipo === 'multiple_choice') {
          const opciones = Array.isArray(q.opciones) ? q.opciones.map(String).slice(0, 6) : [];
          const idx = Number(q.respuestaCorrecta);
          if (opciones.length < 2 || !Number.isInteger(idx) || idx < 0 || idx >= opciones.length) return null;
          return { tipo: 'multiple_choice', enunciado: String(q.enunciado || ''), opciones, respuestaCorrecta: idx, explicacion: q.explicacion ? String(q.explicacion) : undefined };
        }
        if (q.tipo === 'true_false') {
          return { tipo: 'true_false', enunciado: String(q.enunciado || ''), respuestaCorrecta: Boolean(q.respuestaCorrecta), explicacion: q.explicacion ? String(q.explicacion) : undefined };
        }
        if (q.tipo === 'sentence') {
          const enunciado = String(q.enunciado || '').trim();
          const criterio = String(q.criterio || '').trim();
          const ejemplo = String(q.respuestaCorrecta || '').trim();
          if (!enunciado || (!criterio && !ejemplo)) return null;
          return { tipo: 'sentence', enunciado, criterio: criterio || undefined, respuestaCorrecta: ejemplo, explicacion: q.explicacion ? String(q.explicacion) : undefined };
        }
        // fill_blank (legado — sets antiguos aún válidos)
        const rc = String(q.respuestaCorrecta || '').trim();
        if (!rc || !String(q.enunciado || '').includes('___')) return null;
        return { tipo: 'fill_blank', enunciado: String(q.enunciado), respuestaCorrecta: rc, aceptadas: Array.isArray(q.aceptadas) ? q.aceptadas.map(String) : [], explicacion: q.explicacion ? String(q.explicacion) : undefined };
      })
      .filter(Boolean) as Ejercicio[];

    if (clean.length < 3) {
      throw new ValidationError('No se pudieron generar ejercicios válidos para este step. Intenta de nuevo.');
    }
    return clean;
  }
}

export const EjerciciosInteractivosService = new EjerciciosInteractivosServiceClass();
