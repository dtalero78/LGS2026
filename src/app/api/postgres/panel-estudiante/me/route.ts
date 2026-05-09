import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { queryOne } from '@/lib/postgres';

export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);

  // Fetch perfilActualizado from USUARIOS_ROLES to drive the "Actualizar" button in Perfil modal
  const email = session.user?.email;
  const urRow = email
    ? await queryOne<{ perfilActualizado: string | null }>(
        `SELECT "perfilActualizado" FROM "USUARIOS_ROLES" WHERE LOWER("email") = LOWER($1) LIMIT 1`,
        [email]
      ).catch(() => null)
    : null;

  return successResponse({
    profile: {
      ...student,
      perfilActualizado: urRow?.perfilActualizado ?? null,
    },
  });
});
