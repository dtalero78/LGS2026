import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { queryMany } from '@/lib/postgres';

/**
 * GET /api/postgres/aprobacion/contratos-canje
 *
 * Contratos de canje (PEOPLE.tipoContrato = 'CANJE', creados con el botón CANJE de
 * Crear Contrato). No salen en el Centro de Aprobaciones: se consultan y aprueban
 * aquí. Una fila por titular con valor del programa, duración, condiciones, firma,
 * estado y sus beneficiarios. Permiso APROBACION.CONTRATOS_CANJE.VER.
 */
export const GET = handlerWithStaffAuth(async (_req, _ctx, session) => {
  await requirePermission(session, AprobacionPermission.CONTRATOS_CANJE_VER);

  const contratos = await queryMany(
    `SELECT t."_id", t."contrato", t."primerNombre", t."segundoNombre", t."primerApellido", t."segundoApellido",
            t."numeroId", t."plataforma", t."celular", t."email", t."asesor", t."asesorCreadorContrato",
            t."aprobacion", t."estado", t."estadoInactivo", t."vigencia", t."finalContrato",
            COALESCE(t."fechaContrato", t."_createdDate") AS "fecha", t."fechaIngreso",
            (COALESCE(t."hashConsentimiento",'') <> '') AS "firmado",
            t."condicionesCanje", f."totalPlan",
            COALESCE((
              SELECT json_agg(json_build_object(
                       '_id', b."_id", 'numeroId', b."numeroId", 'aprobacion', b."aprobacion", 'kids', b."kids",
                       'nombre', TRIM(CONCAT_WS(' ', b."primerNombre", b."segundoNombre", b."primerApellido", b."segundoApellido")))
                     ORDER BY b."primerNombre")
                FROM "PEOPLE" b
               WHERE b."contrato" = t."contrato" AND b."tipoUsuario" = 'BENEFICIARIO'), '[]'::json) AS "beneficiarios"
       FROM "PEOPLE" t
       LEFT JOIN LATERAL (
         SELECT "totalPlan" FROM "FINANCIEROS" WHERE "contrato" = t."contrato" ORDER BY "_createdDate" DESC LIMIT 1
       ) f ON true
      WHERE t."tipoUsuario" = 'TITULAR' AND t."tipoContrato" = 'CANJE'
      ORDER BY t."_createdDate" DESC
      LIMIT 1000`,
  );

  return successResponse({ contratos });
});
