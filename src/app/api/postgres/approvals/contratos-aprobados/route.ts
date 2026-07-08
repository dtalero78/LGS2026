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
 *   - Finalizados : estado='FINALIZADA' (fin del ciclo de vida)
 *   - Inactivos   : estadoInactivo=true (inactivo por otra razón, no finalizado)
 *   - Aprobados   : activo (estadoInactivo != true)
 *
 * El ciclo de vida vive en `estado` (FINALIZADA), NO en `aprobacion` — que es
 * la decisión de aprobación inmutable ('Aprobado'). El CASE evalúa Finalizados
 * primero (estado), luego Inactivos (estadoInactivo), y el resto Aprobados.
 * El WHERE tolera data legacy que aún tenga aprobacion='FINALIZADA'.
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
              WHEN "estado" = 'FINALIZADA' THEN 'Finalizados'
              WHEN "estadoInactivo" = true THEN 'Inactivos'
              ELSE 'Aprobados'
            END AS "categoria"
     FROM "PEOPLE"
     WHERE "tipoUsuario" = 'TITULAR'
       AND COALESCE("contrato",'') NOT LIKE 'PRB-%'
       AND (
         "aprobacion" IN ('Aprobado','Aprobada')
         OR "estado" = 'FINALIZADA'
       )
     ORDER BY "fechaIngreso" DESC NULLS LAST, "_createdDate" DESC`
  );

  return successResponse({
    approvals: result.rows,
    count: result.rowCount || 0,
  });
});
