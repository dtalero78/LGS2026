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
 *   - Aprobados   : aprobacion='Aprobado' AND estado='ACTIVA' AND NOT estadoInactivo
 *   - Inactivos   : aprobacion='Aprobado' AND estadoInactivo=true (opción A)
 *   - Finalizados : aprobacion='FINALIZADA' AND estado='FINALIZADA' (case-insensitive)
 *
 * El CASE evalúa Inactivos primero → un aprobado inactivo nunca cae en Aprobados
 * (mutuamente excluyentes). Excluye PRB-. Gateado por APROBACION.CONTRATOS_APROBADOS.VER.
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
              WHEN "aprobacion" = 'Aprobado' AND "estado" = 'ACTIVA' THEN 'Aprobados'
              WHEN UPPER("aprobacion") = 'FINALIZADA' AND "estado" = 'FINALIZADA' THEN 'Finalizados'
            END AS "categoria"
     FROM "PEOPLE"
     WHERE "tipoUsuario" = 'TITULAR'
       AND COALESCE("contrato",'') NOT LIKE 'PRB-%'
       AND (
         ("aprobacion" = 'Aprobado' AND "estado" = 'ACTIVA' AND "estadoInactivo" IS NOT TRUE)
         OR ("aprobacion" = 'Aprobado' AND "estadoInactivo" = true)
         OR (UPPER("aprobacion") = 'FINALIZADA' AND "estado" = 'FINALIZADA')
       )
     ORDER BY "_createdDate" DESC`
  );

  return successResponse({
    approvals: result.rows,
    count: result.rowCount || 0,
  });
});
