import 'server-only';
import { query, queryOne } from '@/lib/postgres';

/**
 * Un ejercicio de práctica. Auto-gradables sin IA: multiple_choice, true_false,
 * fill_blank. `sentence` (construcción de frase) se evalúa CON IA.
 */
export type EjercicioTipo = 'multiple_choice' | 'true_false' | 'fill_blank' | 'sentence';

export interface Ejercicio {
  tipo: EjercicioTipo;
  enunciado: string;
  opciones?: string[];              // multiple_choice
  respuestaCorrecta: number | boolean | string; // index | bool | texto | frase de ejemplo (sentence)
  aceptadas?: string[];             // fill_blank: variantes válidas
  criterio?: string;                // sentence: qué debe cumplir la frase (para grading IA)
  explicacion?: string;             // opcional, se muestra tras calificar
}

export interface EjercicioSet {
  _id: string;
  nivel: string;
  step: string;
  preguntas: Ejercicio[];
  generatedBy: string | null;
  _createdDate: string;
  _updatedDate: string;
}

/**
 * EjerciciosInteractivosRepository — cache de un set de ejercicios por (nivel, step).
 * Los ejercicios se generan una vez por step (IA) y se reutilizan entre estudiantes.
 */
export const EjerciciosInteractivosRepository = {
  async findByNivelStep(nivel: string, step: string): Promise<EjercicioSet | null> {
    return queryOne<EjercicioSet>(
      `SELECT "_id","nivel","step","preguntas","generatedBy","_createdDate","_updatedDate"
         FROM "EJERCICIOS_INTERACTIVOS"
        WHERE "nivel" = $1 AND "step" = $2
        LIMIT 1`,
      [nivel, step],
    );
  },

  /** Lista todos los sets generados (para el panel admin). */
  async listAll(): Promise<{ nivel: string; step: string; count: number; updatedAt: string }[]> {
    const r = await query(
      `SELECT "nivel","step", COALESCE(jsonb_array_length("preguntas"),0)::int AS "count", "_updatedDate"
         FROM "EJERCICIOS_INTERACTIVOS" ORDER BY "nivel","step"`,
    );
    return r.rows.map((x: any) => ({ nivel: x.nivel, step: x.step, count: x.count, updatedAt: x._updatedDate }));
  },

  /** UPSERT por (nivel, step): reemplaza el set si ya existía (regenerar). */
  async upsert(row: { _id: string; nivel: string; step: string; preguntas: Ejercicio[]; generatedBy: string | null }): Promise<void> {
    await query(
      `INSERT INTO "EJERCICIOS_INTERACTIVOS" ("_id","nivel","step","preguntas","generatedBy","_createdDate","_updatedDate")
       VALUES ($1,$2,$3,$4::jsonb,$5,NOW(),NOW())
       ON CONFLICT ("nivel","step") DO UPDATE
         SET "preguntas" = EXCLUDED."preguntas",
             "generatedBy" = EXCLUDED."generatedBy",
             "_updatedDate" = NOW()`,
      [row._id, row.nivel, row.step, JSON.stringify(row.preguntas), row.generatedBy],
    );
  },
};
