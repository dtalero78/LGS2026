import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission } from '@/lib/api-permissions';
import { ValidationError } from '@/lib/errors';
import { AdministracionPermission } from '@/types/permissions';
import { subirFactura } from '@/services/liq-flujo.service';

/**
 * POST /api/postgres/administracion/cortes/factura  (multipart: file, advisorId, programa, periodo, corte)
 * Administración sube la factura EN NOMBRE de un advisor LGS (las de Kids llegan desde KIDS).
 * Gate: FACTURA_DEVOLVER o VERIFICAR.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requireAnyPermission(session, [AdministracionPermission.FACTURA_DEVOLVER, AdministracionPermission.VERIFICAR]);
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new ValidationError('Adjunte el archivo de la factura.');
  // Guías Kids: la sube la guía en KIDS y llega sola (lib/kids-facturas-guias).
  if (form.get('programa') === 'KIDS') throw new ValidationError('La factura de Kids la sube la guía en la plataforma KIDS.');
  const u = (session?.user as any) || {};
  const res = await subirFactura({
    advisorId: String(form.get('advisorId') || ''), programa: form.get('programa') === 'KIDS' ? 'KIDS' : 'LGS',
    periodo: String(form.get('periodo') || ''), corte: String(form.get('corte') || '') as any,
    archivo: { buf: Buffer.from(await file.arrayBuffer()), tipo: file.type, nombre: file.name || 'factura' },
  }, { email: u.email || 'desconocido', nombre: u.name || null, rol: u.role || '' }, { esAdvisor: false });
  return successResponse(res);
});
