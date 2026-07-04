import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ComercialPermission } from '@/types/permissions';
import { query } from '@/lib/postgres';

/**
 * GET /api/postgres/matriculas
 *
 * Lista TODOS los contratos (titulares) para el módulo Matrículas, con un campo
 * calculado `categoria` (estado de aprobación) para filtrar en el cliente:
 *   Aprobados / Rechazado / Pendiente / En revisión / Firmado sin aprobar / Sin firmar.
 * Incluye `asesorAsignado` (nombre del asesor) y `numBeneficiarios` (para el modal
 * de borrado). Excluye PRB-. Gateado por COMERCIAL.MATRICULAS.VER.
 */
export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  await requirePermission(session, ComercialPermission.MATRICULAS_VER);

  const result = await query(
    `SELECT p."_id", p."primerNombre", p."segundoNombre", p."primerApellido", p."segundoApellido",
            p."numeroId", p."contrato", p."celular", p."email", p."plataforma",
            p."aprobacion", p."estado", p."estadoInactivo", p."hashConsentimiento",
            p."asesorAsignado", p."asesor", p."_createdDate", p."fechaIngreso",
            COALESCE(bc."n", 0) AS "numBeneficiarios",
            CASE
              WHEN p."aprobacion" = 'Aprobado'      THEN 'Aprobados'
              WHEN p."aprobacion" = 'Rechazado'     THEN 'Rechazado'
              WHEN p."aprobacion" = 'Pendiente'     THEN 'Pendiente'
              WHEN p."aprobacion" = 'En revisión'   THEN 'En revisión'
              WHEN COALESCE(p."hashConsentimiento",'') <> '' AND COALESCE(p."aprobacion",'') = '' THEN 'Firmado sin aprobar'
              WHEN COALESCE(p."hashConsentimiento",'') =  '' AND COALESCE(p."aprobacion",'') = '' THEN 'Sin firmar'
              ELSE COALESCE(NULLIF(p."aprobacion",''), 'Otro')
            END AS "categoria"
     FROM "PEOPLE" p
     LEFT JOIN (
       SELECT "contrato", COUNT(*) FILTER (WHERE "tipoUsuario" <> 'TITULAR')::int AS "n"
       FROM "PEOPLE" WHERE COALESCE("contrato",'') <> '' GROUP BY "contrato"
     ) bc ON bc."contrato" = p."contrato"
     WHERE p."tipoUsuario" = 'TITULAR'
       AND COALESCE(p."contrato",'') NOT LIKE 'PRB-%'
     ORDER BY p."_createdDate" DESC`
  );

  return successResponse({ matriculas: result.rows, count: result.rowCount || 0 });
});
