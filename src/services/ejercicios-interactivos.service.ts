import 'server-only';
import { randomUUID } from 'crypto';
import {
  EjerciciosInteractivosRepository,
  Ejercicio,
  EjercicioTipo,
} from '@/repositories/ejercicios-interactivos.repository';
import { NivelesRepository } from '@/repositories/niveles.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';

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

    const resultados: ResultadoPregunta[] = set.preguntas.map((p, i) => {
      const a = answers[i];
      let correcto = false;
      if (p.tipo === 'multiple_choice') {
        correcto = Number(a) === Number(p.respuestaCorrecta);
      } else if (p.tipo === 'true_false') {
        correcto = Boolean(a) === Boolean(p.respuestaCorrecta);
      } else { // fill_blank
        const cand = norm(a);
        const validas = [p.respuestaCorrecta, ...(p.aceptadas || [])].map(norm).filter(Boolean);
        correcto = cand.length > 0 && validas.includes(cand);
      }
      return { correcto, respuestaCorrecta: p.respuestaCorrecta, explicacion: p.explicacion };
    });

    const correctas = resultados.filter(r => r.correcto).length;
    const total = resultados.length;
    const porcentaje = total ? Math.round((correctas / total) * 100) : 0;
    const aprobado = porcentaje >= APROBACION_MIN;
    // Consejo final generado por IA (aprobación/ánimo si aprobó, tip de estudio
    // si no). Degrada a un mensaje fijo si OpenAI falla → nunca rompe la práctica.
    const consejo = await this.generarConsejo(set.preguntas, resultados, porcentaje, aprobado, nivel, step);
    return { total, correctas, porcentaje, aprobado, consejo, resultados };
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

  // ── IA ──
  private async generarConIA(contenido: string, nivel: string, step: string): Promise<Ejercicio[]> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an English teacher creating ${NUM_EJERCICIOS} short PRACTICE exercises for level ${nivel}, ${step}, based on the lesson content. Exercises must be self-contained and auto-gradable.

Return a JSON object with an "exercises" array of exactly ${NUM_EJERCICIOS} items. Use ONLY these three types (mix ~4 multiple_choice, ~2 true_false, ~2 fill_blank):
- {"tipo":"multiple_choice","enunciado":"...","opciones":["a","b","c","d"],"respuestaCorrecta":<index 0-3>,"explicacion":"short why"}
- {"tipo":"true_false","enunciado":"...","respuestaCorrecta":<true|false>,"explicacion":"short why"}
- {"tipo":"fill_blank","enunciado":"sentence with ___ blank","respuestaCorrecta":"word","aceptadas":["variant"],"explicacion":"short why"}

Rules: questions and options in English; keep each enunciado one sentence; for fill_blank use exactly one "___"; respuestaCorrecta for fill_blank must be a single word or short phrase; always include a brief "explicacion". Output ONLY the JSON object.`,
        },
        { role: 'user', content: `Lesson content:\n\n${String(contenido).substring(0, 4000)}` },
      ],
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    const arr = Array.isArray(parsed.exercises) ? parsed.exercises : [];
    const clean: Ejercicio[] = arr
      .filter((q: any) => q && ['multiple_choice', 'true_false', 'fill_blank'].includes(q.tipo))
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
        // fill_blank
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
