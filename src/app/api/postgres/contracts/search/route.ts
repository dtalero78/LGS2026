import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';
import { ValidationError } from '@/lib/errors';

export const GET = handlerWithAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const pattern = searchParams.get('pattern');
  const exact = searchParams.get('exact') === 'true';

  if (!pattern) throw new ValidationError('pattern query parameter is required');

  const result = await query(
    exact
      ? `SELECT * FROM "PEOPLE" WHERE "contrato" = $1 ORDER BY "tipoUsuario" DESC, "primerApellido", "primerNombre"`
      : `SELECT * FROM "PEOPLE" WHERE "contrato" LIKE $1 ORDER BY "tipoUsuario" DESC, "primerApellido", "primerNombre"`,
    [exact ? pattern : `${pattern}%`]
  );

  // Group by contract
  const byContract: Record<string, any> = {};
  for (const person of result.rows) {
    const c = person.contrato;
    if (!c) continue;
    if (!byContract[c]) byContract[c] = { contrato: c, titular: null, beneficiarios: [] };
    if (person.tipoUsuario === 'TITULAR') byContract[c].titular = person;
    else if (person.tipoUsuario === 'BENEFICIARIO') byContract[c].beneficiarios.push(person);
  }

  const contracts = Object.values(byContract);
  return successResponse({ pattern, exact, contracts, totalContracts: contracts.length, totalPeople: result.rowCount || 0 });
});
