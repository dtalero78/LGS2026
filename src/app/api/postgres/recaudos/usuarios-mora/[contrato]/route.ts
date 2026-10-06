import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { RecaudosPermission } from '@/types/permissions';
import { queryMany, queryOne } from '@/lib/postgres';
import { certificadoService } from '@/services/certificado.service';

/**
 * GET /api/postgres/recaudos/usuarios-mora/[contrato]
 *
 * Beneficiarios del contrato (cascada del informe Usuarios en mora): niveles
 * aprobados (Beginner/Practical/Functional = Jump 15/30/45, misma regla del
 * certificado), nivel actual de su ficha académica y si está activo.
 * Gateado por RECAUDOS.USUARIOS_MORA.VER.
 */
export const GET = handlerWithStaffAuth(async (_req, { params }, session) => {
  await requirePermission(session, RecaudosPermission.USUARIOS_MORA_VER);
  const contrato = decodeURIComponent(params.contrato || '');

  const benefs = await queryMany<any>(
    `SELECT "_id", "numeroId", "aprobacion", "estado", "estadoInactivo", "fechaOnHold", "kids",
            TRIM(REGEXP_REPLACE(CONCAT_WS(' ', "primerNombre", "segundoNombre", "primerApellido", "segundoApellido"), '\\s+', ' ', 'g')) AS nombre
       FROM "PEOPLE"
      WHERE "contrato" = $1 AND "tipoUsuario" <> 'TITULAR'
      ORDER BY "_createdDate"`, [contrato]);

  const beneficiarios = await Promise.all(benefs.map(async (b) => {
    // Ficha académica: la ligada a esta fila (usuarioId) y, si no, la del documento.
    const acad = await queryOne<any>(
      `SELECT "_id", "nivel", "step", "estadoInactivo" FROM "ACADEMICA"
        WHERE "usuarioId" = $1
           OR UPPER(REGEXP_REPLACE(COALESCE("numeroId",''), '[.[:space:]_-]', '', 'g'))
            = UPPER(REGEXP_REPLACE(COALESCE($2,''), '[.[:space:]_-]', '', 'g'))
        ORDER BY ("usuarioId" = $1) DESC, "_createdDate" DESC LIMIT 1`, [b._id, b.numeroId]);
    let niveles: Record<string, { aprobado: boolean; fecha: string | null }> | null = null;
    if (acad) {
      try {
        const est = await certificadoService.getEstado(acad._id, { sinMora: true });
        niveles = Object.fromEntries(Object.entries(est.niveles).map(([k, v]) => [k, { aprobado: v.aprobado, fecha: v.fecha }]));
      } catch { niveles = null; }
    }
    return {
      _id: b._id,
      nombre: b.nombre,
      numeroId: b.numeroId,
      aprobacion: b.aprobacion,
      kids: b.kids === true,
      activo: b.estadoInactivo !== true && String(b.estado || '').toUpperCase() !== 'FINALIZADA',
      onHold: b.estadoInactivo === true && !!b.fechaOnHold,
      academicaId: acad?._id ?? null,
      nivel: acad?.nivel ?? null,
      step: acad?.step ?? null,
      niveles,
    };
  }));

  return successResponse({ contrato, beneficiarios });
});
