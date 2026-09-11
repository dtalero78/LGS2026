import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryOne } from '@/lib/postgres';

/**
 * GET /api/postgres/students/[id]/msg-counts
 *
 * Contadores de envío de mensajes del estudiante (guardados en ACADEMICA):
 *   welcome    → "Crea Perfil con Welcome"
 *   soloPerfil → "Crear solo perfil"
 *   reagendar  → "Reagendar Welcome"
 * El id de la ruta es el ACADEMICA._id.
 */
export const GET = handlerWithAuth(async (_req, { params }: { params: Record<string, string> }) => {
  const row = await queryOne<any>(
    `SELECT COALESCE("msgWelcomeCount", 0)    AS "welcome",
            COALESCE("msgSoloPerfilCount", 0) AS "soloPerfil",
            COALESCE("msgReagendarCount", 0)  AS "reagendar"
       FROM "ACADEMICA" WHERE "_id" = $1`,
    [params.id]
  );
  return successResponse({
    welcome: Number(row?.welcome ?? 0),
    soloPerfil: Number(row?.soloPerfil ?? 0),
    reagendar: Number(row?.reagendar ?? 0),
  });
});
