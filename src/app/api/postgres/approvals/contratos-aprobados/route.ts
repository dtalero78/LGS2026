import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { query } from '@/lib/postgres';

/**
 * GET /api/postgres/approvals/contratos-aprobados
 *
 * Informe de contratos ya decididos (titulares). Devuelve las 3 categorías con
 * un campo calculado `categoria` para filtrar en el cliente:
 *   - Aprobados   : aprobacion='Aprobado' AND estadoInactivo IS NOT TRUE (false/null)
 *   - Inactivos   : aprobacion='Aprobado' AND estadoInactivo=true
 *   - Finalizados : aprobacion='FINALIZADA' AND estado='FINALIZADA' (case-insensitive)
 *
 * Aprobados vs Inactivos se distinguen SOLO por el flag `estadoInactivo` (no por
 * el string `estado`). El CASE evalúa Inactivos primero → mutuamente excluyentes.
 * Excluye PRB-. Gateado por APROBACION.CONTRATOS_APROBADOS.VER.
 */
export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  await requirePermission(session, AprobacionPermission.CONTRATOS_APROBADOS_VER);

  const result = await query(
    `SELECT "_id", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
            "numeroId", "contrato", "celular", "email", "plataforma", "tipoUsuario",
            "aprobacion", "estado", "estadoInactivo", "hashConsentimiento", "documentacion",
            "_createdDate", "fechaIngreso",
            CASE
              WHEN "aprobacion" = 'Aprobado' AND "estadoInactivo" = true THEN 'Inactivos'
              WHEN "aprobacion" = 'Aprobado' THEN 'Aprobados'
              WHEN UPPER("aprobacion") = 'FINALIZADA' AND "estado" = 'FINALIZADA' THEN 'Finalizados'
            END AS "categoria"
     FROM "PEOPLE"
     WHERE "tipoUsuario" = 'TITULAR'
       AND COALESCE("contrato",'') NOT LIKE 'PRB-%'
       AND (
         "aprobacion" = 'Aprobado'
         OR (UPPER("aprobacion") = 'FINALIZADA' AND "estado" = 'FINALIZADA')
       )
     ORDER BY "_createdDate" DESC`
  );

  return successResponse({
    approvals: result.rows,
    count: result.rowCount || 0,
  });
});
