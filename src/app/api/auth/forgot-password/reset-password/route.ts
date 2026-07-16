import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { query, queryOne } from '@/lib/postgres';
import { verifyResetToken } from '@/lib/reset-token';

/**
 * POST /api/auth/forgot-password/reset-password
 * Saves the new password in plain text in USUARIOS_ROLES and ACADEMICA.
 *
 * EXIGE el `resetToken` que emite /verify-otp tras validar el OTP. Antes no
 * pedía ninguna prueba: los 4 pasos se encadenaban solo en el frontend, así que
 * con solo el email se podía cambiar la contraseña de CUALQUIER cuenta llamando
 * directo a este endpoint.
 */
export const POST = handler(async (request) => {
  const { email, password, confirmPassword, resetToken } = await request.json();

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

  // ── Prueba de que el OTP fue verificado (paso 3) ──
  // Sin esto, cualquiera con un email podía cambiar la contraseña saltándose
  // los pasos 1-3. El token está firmado y atado a ESTE email.
  if (!verifyResetToken(normalizedEmail, resetToken)) {
    throw new ForbiddenError(
      'Verificación inválida o expirada. Reinicia el proceso de recuperación de contraseña.',
    );
  }

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
