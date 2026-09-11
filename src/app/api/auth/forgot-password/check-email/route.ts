import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';

/**
 * POST /api/auth/forgot-password/check-email
 * Valida que el email exista en USUARIOS_ROLES (fuente de login de TODOS los
 * tipos de usuario) y resuelve el celular para el enmascarado.
 *
 * FUNCIONA PARA TODO TIPO DE USUARIO (estudiante, advisor, comercial,
 * administrativo, …): el celular se toma de ACADEMICA (estudiantes) →
 * USUARIOS_ROLES.celular → ADVISORS.telefono. Antes exigía un registro en
 * ACADEMICA, que solo tienen los estudiantes → el flujo estaba roto para el
 * resto (devolvía "Registro académico no encontrado").
 */
export const POST = handler(async (request) => {
  const { email } = await request.json();
  if (!email?.trim()) throw new ValidationError('El email es requerido');

  const normalizedEmail = email.trim().toLowerCase();

  // La cuenta de login vive en USUARIOS_ROLES (todos los roles). Resolvemos el
  // celular de la mejor fuente disponible (subqueries escalares para no
  // multiplicar filas si el estudiante tiene ACADEMICA duplicada).
  const user = await queryOne<{ _id: string; celular: string | null }>(
    `SELECT ur."_id",
            COALESCE(
              NULLIF(TRIM((SELECT a."celular" FROM "ACADEMICA" a
                            WHERE LOWER(a."email") = LOWER(ur."email")
                              AND TRIM(COALESCE(a."celular",'')) <> '' LIMIT 1)), ''),
              NULLIF(TRIM(ur."celular"), ''),
              NULLIF(TRIM((SELECT ad."telefono" FROM "ADVISORS" ad
                            WHERE LOWER(ad."email") = LOWER(ur."email")
                              AND TRIM(COALESCE(ad."telefono",'')) <> '' LIMIT 1)), '')
            ) AS celular
       FROM "USUARIOS_ROLES" ur
      WHERE LOWER(ur."email") = $1
      LIMIT 1`,
    [normalizedEmail]
  );
  if (!user) throw new NotFoundError('Usuario', normalizedEmail);

  // Mask phone: se muestran solo los ÚLTIMOS 3 dígitos (ayuda de memoria para el
  // usuario legítimo; cada dígito mostrado es un dígito regalado a un atacante).
  // No dan paso al paso 2, que exige el celular COMPLETO (mínimo 8 dígitos).
  const celular = user.celular || '';
  const maskedPhone = celular.length >= 3
    ? '••••••••' + celular.slice(-3)
    : celular ? '••••••••' : 'No registrado';

  return successResponse({ maskedPhone, hasPhone: !!celular });
});
