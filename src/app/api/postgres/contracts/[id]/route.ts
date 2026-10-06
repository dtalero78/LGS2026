import 'server-only';
import { handlerWithAuth, handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { queryOne, queryMany, parseJsonbFields } from '@/lib/postgres';
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors';
import { PeopleRepository } from '@/repositories/people.repository';
import { FinancialRepository } from '@/repositories/financial.repository';
import { getAsesorInfo } from '@/lib/asesor';
import { attachKidsInscripciones } from '@/lib/kids-inscripciones';

// Fields editable on PEOPLE records (titular & beneficiarios)
const PEOPLE_EDIT_FIELDS = [
  'primerNombre',
  'segundoNombre',
  'primerApellido',
  'segundoApellido',
  'numeroId',
  'fechaNacimiento',
  'plataforma',
  'domicilio',
  'ciudad',
  'celular',
  'telefono',
  'ingresos',
  'email',
  'empresa',
  'cargo',
  'genero',
  'tipoUsuario',
  'referenciaUno',
  'parentezcoRefUno',
  'telefonoRefUno',
  'referenciaDos',
  'parentezcoRefDos',
  'telefonoRefDos',
  'vigencia',
  'observacionesContrato',
  'medioPago',
  'asesor',
];

// Fields editable on FINANCIEROS records
const FINANCIAL_EDIT_FIELDS = [
  'totalPlan',
  'pagoInscripcion',
  'saldo',
  'numeroCuotas',
  'valorCuota',
  'formaPago',
  'fechaPago',
  'medioPago',
  'vigencia',
];

/**
 * GET /api/postgres/contracts/[id]
 *
 * Load full contract data for editing.
 * [id] = titular's _id in PEOPLE table.
 * Returns: titular, beneficiarios, financial data.
 *
 * Solo STAFF con sesión: devuelve el registro COMPLETO (comentarios internos,
 * documentación, financiero). La página pública del cliente (/contrato/[id]) NO
 * usa este endpoint — usa /api/consent/[id]/contract-data (campos públicos).
 */
export const GET = handlerWithStaffAuth(async (
  _request: Request,
  { params }: { params: Record<string, string> }
) => {
  const titularId = params.id;

  // 1. Load titular
  const titular = await queryOne(
    `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
    [titularId]
  );

  if (!titular) throw new NotFoundError('Titular', titularId);

  const parsedTitular = parseJsonbFields(titular, ['onHoldHistory', 'extensionHistory']);

  // 2. Load beneficiarios by same contrato
  let beneficiarios: any[] = [];
  if (parsedTitular.contrato) {
    beneficiarios = await queryMany(
      `SELECT * FROM "PEOPLE"
       WHERE "contrato" = $1 AND "tipoUsuario" = 'BENEFICIARIO'
       ORDER BY "primerNombre" ASC`,
      [parsedTitular.contrato]
    );
    // Adjunta el detalle de KIDS_INSCRIPCIONES a los beneficiarios kids (para la plantilla).
    await attachKidsInscripciones(parsedTitular.contrato, beneficiarios);
  }

  // 3. Load financial data
  let financial = null;
  if (parsedTitular.contrato) {
    financial = await FinancialRepository.findByContrato(parsedTitular.contrato);
  }

  // 4. Resolve asesor (ejecutivo comercial) info — used at end of consent block.
  const asesorInfo = await getAsesorInfo(parsedTitular.asesor, (parsedTitular as any).asesorCreadorContrato);

  return successResponse({
    titular: parsedTitular,
    beneficiarios,
    financial,
    asesorInfo,
  });
});

/**
 * PUT /api/postgres/contracts/[id]
 *
 * Update contract data: titular fields, beneficiarios fields, and financial data.
 * [id] = titular's _id in PEOPLE table.
 *
 * Body:
 * {
 *   titular?: { field: value, ... },
 *   beneficiarios?: [ { _id: "...", field: value, ... }, ... ],
 *   financial?: { field: value, ... }
 * }
 */
export const PUT = handlerWithStaffAuth(async (
  request: Request,
  { params }: { params: Record<string, string> },
  session
) => {
  const titularId = params.id;
  const body = await request.json();
  const { titular: titularChanges, beneficiarios: beneficiariosChanges, financial: financialChanges } = body;

  // Verify the titular exists
  const existingTitular = await queryOne(
    `SELECT "_id", "contrato", "aprobacion" FROM "PEOPLE" WHERE "_id" = $1`,
    [titularId]
  );
  if (!existingTitular) throw new NotFoundError('Titular', titularId);

  // Regla (2026-10-06): un contrato APROBADO solo lo modifica SUPER_ADMIN; el resto
  // del staff solo edita contratos sin aprobar. (Antes cualquier sesión editaba
  // incluso contratos firmados/aprobados.)
  const aprobado = String(existingTitular.aprobacion || '').toUpperCase().startsWith('APROBAD');
  const rol = String((session?.user as any)?.role || '').toUpperCase();
  if (aprobado && rol !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Este contrato ya está aprobado: solo un Super Administrador puede modificarlo.');
  }

  const results: any = { titular: null, beneficiarios: [], financial: null };

  // 1. Update titular
  if (titularChanges && Object.keys(titularChanges).length > 0) {
    const updated = await PeopleRepository.updateFields(titularId, titularChanges, PEOPLE_EDIT_FIELDS);
    results.titular = updated;
  }

  // 2. Update beneficiarios
  if (Array.isArray(beneficiariosChanges)) {
    for (const benChange of beneficiariosChanges) {
      const { _id, ...fields } = benChange;
      if (!_id) continue;

      // Verify this beneficiario belongs to the same contract
      const ben = await queryOne(
        `SELECT "_id", "contrato" FROM "PEOPLE" WHERE "_id" = $1 AND "contrato" = $2`,
        [_id, existingTitular.contrato]
      );
      if (!ben) {
        console.warn(`⚠️ Beneficiario ${_id} not found or does not belong to contract ${existingTitular.contrato}`);
        continue;
      }

      const updated = await PeopleRepository.updateFields(_id, fields, PEOPLE_EDIT_FIELDS);
      if (updated) results.beneficiarios.push(updated);
    }
  }

  // 3. Update financial data
  if (financialChanges && Object.keys(financialChanges).length > 0 && existingTitular.contrato) {
    const existingFinancial = await FinancialRepository.findByContrato(existingTitular.contrato);

    if (existingFinancial) {
      const updated = await FinancialRepository.updateFields(
        existingFinancial._id,
        financialChanges,
        FINANCIAL_EDIT_FIELDS
      );
      results.financial = updated;
    }
  }

  return successResponse({
    message: 'Contrato actualizado exitosamente',
    ...results,
  });
});
