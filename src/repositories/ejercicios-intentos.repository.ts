import 'server-only';
import { query, queryOne } from '@/lib/postgres';

/** Un intento de ejercicio de práctica registrado por estudiante (1 por step). */
export interface EjercicioIntento {
  _id: string;
  studentId: string;
  numeroId: string | null;
  nivel: string;
  step: string;
  stepNum: number | null;
  porcentaje: number | null;
  aprobado: boolean | null;
  _createdDate: string;
}

/**
 * EjerciciosIntentosRepository — registro por estudiante de qué step ha
 * completado su ejercicio de práctica. Regla: 1 solo intento por step
 * (índice único studentId+nivel+step). Alimenta el contador "generados /
 * quedan" (hasta su step actual).
 */
export const EjerciciosIntentosRepository = {
  /** El intento del estudiante en un step concreto (o null si aún no lo hizo). */
  async findByStudentStep(studentId: string, nivel: string, step: string): Promise<EjercicioIntento | null> {
    return queryOne<EjercicioIntento>(
      `SELECT "_id","studentId","numeroId","nivel","step","stepNum","porcentaje","aprobado","_createdDate"
         FROM "EJERCICIOS_INTENTOS"
        WHERE "studentId" = $1 AND "nivel" = $2 AND "step" = $3
        LIMIT 1`,
      [studentId, nivel, step],
    );
  },

  /** Cuántos ejercicios ha completado el estudiante EN UN NIVEL (1 por step). */
  async countByStudentNivel(studentId: string, nivel: string): Promise<number> {
    const r = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n
         FROM "EJERCICIOS_INTENTOS"
        WHERE "studentId" = $1 AND "nivel" = $2`,
      [studentId, nivel],
    );
    return r?.n ?? 0;
  },

  /**
   * Inserta el intento si el estudiante no tenía uno para ese step (1 por step).
   * Devuelve true si insertó, false si ya existía (ON CONFLICT DO NOTHING).
   */
  async insertIfAbsent(row: {
    _id: string; studentId: string; numeroId: string | null;
    nivel: string; step: string; stepNum: number | null;
    porcentaje: number | null; aprobado: boolean | null;
  }): Promise<boolean> {
    const r = await query(
      `INSERT INTO "EJERCICIOS_INTENTOS"
         ("_id","studentId","numeroId","nivel","step","stepNum","porcentaje","aprobado","_createdDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT ("studentId","nivel","step") DO NOTHING`,
      [row._id, row.studentId, row.numeroId, row.nivel, row.step, row.stepNum, row.porcentaje, row.aprobado],
    );
    return (r.rowCount ?? 0) > 0;
  },
};
