import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query, queryOne } from '@/lib/postgres';
import { ValidationError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { syncFinancieroSaldo } from '@/services/pagos-titulares.service';

const VALID_PLAN = ['Contado', 'Credito', 'Colaborador'] as const;
type Plan = typeof VALID_PLAN[number];
function normalizePlan(v: any): Plan | null {
  if (!v) return null;
  const s = String(v).trim();
  return (VALID_PLAN as readonly string[]).includes(s) ? (s as Plan) : null;
}

/** Parse string monetario "$ 1.234.567" / "1234567" / "1234.5" → number. */
function parseMoney(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  const { contrato, titular, financial, beneficiarios, titularEsBeneficiario } = await request.json();

  // Plan (Contado/Credito/Colaborador) — se valida y propaga a PEOPLE (titular +
  // beneficiarios) y FINANCIEROS. Mismo patrón que /api/postgres/contracts.
  const plan = normalizePlan(financial?.plan);
  if (financial?.plan && !plan) {
    throw new ValidationError(`plan debe ser uno de: ${VALID_PLAN.join(', ')}`);
  }

  if (!contrato?.trim()) throw new ValidationError('El número de contrato es requerido');
  if (!titular?.plataforma) throw new ValidationError('plataforma es requerida');
  if (!titular?.numeroId || !titular?.primerNombre || !titular?.primerApellido) {
    throw new ValidationError('numeroId, primerNombre y primerApellido del titular son requeridos');
  }

  // Verificar que el número de contrato no exista ya
  const existing = await queryOne(
    `SELECT "_id" FROM "PEOPLE" WHERE "contrato" = $1 LIMIT 1`,
    [contrato.trim()]
  );
  if (existing) throw new ConflictError(`Ya existe un contrato con el número "${contrato}"`);

  // Calcular finalContrato a partir de vigencia si no viene explícito
  let finalContrato = financial?.finalContrato || null;
  if (!finalContrato && financial?.vigencia) {
    const vigenciaMeses = parseInt(financial.vigencia, 10);
    if (vigenciaMeses > 0) {
      const base = financial.fechaContrato ? new Date(financial.fechaContrato) : new Date();
      base.setMonth(base.getMonth() + vigenciaMeses);
      finalContrato = base.toISOString().split('T')[0];
    }
  }

  const contratoTrimmed = contrato.trim();
  const titularId = ids.person();

  // 1. Crear TITULAR en PEOPLE
  await query(
    `INSERT INTO "PEOPLE" (
      "_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
      "email", "celular", "telefono", "fechaNacimiento", "domicilio", "ciudad",
      "plataforma", "ingresos", "empresa", "cargo", "genero",
      "referenciaUno", "parentezcoRefUno", "telefonoRefUno",
      "referenciaDos", "parentezcoRefDos", "telefonoRefDos",
      "asesor", "medioPago", "tipoUsuario", "contrato",
      "vigencia", "fechaContrato", "finalContrato", "plan",
      "aprobacion", "estadoInactivo", "origen", "_createdDate", "_updatedDate"
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
      $18,$19,$20,$21,$22,$23,$24,$25,
      'TITULAR',$26,$27,$28,$29::date,$30,
      'Pendiente',false,'POSTGRES',NOW(),NOW()
    )`,
    [
      titularId,
      titular.numeroId,
      titular.primerNombre,
      titular.segundoNombre || null,
      titular.primerApellido,
      titular.segundoApellido || null,
      titular.email || null,
      titular.celular || null,
      titular.telefono || null,
      titular.fechaNacimiento || null,
      titular.domicilio || null,
      titular.ciudad || null,
      titular.plataforma,
      titular.ingresos || null,
      titular.empresa || null,
      titular.cargo || null,
      titular.genero || null,
      titular.referenciaUno || null,
      titular.parentezcoRefUno || null,
      titular.telRefUno || null,
      titular.referenciaDos || null,
      titular.parentezcoRefDos || null,
      titular.telRefDos || null,
      titular.asesor || null,
      financial?.medioPago || null,
      contratoTrimmed,
      financial?.vigencia || null,
      financial?.fechaContrato || null,
      finalContrato,
      plan,
    ]
  );

  // 2. Construir lista de beneficiarios
  const allBeneficiarios: any[] = [];

  if (titularEsBeneficiario) {
    allBeneficiarios.push({
      primerNombre: titular.primerNombre,
      segundoNombre: titular.segundoNombre,
      primerApellido: titular.primerApellido,
      segundoApellido: titular.segundoApellido,
      numeroId: titular.numeroId,
      fechaNacimiento: titular.fechaNacimiento,
      email: titular.email,
      celular: titular.celular,
      domicilio: titular.domicilio,
      ciudad: titular.ciudad,
    });
  }

  if (Array.isArray(beneficiarios) && beneficiarios.length > 0) {
    allBeneficiarios.push(...beneficiarios);
  }

  // 3. Crear cada BENEFICIARIO en PEOPLE
  const beneficiariosCreados: string[] = [];
  for (const b of allBeneficiarios) {
    const benefId = ids.person();
    await query(
      `INSERT INTO "PEOPLE" (
        "_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "email", "celular", "fechaNacimiento", "domicilio", "ciudad",
        "titularId", "tipoUsuario", "contrato", "plataforma",
        "vigencia", "fechaContrato", "finalContrato", "plan",
        "aprobacion", "estadoInactivo", "origen", "_createdDate", "_updatedDate"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        $12,'BENEFICIARIO',$13,$14,
        $15,$16,$17::date,$18,
        'Pendiente',false,'POSTGRES',NOW(),NOW()
      )`,
      [
        benefId,
        b.numeroId,
        b.primerNombre,
        b.segundoNombre || null,
        b.primerApellido,
        b.segundoApellido || null,
        b.email || null,
        b.celular || null,
        b.fechaNacimiento || null,
        b.domicilio || null,
        b.ciudad || null,
        titularId,
        contratoTrimmed,
        titular.plataforma,
        financial?.vigencia || null,
        financial?.fechaContrato || null,
        finalContrato,
        plan,
      ]
    );
    beneficiariosCreados.push(benefId);
  }

  // 4. Crear registro FINANCIERO si hay datos financieros
  if (financial?.totalPlan) {
    await query(
      `INSERT INTO "FINANCIEROS" (
        "_id", "contrato", "totalPlan", "numeroCuotas", "valorCuota",
        "pagoInscripcion", "saldo", "fechaPago", "medioPago", "vigencia", "plan",
        "origen", "_createdDate", "_updatedDate"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'POSTGRES',NOW(),NOW())`,
      [
        ids.financial(),
        contratoTrimmed,
        financial.totalPlan || 0,
        financial.numeroCuotas || 0,
        financial.valorCuota || 0,
        financial.pagoInscripcion || 0,
        financial.saldo || 0,
        financial.fechaPago || null,
        financial.medioPago || null,
        financial.vigencia || null,
        plan,
      ]
    );

    // 5. Crear cuota #0 en PAGOS_TITULARES — mismo patrón que /api/postgres/contracts.
    //    Diferencias vs flujo de Crear Contrato:
    //      - validadoPor = 'SISTEMA' (la inscripción fue validada offline; este endpoint
    //        sólo migra el registro contable)
    //      - createdBy   = email del admin que disparó la migración (auditoría)
    //      - gestorRecaudo = titular.asesor (resuelto a USUARIOS_ROLES._id si existe)
    //    Best effort: si falla NO rompe la migración.
    try {
      const adminEmail = (session?.user as any)?.email || 'unknown';
      const totalPlanNum   = parseMoney(financial.totalPlan);
      const inscripcionNum = parseMoney(financial.pagoInscripcion);
      const saldoNum       = parseMoney(financial.saldo);
      const valorCuotaNum  = parseMoney(financial.valorCuota);
      const cuotasTotalNum = parseInt(String(financial.numeroCuotas ?? 0), 10) || 0;

      // Resolver _id del comercial (asesor) — fallback al email crudo si no existe en USUARIOS_ROLES
      const comercialEmail = (titular.asesor || '').trim().toLowerCase();
      let comercialId: string | null = null;
      if (comercialEmail) {
        const found = await query(
          `SELECT "_id" FROM "USUARIOS_ROLES" WHERE LOWER("email") = $1 LIMIT 1`,
          [comercialEmail]
        );
        comercialId = found.rows[0]?._id ?? comercialEmail;
      }

      await query(
        `INSERT INTO "PAGOS_TITULARES" (
           "_id", "idPeople", "numeroId", "gestorRecaudo", "plataforma",
           "fechaPago", "fechaVencimiento", "numCuota", "cuotasTotal", "vlrTotalProg",
           "valorCuota", "valorPagado", "inscripcion", "saldo", "descuento",
           "medioPago", "documentosAdjuntos",
           "validado", "fechaValidacion", "validadoPor",
           "createdBy", "tipoCartera", "plan", "_createdDate", "_updatedDate"
         ) VALUES (
           $1, $2, $3, $4, $5,
           COALESCE($6::date, CURRENT_DATE), $7::date, 0, $8, $9,
           $10, $11, $12, $13, 0,
           $14, '[]'::jsonb,
           true, COALESCE($6::date, CURRENT_DATE), 'SISTEMA',
           $15, 'normal', $16, NOW(), NOW()
         )`,
        [
          ids.payment(),                          // $1
          titularId,                              // $2
          titular.numeroId,                       // $3
          comercialId,                            // $4  gestorRecaudo
          titular.plataforma || null,             // $5
          financial.fechaPago || null,            // $6  (también fechaValidacion via COALESCE)
          financial.fechaPago || null,            // $7  fechaVencimiento — para migración =fechaPago
          cuotasTotalNum,                         // $8
          totalPlanNum,                           // $9  vlrTotalProg
          valorCuotaNum,                          // $10
          inscripcionNum,                         // $11 valorPagado
          inscripcionNum,                         // $12 inscripcion (etiqueta semántica)
          saldoNum,                               // $13
          financial.medioPago || null,            // $14
          adminEmail,                             // $15 createdBy
          plan,                                   // $16
        ]
      );

      // 6. Sync FINANCIEROS.saldo desde la cuota #0 recién validada.
      await syncFinancieroSaldo(titularId);
    } catch (err: any) {
      console.warn(`[migrar-contrato] PAGOS_TITULARES cuota#0 falló para ${contratoTrimmed}:`, err?.message || err);
    }
  }

  return successResponse({
    message: `Contrato ${contratoTrimmed} migrado exitosamente`,
    titularId,
    contrato: contratoTrimmed,
    beneficiariosCreados: beneficiariosCreados.length,
  });
});
