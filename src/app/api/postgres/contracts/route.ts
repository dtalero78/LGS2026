import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { ValidationError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

export const POST = handlerWithAuth(async (request) => {
  const { contrato, titular, beneficiarios, financiero } = await request.json();

  if (!contrato) throw new ValidationError('contrato is required');
  if (!titular?.numeroId || !titular?.primerNombre || !titular?.primerApellido) {
    throw new ValidationError('titular with numeroId, primerNombre, and primerApellido is required');
  }
  if (!beneficiarios?.length) throw new ValidationError('At least one beneficiario is required');

  // Check duplicates
  const existingContract = await query(`SELECT "contrato" FROM "PEOPLE" WHERE "contrato" = $1 LIMIT 1`, [contrato]);
  if (existingContract.rowCount > 0) throw new ConflictError(`Contract ${contrato} already exists`);

  const existingTitular = await query(`SELECT "numeroId" FROM "PEOPLE" WHERE "numeroId" = $1`, [titular.numeroId]);
  if (existingTitular.rowCount > 0) throw new ConflictError(`Titular with numeroId ${titular.numeroId} already exists`);

  for (const b of beneficiarios) {
    const exists = await query(`SELECT "numeroId" FROM "PEOPLE" WHERE "numeroId" = $1`, [b.numeroId]);
    if (exists.rowCount > 0) throw new ConflictError(`Beneficiario with numeroId ${b.numeroId} already exists`);
  }

  const created: any = { contrato, titular: null, beneficiarios: [], academica: [], financiero: null };

  // 1. Create TITULAR
  const titularResult = await query(
    `INSERT INTO "PEOPLE" ("_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
      "email", "celular", "fechaNacimiento", "direccion", "ciudad", "pais", "codigoPais",
      "tipoUsuario", "contrato", "vigencia", "finalContrato", "inicioCurso", "observaciones", "origen", "_createdDate", "_updatedDate")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'TITULAR',$14,$15,$16,$17,$18,'POSTGRES',NOW(),NOW()) RETURNING *`,
    [ids.person(), titular.numeroId, titular.primerNombre, titular.segundoNombre||null, titular.primerApellido,
     titular.segundoApellido||null, titular.email||null, titular.celular||null, titular.fechaNacimiento||null,
     titular.direccion||null, titular.ciudad||null, titular.pais||null, titular.codigoPais||null,
     contrato, titular.vigencia||null, titular.finalContrato||null, titular.inicioCurso||null, titular.observaciones||null]
  );
  created.titular = titularResult.rows[0];

  // 2. Create BENEFICIARIOS + ACADEMICA
  for (const b of beneficiarios) {
    const benefResult = await query(
      `INSERT INTO "PEOPLE" ("_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "email", "celular", "fechaNacimiento", "direccion", "ciudad", "pais", "codigoPais",
        "tipoUsuario", "contrato", "nivel", "step", "nivelParalelo", "stepParalelo",
        "plataforma", "vigencia", "finalContrato", "inicioCurso", "estadoInactivo", "observaciones", "origen", "_createdDate", "_updatedDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'BENEFICIARIO',$14,$15,$16,$17,$18,$19,$20,$21,$22,false,$23,'POSTGRES',NOW(),NOW()) RETURNING *`,
      [ids.person(), b.numeroId, b.primerNombre, b.segundoNombre||null, b.primerApellido, b.segundoApellido||null,
       b.email||null, b.celular||null, b.fechaNacimiento||null, b.direccion||null, b.ciudad||null, b.pais||null,
       b.codigoPais||null, contrato, b.nivel||'WELCOME', b.step||'WELCOME', b.nivelParalelo||null, b.stepParalelo||null,
       b.plataforma||'ZOOM', titular.vigencia||null, titular.finalContrato||null, titular.inicioCurso||null, b.observaciones||null]
    );
    created.beneficiarios.push(benefResult.rows[0]);

    const academicaResult = await query(
      `INSERT INTO "ACADEMICA" ("_id", "numeroId", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "email", "celular", "nivel", "step", "plataforma", "origen", "_createdDate", "_updatedDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'POSTGRES',NOW(),NOW()) RETURNING *`,
      [ids.academic(), b.numeroId, b.primerNombre, b.segundoNombre||null, b.primerApellido, b.segundoApellido||null,
       b.email||null, b.celular||null, b.nivel||'WELCOME', b.step||'WELCOME', b.plataforma||'ZOOM']
    );
    created.academica.push(academicaResult.rows[0]);
  }

  // 3. Create FINANCIERO
  if (financiero) {
    const finResult = await query(
      `INSERT INTO "FINANCIEROS" ("_id", "contrato", "valorTotal", "modalidad", "cuotas", "valorCuota",
        "fechaPago", "proximoPago", "metodoPago", "estadoPago", "saldoPendiente",
        "observaciones", "descuento", "valorDescuento", "valorFinal", "origen", "_createdDate", "_updatedDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'POSTGRES',NOW(),NOW()) RETURNING *`,
      [ids.financial(), contrato, financiero.valorTotal||0, financiero.modalidad||'MENSUAL', financiero.cuotas||null,
       financiero.valorCuota||null, financiero.fechaPago||null, financiero.proximoPago||null, financiero.metodoPago||null,
       financiero.estadoPago||'PENDIENTE', financiero.saldoPendiente||financiero.valorTotal||0,
       financiero.observaciones||null, financiero.descuento||null, financiero.valorDescuento||null,
       financiero.valorFinal||financiero.valorTotal||0]
    );
    created.financiero = finResult.rows[0];
  }

  return successResponse({
    message: `Contract ${contrato} created successfully`,
    contract: created,
    summary: { contrato, titularCreated: true, beneficiariosCreated: created.beneficiarios.length,
               academicaRecordsCreated: created.academica.length, financieroCreated: !!created.financiero },
  });
});
