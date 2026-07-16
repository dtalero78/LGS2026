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
  // Se muestran solo los ÚLTIMOS 3 dígitos (antes eran 4). Es una ayuda de
  // memoria para el usuario legítimo: cada dígito mostrado es un dígito que se
  // le regala a un atacante. No dan paso al paso 2, que exige el celular
  // COMPLETO (mínimo 8 dígitos) — antes bastaba con los últimos 4, justo los
  // que esta misma respuesta revelaba.
  const celular = academica.celular || '';
  const maskedPhone = celular.length >= 3
    ? '••••••••' + celular.slice(-3)
    : celular ? '••••••••' : 'No registrado';

  return successResponse({ maskedPhone, hasPhone: !!celular });
});
