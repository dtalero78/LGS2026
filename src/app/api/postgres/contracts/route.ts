import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { ValidationError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { syncFinancieroSaldo } from '@/services/pagos-titulares.service';
import crypto from 'crypto';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/**
 * Respaldo para `EQUIPO_COMERCIAL.nombre` (NOT NULL) cuando el contrato no trae
 * el nombre del comercial. Se trata como "vacío" en el upsert: si más adelante
 * llega un contrato con el nombre real, lo reemplaza.
 */
const NOMBRE_COMERCIAL_PLACEHOLDER = 'Nombre Comercial';

/**
 * Registra al comercial que creó el contrato en EQUIPO_COMERCIAL.
 *
 *   correo     ← titular.asesor (EMAIL — es la llave, índice único ci)
 *   nombre     ← titular.asesorCreadorContrato
 *   plataforma ← titular.plataforma
 *
 * Se salta si `asesor` no es un email válido (dato legacy: hay contratos viejos
 * donde ese campo guarda el nombre — ver scripts/fix-asesor-nombre-en-campo-email.js).
 *
 * ON CONFLICT: si el comercial YA existe (p.ej. dado de alta en "Crea UserRol"
 * con clave/filial/usuarioRolId), NO se pisa nada — solo se rellenan `nombre` y
 * `plataforma` si estaban vacíos. Nunca toca clave/filial/usuarioRolId/activo.
 *
 * Best-effort: cualquier error se loguea y se ignora (el contrato ya está creado).
 */
async function upsertEquipoComercial(titular: any, contrato: string): Promise<void> {
  try {
    const correo = String(titular?.asesor ?? '').trim().toLowerCase();
    if (!correo || !isEmail(correo)) return;

    // `nombre` es NOT NULL: si no vino el nombre, se guarda un placeholder.
    const nombre = String(titular?.asesorCreadorContrato ?? '').trim() || NOMBRE_COMERCIAL_PLACEHOLDER;
    const plataforma = String(titular?.plataforma ?? '').trim() || null;

    // El nombre guardado se considera "vacío" si está en blanco O si es el
    // placeholder → así un contrato posterior con el nombre real lo reemplaza,
    // en vez de quedar pegado para siempre. Un nombre real nunca se pisa.
    await query(
      `INSERT INTO "EQUIPO_COMERCIAL"
         ("_id", "nombre", "correo", "plataforma", "activo", "_createdDate", "_updatedDate")
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (LOWER(TRIM("correo"))) DO UPDATE
         SET "nombre"     = COALESCE(NULLIF(NULLIF(TRIM("EQUIPO_COMERCIAL"."nombre"), ''), $5), EXCLUDED."nombre"),
             "plataforma" = COALESCE(NULLIF(TRIM("EQUIPO_COMERCIAL"."plataforma"), ''), EXCLUDED."plataforma"),
             "_updatedDate" = NOW()`,
      [crypto.randomUUID(), nombre, correo, plataforma, NOMBRE_COMERCIAL_PLACEHOLDER]
    );
  } catch (err: any) {
    console.warn(`[contracts] EQUIPO_COMERCIAL upsert falló para ${contrato}:`, err?.message || err);
  }
}

function parseMoney(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const CODIGOS_PAIS: Record<string, string> = {
  'Chile': '01',
  'Colombia': '02',
  'Ecuador': '03',
  'Perú': '04',
};

/**
 * Generate next contract number server-side (atomic, avoids race conditions).
 *
 * - esPrueba=false → `<CODIGO_PAIS>-NNNNN-YY` (consecutivo del país, excluye PRB-).
 * - esPrueba=true  → `PRB-NNNNN-YY` (consecutivo INDEPENDIENTE para pruebas,
 *                    NO contamina el secuencial real, plataforma ignorada para el número).
 */
async function generateContractNumber(plataforma: string, esPrueba: boolean): Promise<string> {
  const anoActual = new Date().getFullYear().toString().slice(-2);

  if (esPrueba) {
    const patron = `PRB-%-${anoActual}`;
    const result = await query(
      `SELECT MAX(CAST(SPLIT_PART("contrato", '-', 2) AS INTEGER)) AS max_num
       FROM "PEOPLE"
       WHERE "contrato" LIKE $1
         AND SPLIT_PART("contrato", '-', 2) ~ '^[0-9]+$'`,
      [patron]
    );
    const maxNumero = result.rows[0]?.max_num || 0;
    const siguiente = (maxNumero + 1).toString().padStart(5, '0');
    return `PRB-${siguiente}-${anoActual}`;
  }

  const codigoPais = CODIGOS_PAIS[plataforma];
  if (!codigoPais) throw new ValidationError(`País no válido: ${plataforma}`);

  const patron = `${codigoPais}-%-${anoActual}`;

  const result = await query(
    `SELECT MAX(CAST(SPLIT_PART("contrato", '-', 2) AS INTEGER)) AS max_num
     FROM "PEOPLE"
     WHERE "contrato" LIKE $1
       AND "contrato" NOT LIKE 'PRB-%'
       AND SPLIT_PART("contrato", '-', 2) ~ '^[0-9]+$'`,
    [patron]
  );

  const maxNumero = result.rows[0]?.max_num || 9999;
  const siguiente = (maxNumero + 1).toString().padStart(5, '0');
  return `${codigoPais}-${siguiente}-${anoActual}`;
}

const VALID_TIPO_PLAN = ['Contado', 'Credito', 'Colaborador'] as const;
type TipoPlan = typeof VALID_TIPO_PLAN[number];
function normalizeTipoPlan(v: any): TipoPlan | null {
  if (!v) return null;
  const s = String(v).trim();
  return (VALID_TIPO_PLAN as readonly string[]).includes(s) ? (s as TipoPlan) : null;
}

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  const { titular, financial, beneficiarios, titularEsBeneficiario, sence, clientToday, esContratoPrueba } = await request.json();
  const esPrueba = esContratoPrueba === true;
  // SENCE solo aplica a titular-beneficiario de CHILE (defensa server-side).
  const senceVal = titularEsBeneficiario === true && sence === true
    && String(titular?.plataforma || '').trim().toLowerCase() === 'chile';

  // Plataforma sólo es obligatoria para contratos REALES; en pruebas se permite sin plataforma.
  if (!esPrueba && !titular?.plataforma) throw new ValidationError('plataforma is required');
  if (!titular?.numeroId || !titular?.primerNombre || !titular?.primerApellido) {
    throw new ValidationError('titular with numeroId, primerNombre, and primerApellido is required');
  }

  // tipoPlan (Contado / Credito / Colaborador) — se valida y propaga a 3 tablas
  const tipoPlan = normalizeTipoPlan(financial?.tipoPlan);
  if (financial?.tipoPlan && !tipoPlan) {
    throw new ValidationError(`tipoPlan debe ser uno de: ${VALID_TIPO_PLAN.join(', ')}`);
  }

  // Generate contract number server-side to avoid race conditions.
  // Si es prueba → PRB-NNNNN-YY (consecutivo independiente, no afecta el real).
  const contrato = await generateContractNumber(titular.plataforma, esPrueba);

  // Calculate finalContrato = today + vigencia months
  const vigenciaMeses = parseInt(financial?.vigencia || '0', 10);
  const fechaInicio = new Date();
  const fechaFinal = new Date(fechaInicio);
  if (vigenciaMeses > 0) {
    fechaFinal.setMonth(fechaFinal.getMonth() + vigenciaMeses);
  }
  const finalContrato = vigenciaMeses > 0 ? fechaFinal.toISOString().split('T')[0] : null;

  const created: any = { contrato, titular: null, beneficiarios: [] };

  // 1. Create TITULAR in PEOPLE
  const titularId = ids.person();
  const titularResult = await query(
    `INSERT INTO "PEOPLE" ("_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
      "email", "celular", "telefono", "fechaNacimiento", "domicilio", "ciudad",
      "plataforma", "ingresos", "empresa", "cargo", "genero",
      "referenciaUno", "parentezcoRefUno", "telefonoRefUno", "referenciaDos", "parentezcoRefDos", "telefonoRefDos",
      "asesor", "asesorCreadorContrato", "tipoUsuario", "contrato", "vigencia", "fechaContrato", "finalContrato", "plan", "sence", "origen", "_createdDate", "_updatedDate")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$29,'TITULAR',$25,$26,NOW(),$27::date,$28,$30,'POSTGRES',NOW(),NOW()) RETURNING *`,
    [titularId, titular.numeroId, titular.primerNombre, titular.segundoNombre || null,
     titular.primerApellido, titular.segundoApellido || null,
     titular.email || null, titular.celular || null, titular.telefono || null,
     titular.fechaNacimiento || null, titular.domicilio || null, titular.ciudad || null,
     titular.plataforma || null, titular.ingresos || null, titular.empresa || null, titular.cargo || null, titular.genero || null,
     titular.referenciaUno || null, titular.parentezcoRefUno || null, titular.telRefUno || null,
     titular.referenciaDos || null, titular.parentezcoRefDos || null, titular.telRefDos || null,
     titular.asesor || null, contrato, financial?.vigencia || null, finalContrato, tipoPlan,
     titular.asesorCreadorContrato || null, senceVal]  // $29 → asesorCreadorContrato, $30 → sence
  );
  created.titular = titularResult.rows[0];

  // 2. Build beneficiarios list (include titular if titularEsBeneficiario)
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
      sence: senceVal, // el titular-beneficiario hereda la marca SENCE
    });
  }

  if (beneficiarios?.length) {
    allBeneficiarios.push(...beneficiarios);
  }

  // 3. Create each BENEFICIARIO in PEOPLE (sin nivel/step — se asigna manualmente después)
  for (const b of allBeneficiarios) {
    const benefId = ids.person();
    const benefResult = await query(
      `INSERT INTO "PEOPLE" ("_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "email", "celular", "fechaNacimiento", "titularId",
        "tipoUsuario", "contrato", "plataforma", "estadoInactivo",
        "vigencia", "fechaContrato", "finalContrato", "sence", "origen", "_createdDate", "_updatedDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'BENEFICIARIO',$11,$12,false,$13,NOW(),$14::date,$15,'POSTGRES',NOW(),NOW()) RETURNING *`,
      [benefId, b.numeroId, b.primerNombre, b.segundoNombre || null,
       b.primerApellido, b.segundoApellido || null,
       b.email || null, b.celular || null, b.fechaNacimiento || null, titularId,
       contrato, titular.plataforma || null, financial?.vigencia || null, finalContrato, b.sence === true]
    );
    created.beneficiarios.push(benefResult.rows[0]);
  }

  // 4. Create FINANCIERO if financial data present
  if (financial && financial.totalPlan) {
    const finResult = await query(
      `INSERT INTO "FINANCIEROS" ("_id", "contrato", "totalPlan", "numeroCuotas", "valorCuota",
        "pagoInscripcion", "saldo", "fechaPago", "medioPago", "vigencia", "plan",
        "origen", "_createdDate", "_updatedDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'POSTGRES',NOW(),NOW()) RETURNING *`,
      [ids.financial(), contrato, financial.totalPlan || 0, financial.numeroCuotas || 0,
       financial.valorCuota || 0, financial.pagoInscripcion || 0, financial.saldo || 0,
       financial.fechaPago || null, financial.medioPago || null, financial.vigencia || null,
       tipoPlan]
    );
    created.financiero = finResult.rows[0];

    // 5. Crear registro inicial en PAGOS_TITULARES (cuota #0) — best effort.
    //    Cuota #0 representa el pago de inscripción realizado al firmar:
    //      - valorPagado = inscripción (la plata efectivamente recibida)
    //      - inscripcion = inscripción (etiqueta semántica, redundante con valorPagado)
    //      - validado    = false → nace PENDIENTE. Se valida en Recaudos →
    //                      "Inscripciones pendientes". Sólo al validarla cuenta
    //                      en el saldo (syncFinancieroSaldo suma validados).
    //      - validadoPor / fechaValidacion = null (se llenan al validar)
    //      - gestorRecaudo = USUARIOS_ROLES._id del comercial que crea el contrato
    //                       (titular.asesor email → _id; fallback session.user.email).
    //    Si falla NO rompe la creación del contrato (log y se continúa).
    try {
      const createdBy = (session.user as any)?.email || 'unknown';
      const totalPlanNum    = parseMoney(financial.totalPlan);
      const inscripcionNum  = parseMoney(financial.pagoInscripcion);
      const saldoNum        = parseMoney(financial.saldo);
      const valorCuotaNum   = parseMoney(financial.valorCuota);

      // Resolver _id del comercial (asesor) → fallback al email crudo si no se encuentra
      const comercialEmail = (titular.asesor || createdBy || '').trim().toLowerCase();
      let comercialId: string | null = null;
      if (comercialEmail) {
        const found = await query(
          `SELECT "_id" FROM "USUARIOS_ROLES" WHERE LOWER("email") = $1 LIMIT 1`,
          [comercialEmail]
        );
        comercialId = found.rows[0]?._id ?? comercialEmail; // _id si existe, sino email crudo
      }

      const cuotasTotalNum = parseInt(String(financial.numeroCuotas ?? 0), 10) || 0;

      // Fechas en TZ local del cliente (clientToday = YYYY-MM-DD enviado por
      // el navegador). Evita corrimiento UTC al guardar fechaPago/fechaValidacion.
      const fechaPagoCliente = (typeof clientToday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clientToday))
        ? clientToday
        : null;

      const pagoResult = await query(
        `INSERT INTO "PAGOS_TITULARES" (
           "_id", "idPeople", "numeroId", "gestorRecaudo", "plataforma",
           "fechaPago", "fechaVencimiento", "numCuota", "cuotasTotal", "vlrTotalProg",
           "valorCuota", "valorPagado", "inscripcion", "saldo", "descuento", "valorAplicado",
           "medioPago", "documentosAdjuntos",
           "validado", "fechaValidacion", "validadoPor",
           "createdBy", "tipoCartera", "plan", "_createdDate", "_updatedDate"
         ) VALUES (
           $1, $2, $3, $4, $5,
           COALESCE($15::date, CURRENT_DATE), $6::date, 0, $7, $8,
           $9, $10, $11, $12, 0, $10,
           $13, '[]'::jsonb,
           false, NULL, NULL,
           $14, 'normal', $16, NOW(), NOW()
         ) RETURNING "_id"`,
        [
          ids.payment(),
          titularId,
          titular.numeroId,
          comercialId,
          titular.plataforma || null,
          financial.fechaPago || null,
          cuotasTotalNum,
          totalPlanNum,
          valorCuotaNum,
          inscripcionNum, // valorPagado
          inscripcionNum, // inscripcion
          saldoNum,
          financial.medioPago || null,
          createdBy,
          fechaPagoCliente,
          tipoPlan, // $16
        ]
      );
      created.pagoInicial = pagoResult.rows[0];

      // 6. Sync FINANCIEROS.saldo desde los pagos VALIDADOS (Opción 2).
      //    Como cuota#0 acaba de nacer validada, esto recalcula saldo desde
      //    la fuente de verdad (PAGOS_TITULARES) en vez de confiar en el
      //    valor que escribió el form. Best-effort.
      await syncFinancieroSaldo(titularId);
    } catch (err: any) {
      console.warn(`[contracts] PAGOS_TITULARES cuota#0 falló para ${contrato}:`, err?.message || err);
    }
  }

  // 7. Propagar el comercial a EQUIPO_COMERCIAL (registro del equipo).
  //    correo = titular.asesor (EMAIL) · nombre = titular.asesorCreadorContrato
  //    · plataforma = titular.plataforma.
  //    Best-effort: si falla, el contrato ya está creado y no se rompe.
  await upsertEquipoComercial(titular, contrato);

  return successResponse({
    message: `Contrato ${contrato} creado exitosamente`,
    _id: titularId,
    contractNumber: contrato,
    data: { _id: titularId, contractNumber: contrato },
    summary: {
      contrato,
      titularCreated: true,
      beneficiariosCreated: created.beneficiarios.length,
    },
  });
});
