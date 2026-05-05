import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';

/**
 * POST /api/auth/forgot-password/check-email
 * Validates that the email exists in both ACADEMICA and USUARIOS_ROLES.
 * Returns masked phone for display.
 */
export const POST = handler(async (request) => {
  const { email } = await request.json();
  if (!email?.trim()) throw new ValidationError('El email es requerido');

  const normalizedEmail = email.trim().toLowerCase();

  // Check USUARIOS_ROLES
  const userRole = await queryOne<{ _id: string; activo: boolean }>(
    `SELECT "_id", "activo" FROM "USUARIOS_ROLES" WHERE LOWER("email") = $1 LIMIT 1`,
    [normalizedEmail]
  );
  if (!userRole) throw new NotFoundError('Usuario', normalizedEmail);

  // Check ACADEMICA + get celular for masked display
  const academica = await queryOne<{ _id: string; celular: string | null; numeroId: string | null }>(
    `SELECT "_id", "celular", "numeroId" FROM "ACADEMICA" WHERE LOWER("email") = $1 LIMIT 1`,
    [normalizedEmail]
  );
  if (!academica) throw new NotFoundError('Registro académico', normalizedEmail);

  // Mask phone: show only last 4 digits
  const celular = academica.celular || '';
  const maskedPhone = celular.length >= 4
    ? '********' + celular.slice(-4)
    : celular ? '********' : 'No registrado';

  return successResponse({ maskedPhone, hasPhone: !!celular });
});
