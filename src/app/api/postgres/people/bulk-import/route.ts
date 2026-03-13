import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { query } from '@/lib/postgres';
import { ids } from '@/lib/id-generator';

const ALLOWED_FIELDS = [
  'numeroId', 'primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido',
  'tipoUsuario', 'email', 'celular', 'pais', 'ciudad', 'direccion',
  'contrato', 'plataforma', 'nivel', 'step',
  'fechaNacimiento', 'inicioContrato', 'finalContrato',
];

export const POST = handlerWithAuth(async (request) => {
  const body = await request.json();
  const registros = body.registros;

  if (!Array.isArray(registros) || registros.length === 0) {
    throw new ValidationError('No hay registros para importar');
  }

  if (registros.length > 5000) {
    throw new ValidationError('Máximo 5000 registros por lote');
  }

  let exitosos = 0;
  let fallidos = 0;
  const errores: string[] = [];

  for (const reg of registros) {
    try {
      if (!reg.numeroId || !reg.primerNombre || !reg.primerApellido) {
        errores.push(`Fila ${reg.fila || '?'}: Faltan campos obligatorios (numeroId, primerNombre, primerApellido)`);
        fallidos++;
        continue;
      }

      const _id = ids.person();
      const fields: string[] = ['"_id"', '"fechaCreacion"', '"_createdDate"', '"_updatedDate"'];
      const placeholders: string[] = ['$1', 'NOW()', 'NOW()', 'NOW()'];
      const values: any[] = [_id];
      let paramIdx = 2;

      for (const field of ALLOWED_FIELDS) {
        const val = reg[field];
        if (val !== undefined && val !== null && val !== '') {
          fields.push(`"${field}"`);
          placeholders.push(`$${paramIdx}`);
          values.push(val);
          paramIdx++;
        }
      }

      // UPSERT: if numeroId + tipoUsuario already exists, update
      const tipoUsuario = reg.tipoUsuario || 'BENEFICIARIO';
      const updateClauses = ALLOWED_FIELDS
        .filter(f => f !== 'numeroId')
        .map(f => `"${f}" = COALESCE(EXCLUDED."${f}", "${f}")`)
        .join(', ');

      await query(
        `INSERT INTO "PEOPLE" (${fields.join(', ')})
         VALUES (${placeholders.join(', ')})
         ON CONFLICT ("numeroId", "tipoUsuario")
         DO UPDATE SET ${updateClauses}, "_updatedDate" = NOW()`,
        values
      );

      exitosos++;
    } catch (err: any) {
      errores.push(`Fila ${reg.fila || '?'}: ${err.message}`);
      fallidos++;
    }
  }

  return successResponse({
    exitosos,
    fallidos,
    total: registros.length,
    errores,
  });
});
