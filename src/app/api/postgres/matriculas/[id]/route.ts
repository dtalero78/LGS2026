import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission } from '@/lib/api-permissions';
import { ComercialPermission, PersonPermission } from '@/types/permissions';
import { query, queryOne } from '@/lib/postgres';
import { NotFoundError } from '@/lib/errors';
import { attachKidsInscripciones } from '@/lib/kids-inscripciones';

/**
 * GET /api/postgres/matriculas/[id]
 *
 * Resumen de una matrícula (vista de tarjetas): el titular con su ficha + el
 * estado de la matrícula (aprobacion → 'Sin aprobar' si es null), y los
 * beneficiarios del mismo contrato, cada uno con su estado de perfil académico
 * (ACADEMICA por numeroId): si existe → nivel/step; si no → tienePerfilAcademico=false.
 * Gateado por COMERCIAL.MATRICULAS.DETALLE o PERSON.INFO.RESUMEN (botón "Resumen" de la ficha).
 */
export const GET = handlerWithStaffAuth(async (_req, { params }, session) => {
  await requireAnyPermission(session, [ComercialPermission.MATRICULAS_DETALLE, PersonPermission.RESUMEN]);
  let id = params.id;

  // Si el id es de un BENEFICIARIO (botón "Resumen" de su ficha), se resuelve
  // el titular de su mismo contrato.
  const persona = await queryOne<{ tipoUsuario: string | null; contrato: string | null }>(
    `SELECT "tipoUsuario", "contrato" FROM "PEOPLE" WHERE "_id" = $1 LIMIT 1`, [id]
  );
  if (persona && persona.tipoUsuario !== 'TITULAR' && persona.contrato) {
    const tit = await queryOne<{ _id: string }>(
      `SELECT "_id" FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'
        ORDER BY "_createdDate" ASC LIMIT 1`, [persona.contrato]
    );
    if (tit) id = tit._id;
  }

  const titular = await queryOne<any>(
    `SELECT p."_id", p."primerNombre", p."segundoNombre", p."primerApellido", p."segundoApellido",
            p."numeroId", p."contrato", p."plataforma", p."celular", p."email", p."domicilio",
            p."ciudad", p."fechaNacimiento", p."aprobacion", p."estado", p."hashConsentimiento",
            p."asesorAsignado", p."asesor", p."inicioContrato", p."fechaContrato", p."finalContrato",
            p."vigencia", p."_createdDate", p."fechaIngreso", p."tipoContrato",
            p."telefono", p."genero", p."cargo", p."empresa", p."ingresos", p."tipoPersona"
       FROM "PEOPLE" p WHERE p."_id" = $1 AND p."tipoUsuario" = 'TITULAR' LIMIT 1`,
    [id]
  );
  if (!titular) throw new NotFoundError('Titular', id);

  const rawAprob = (titular.aprobacion || '').toString().trim();
  const estadoMatricula = rawAprob || 'Sin aprobar';

  // Beneficiarios del contrato + perfil académico (LATERAL para evitar duplicados;
  // prefiere el registro BENEFICIARIO cuando hay ACADEMICA duplicada por numeroId).
  const benef = (await query(
    `SELECT p."_id", p."primerNombre", p."segundoNombre", p."primerApellido", p."segundoApellido",
            p."numeroId", p."celular", p."email", p."plataforma", p."fechaNacimiento", p."tipoUsuario",
            p."kids", p."contrato", p."telefono", p."domicilio", p."ciudad", p."genero",
            p."aprobacion", p."estadoInactivo",
            a."_id" AS "academicaId", a."nivel", a."step", a."foto",
            a."estadoInactivo" AS "academicaInactivo"
       FROM "PEOPLE" p
       LEFT JOIN LATERAL (
         SELECT "_id","nivel","step","foto","estadoInactivo"
         FROM "ACADEMICA"
         WHERE ("numeroId" = p."numeroId" AND COALESCE(p."numeroId", '') <> '') OR "usuarioId" = p."_id"
         ORDER BY ("usuarioId" = p."_id") DESC NULLS LAST,
                  (CASE WHEN "tipoUsuario" = 'BENEFICIARIO' THEN 0 ELSE 1 END)
         LIMIT 1
       ) a ON true
      WHERE p."contrato" = $1 AND p."tipoUsuario" <> 'TITULAR'
      ORDER BY p."primerApellido", p."primerNombre"`,
    [titular.contrato]
  )).rows.map((b: any) => ({
    ...b,
    kids: b.kids === true,
    tienePerfilAcademico: !!b.academicaId,
  }));

  // Adjunta el detalle de KIDS_INSCRIPCIONES (campaña/curso/salón/horario + apoderado)
  // a los beneficiarios kids, para mostrarlo en la tarjeta.
  await attachKidsInscripciones(titular.contrato, benef);

  // Avisos del botón Editar (CONTRATO_EVENTOS): identidad corregida después de la firma
  // (se apaga si luego se anuló la firma por un reemplazo) y documentación por revisar
  // tras un reemplazo (se apaga al subir un documento después).
  const ev = await queryOne<{ corregidoTrasFirma: string | null; revisarDocumentacion: string | null }>(
    `SELECT
       (SELECT MAX("_createdDate") FROM "CONTRATO_EVENTOS"
         WHERE "contrato" = $1 AND "accion" = 'Datos corregidos después de la firma'
           AND "_createdDate" > COALESCE((SELECT MAX("_createdDate") FROM "CONTRATO_EVENTOS"
                 WHERE "contrato" = $1 AND "accion" = 'Firma anulada por reemplazo'), 'epoch'::timestamptz)
       )::text AS "corregidoTrasFirma",
       (SELECT "detalle" FROM "CONTRATO_EVENTOS"
         WHERE "contrato" = $1 AND "accion" = 'Revisar documentación (reemplazo)'
           AND "_createdDate" > COALESCE((SELECT MAX("_createdDate") FROM "CONTRATO_EVENTOS"
                 WHERE "contrato" = $1 AND "accion" = 'Documento subido'), 'epoch'::timestamptz)
         ORDER BY "_createdDate" DESC LIMIT 1) AS "revisarDocumentacion"`,
    [titular.contrato]
  ).catch(() => null);
  const firmado = String(titular.hashConsentimiento || '').trim() !== '';
  const alertas = {
    corregidoTrasFirma: firmado && !!ev?.corregidoTrasFirma,
    revisarDocumentacion: ev?.revisarDocumentacion || null,
  };
  delete titular.hashConsentimiento;

  return successResponse({
    alertas,
    titular: { ...titular, firmado, estadoMatricula },
    beneficiarios: benef,
    totalBeneficiarios: benef.length,
  });
});
