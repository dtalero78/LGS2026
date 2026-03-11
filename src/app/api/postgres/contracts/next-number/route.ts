import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { ValidationError } from '@/lib/errors';

const CODIGOS_PAIS: Record<string, string> = {
  'Chile': '01',
  'Colombia': '02',
  'Ecuador': '03',
  'Perú': '04',
};

export const GET = handler(async (request) => {
  const { searchParams } = new URL(request.url);
  const plataforma = searchParams.get('plataforma');

  if (!plataforma) throw new ValidationError('plataforma is required');

  const codigoPais = CODIGOS_PAIS[plataforma];
  if (!codigoPais) throw new ValidationError(`País no válido: ${plataforma}. Válidos: ${Object.keys(CODIGOS_PAIS).join(', ')}`);

  const anoActual = new Date().getFullYear().toString().slice(-2);
  const patron = `${codigoPais}-%-${anoActual}`;

  const result = await query(
    `SELECT MAX(CAST(SPLIT_PART("contrato", '-', 2) AS INTEGER)) AS max_num
     FROM "PEOPLE"
     WHERE "contrato" LIKE $1
       AND SPLIT_PART("contrato", '-', 2) ~ '^[0-9]+$'`,
    [patron]
  );

  const maxNumero = result.rows[0]?.max_num || 9999;
  const siguiente = (maxNumero + 1).toString().padStart(5, '0');
  const contrato = `${codigoPais}-${siguiente}-${anoActual}`;

  return successResponse({ contrato, codigoPais, siguiente, ano: anoActual });
});
