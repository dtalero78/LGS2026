import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { query, queryOne } from '@/lib/postgres';

/**
 * POST /api/auth/forgot-password/reset-password
 * Saves the new password in plain text in USUARIOS_ROLES and ACADEMICA.
 */
export const POST = handler(async (request) => {
  const { email, password, confirmPassword } = await request.json();

  if (!email?.trim())           throw new ValidationError('Email requerido');
  if (!password?.trim())        throw new ValidationError('La nueva contraseña es requerida');
  if (!confirmPassword?.trim()) throw new ValidationError('Confirmar contraseña es requerido');
  if (password !== confirmPassword)
    throw new ValidationError('Las contraseñas no coinciden');
  if (/\s/.test(password))
    throw new ValidationError('La contraseña no puede contener espacios');
  if (password.length < 6 || password.length > 10)
    throw new ValidationError('La contraseña debe tener entre 6 y 10 caracteres');

  const normalizedEmail = email.trim().toLowerCase();

  // Verify user exists
  const userRole = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "USUARIOS_ROLES" WHERE LOWER("email") = $1 LIMIT 1`,
    [normalizedEmail]
  );
  if (!userRole) throw new NotFoundError('Usuario', normalizedEmail);

  // Update password in USUARIOS_ROLES (plain text — system supports both)
  await query(
    `UPDATE "USUARIOS_ROLES" SET "password" = $1, "_updatedDate" = NOW() WHERE LOWER("email") = $2`,
    [password.trim(), normalizedEmail]
  );

  // Update clave in ACADEMICA
  await query(
    `UPDATE "ACADEMICA" SET "clave" = $1, "_updatedDate" = NOW() WHERE LOWER("email") = $2`,
    [password.trim(), normalizedEmail]
  ).catch(() => {}); // non-blocking if ACADEMICA email not set

  return successResponse({ message: 'Contraseña actualizada exitosamente' });
});
