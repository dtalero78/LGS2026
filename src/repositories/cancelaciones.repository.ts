/**
 * Cancelaciones Repository
 *
 * Tabla CANCELACIONES_SIN_REEMPLAZO — alumnos de sesiones canceladas con booking
 * (modo "Sesión con booking" del modal Cancelar evento). Servicio los gestiona.
 * Schema en scripts/create-cancelaciones-sin-reemplazo-table.js.
 */

import 'server-only';
import { queryMany, queryOne, withTransaction } from '@/lib/postgres';

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

  /**
   * Botón global "Gestionada": pasa todos los actuales a histórico Y BORRA los
   * bookings cancelados (cancelo=true) de esos alumnos — una vez que Servicio los
   * gestionó, la clase cancelada sin reemplazo desaparece de su historial. El
   * registro para auditoría queda en CANCELACIONES_SIN_REEMPLAZO (histórico) y en
   * ADVISOR_EVENT_LOG ('NoAsistio').
   *
   * NO afecta el cupo semanal: el conteo ya excluye cancelo=true (el cupo se
   * liberó al cancelar el evento) y el evento ya no está en CALENDARIO, así que
   * no hay inscritos que ajustar. Transaccional: el DELETE corre ANTES del UPDATE,
   * mientras las filas siguen en loteGestionado=false.
   */
  async marcarActualesGestionadas(): Promise<{ gestionadas: number; bookingsBorrados: number }> {
    return withTransaction(async (client) => {
      // 1. Borrar los bookings cancelados de los alumnos que se van a histórico.
      //    Match por evento del lote (loteId = eventoId) + alumno del snapshot,
      //    y solo si el booking sigue cancelo=true (nunca toca uno activo).
      const del: any = await client.query(
        `DELETE FROM "ACADEMICA_BOOKINGS" b
           USING "CANCELACIONES_SIN_REEMPLAZO" c
          WHERE c."loteGestionado" = false
            AND (b."eventoId" = c."loteId" OR b."idEvento" = c."loteId")
            AND (b."idEstudiante" = c."studentId" OR b."studentId" = c."studentId")
            AND b."cancelo" = true`,
      );
      // 2. Pasar los actuales a histórico.
      const upd: any = await client.query(
        `UPDATE "CANCELACIONES_SIN_REEMPLAZO"
            SET "loteGestionado" = true, "_updatedDate" = NOW()
          WHERE "loteGestionado" = false`,
      );
      return { gestionadas: upd.rowCount ?? 0, bookingsBorrados: del.rowCount ?? 0 };
    });
  }
}

export const CancelacionesRepository = new CancelacionesRepositoryClass();
