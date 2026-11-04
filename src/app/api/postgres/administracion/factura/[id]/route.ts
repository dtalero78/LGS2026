import { NextRequest, NextResponse } from 'next/server';
import { handlerWithAuth } from '@/lib/api-helpers';
import { hasPermission } from '@/lib/api-permissions';
import { ForbiddenError } from '@/lib/errors';
import { AdministracionPermission } from '@/types/permissions';
import { urlFactura, advisorDeSesion } from '@/services/liq-flujo.service';

/**
 * GET /api/postgres/administracion/factura/[id] → redirige a una URL firmada (10 min) del archivo.
 * Acceso: personal con GESTION_ADVISORS.VER, o el propio advisor dueño de la factura.
 */
export const GET = handlerWithAuth(async (_req: NextRequest, ctx, session) => {
  const { url, advisorId } = await urlFactura(ctx.params.id);
  const role = (session?.user as any)?.role;
  const esStaff = role !== 'ESTUDIANTE' && await hasPermission(session, AdministracionPermission.GESTION_ADVISORS_VER);
  if (!esStaff) {
    const propio = await advisorDeSesion((session?.user as any)?.email || '');
    if (!propio || propio._id !== advisorId) throw new ForbiddenError('No puede ver esta factura.');
  }
  return NextResponse.redirect(url);
});
