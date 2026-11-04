import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { subirFactura, advisorDeSesion } from '@/services/liq-flujo.service';

/**
 * POST /api/postgres/panel-advisor/mis-horas/factura  (multipart: file, programa, periodo, corte)
 * El advisor de la SESIÓN sube su factura/boleta del corte (hasta el plazo; tras una
 * devolución, 2 días más). Una vez verificada no se reemplaza. No devuelve lo leído por IA.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  const u = (session?.user as any) || {};
  const adv = await advisorDeSesion(u.email || '');
  if (!adv) throw new NotFoundError('Ficha de advisor de su usuario', u.email || '');
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new ValidationError('Adjunte el archivo de la factura.');
  const { id } = await subirFactura({
    advisorId: adv._id, programa: form.get('programa') === 'KIDS' ? 'KIDS' : 'LGS',
    periodo: String(form.get('periodo') || ''), corte: String(form.get('corte') || '') as any,
    archivo: { buf: Buffer.from(await file.arrayBuffer()), tipo: file.type, nombre: file.name || 'factura' },
  }, { email: u.email, nombre: u.name || null, rol: u.role || '' }, { esAdvisor: true });
  return successResponse({ id });
});
