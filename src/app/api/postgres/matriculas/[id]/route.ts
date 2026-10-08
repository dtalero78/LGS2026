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
            p."vigencia", p."_createdDate", p."fechaIngreso"
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
            p."kids", p."contrato",
            a."_id" AS "academicaId", a."nivel", a."step", a."foto",
            a."estadoInactivo" AS "academicaInactivo"
       FROM "PEOPLE" p
       LEFT JOIN LATERAL (
         SELECT "_id","nivel","step","foto","estadoInactivo"
         FROM "ACADEMICA" WHERE "numeroId" = p."numeroId"
         ORDER BY (CASE WHEN "tipoUsuario" = 'BENEFICIARIO' THEN 0 ELSE 1 END)
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

  return successResponse({
    titular: { ...titular, estadoMatricula },
    beneficiarios: benef,
    totalBeneficiarios: benef.length,
  });
});
