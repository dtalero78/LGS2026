import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { queryOne } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/contracts/template?plataforma=Colombia
 *
 * Returns the contract template HTML/text for a given platform.
 */
export const GET = handler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const plataforma = searchParams.get('plataforma');

  if (!plataforma) {
    throw new ValidationError('plataforma query param is required');
  }

  // Try exact match first
  let row = await queryOne(
    `SELECT "template", "plataforma" FROM "ContractTemplates" WHERE "plataforma" = $1`,
    [plataforma]
  );

  // Case-insensitive fallback
  if (!row) {
    row = await queryOne(
      `SELECT "template", "plataforma" FROM "ContractTemplates" WHERE LOWER("plataforma") = LOWER($1)`,
      [plataforma]
    );
  }

  if (!row || !row.template) {
    throw new NotFoundError('ContractTemplate', plataforma);
  }

  return successResponse({
    template: row.template,
    plataforma: row.plataforma,
  });
});
