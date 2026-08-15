/**
 * Cancelaciones Repository
 *
 * Tabla CANCELACIONES_SIN_REEMPLAZO — alumnos de sesiones canceladas con booking
 * (modo "Sesión con booking" del modal Cancelar evento). Servicio los gestiona.
 * Schema en scripts/create-cancelaciones-sin-reemplazo-table.js.
 */

import 'server-only';
import { queryMany, queryOne, query } from '@/lib/postgres';

const COLS = `
  "_id", "loteId", "eventoId", "fechaEvento", "horaEvento", "tipo", "nivel", "step",
  "tituloEvento", "advisorId", "advisorNombre", "studentId", "numeroId", "nombre",
  "telefono", "email", "gestion", "gestionadaPor", "fechaGestion", "loteGestionado",
  "_createdDate"
`;

class CancelacionesRepositoryClass {
  /** Filas por vista: 'actual' = sin gestionar (loteGestionado=false); 'historico' = gestionadas. */
  async findByVista(vista: 'actual' | 'historico') {
    const gestionado = vista === 'historico';
    return queryMany(
      `SELECT ${COLS} FROM "CANCELACIONES_SIN_REEMPLAZO"
        WHERE "loteGestionado" = $1
        ORDER BY "fechaEvento" DESC NULLS LAST, "loteId", "nombre" ASC`,
      [gestionado],
    );
  }

  /** Registros actuales todavía en 'SIN_GESTION' (bloquean el botón global "Gestionada"). */
  async countPendientesSinGestion(): Promise<number> {
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM "CANCELACIONES_SIN_REEMPLAZO"
        WHERE "loteGestionado" = false AND "gestion" = 'SIN_GESTION'`,
    );
    return row?.n ?? 0;
  }

  async countActual(): Promise<number> {
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM "CANCELACIONES_SIN_REEMPLAZO" WHERE "loteGestionado" = false`,
    );
    return row?.n ?? 0;
  }

  async updateGestion(id: string, gestion: string, gestionadaPor: string | null) {
    return queryOne(
      `UPDATE "CANCELACIONES_SIN_REEMPLAZO"
          SET "gestion" = $2,
              "gestionadaPor" = $3,
              "fechaGestion" = CASE WHEN $2 = 'SIN_GESTION' THEN NULL ELSE NOW() END,
              "_updatedDate" = NOW()
        WHERE "_id" = $1
      RETURNING ${COLS}`,
      [id, gestion, gestionadaPor],
    );
  }

  /** Botón global "Gestionada": pasa todos los actuales a histórico. */
  async marcarActualesGestionadas(): Promise<number> {
    const r: any = await query(
      `UPDATE "CANCELACIONES_SIN_REEMPLAZO"
          SET "loteGestionado" = true, "_updatedDate" = NOW()
        WHERE "loteGestionado" = false`,
    );
    return r.rowCount ?? 0;
  }
}

export const CancelacionesRepository = new CancelacionesRepositoryClass();
