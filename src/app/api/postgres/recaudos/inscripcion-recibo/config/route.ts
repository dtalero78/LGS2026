import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission } from '@/lib/api-permissions';
import { PersonPermission, Role } from '@/types/permissions';
import { isLeerReciboActivo } from '@/services/recibo-extract.service';

/**
 * GET /api/postgres/recaudos/inscripcion-recibo/config
 * Indica si la UI debe mostrar el botón "Leer recibo": activo si el flag está
 * ON, o si el usuario es SUPER_ADMIN/ADMIN (bypass para probar).
 */
export const GET = handlerWithAuth(async (_req: NextRequest, _ctx, session) => {
  await requireAnyPermission(session, [PersonPermission.PAGOS_VALIDAR, PersonPermission.PAGOS_REGISTRAR]);
  const role = ((session?.user as any)?.role ?? '') as string;
  const isAdmin = role === Role.SUPER_ADMIN || role === Role.ADMIN || role === 'admin';
  const active = (await isLeerReciboActivo()) || isAdmin;
  return successResponse({ active });
});
