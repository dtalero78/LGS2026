import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { queryMany, queryOne } from '@/lib/postgres';

/**
 * GET /api/postgres/filiales?plataforma=Chile&asesor=correo@x.com
 * Para Crear Contrato (paso 2): filiales ACTIVAS del país del contrato y la filial
 * registrada del asesor (EQUIPO_COMERCIAL.filial por su correo), si tiene.
 * Solo lectura; el catálogo se administra en Mantenimiento › Filiales.
 * Gate: staff.
 */
export const GET = handlerWithStaffAuth(async (req: NextRequest) => {
  const sp = new URL(req.url).searchParams;
  const plataforma = (sp.get('plataforma') || '').trim();
  const asesor = (sp.get('asesor') || '').trim().toLowerCase();

  const filiales = plataforma
    ? (await queryMany<{ nombre: string }>(
        `SELECT "nombre" FROM "FILIALES"
          WHERE "activo" = true AND LOWER(TRIM("plataforma")) = LOWER(TRIM($1))
          ORDER BY "nombre"`, [plataforma])).map((f) => f.nombre)
    : [];
  const eq = asesor
    ? await queryOne<{ filial: string | null; plataforma: string | null }>(
        `SELECT "filial", "plataforma" FROM "EQUIPO_COMERCIAL"
          WHERE LOWER(TRIM("correo")) = $1 AND COALESCE(TRIM("filial"),'') <> '' LIMIT 1`, [asesor])
    : null;

  return successResponse({
    filiales,
    filialAsesor: eq?.filial?.trim() || null,
  });
});
