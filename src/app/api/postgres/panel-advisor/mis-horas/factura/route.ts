import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { subirFactura, quitarFactura, advisorDeSesion } from '@/services/liq-flujo.service';

/**
 * POST /api/postgres/panel-advisor/mis-horas/factura  (multipart: file, programa, periodo, corte,
 *      concepto?, modo? = 'agregar' | 'reemplazar', reemplazaId?)
 * El advisor de la SESIÓN sube su factura/boleta del corte (hasta el plazo; tras una
 * devolución, 2 días más). Un corte admite varias facturas ('agregar', p. ej. horas normales
 * + Exam. Intern.); se revisan sumadas. Una vez verificado no se reemplaza. No devuelve lo leído por IA.
 * DELETE ?id= — quita una factura recibida propia (subida por error).
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  const u = (session?.user as any) || {};
  const adv = await advisorDeSesion(u.email || '');
  if (!adv) throw new NotFoundError('Ficha de advisor de su usuario', u.email || '');
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new ValidationError('Adjunte el archivo de la factura.');
  if (form.get('programa') === 'KIDS') throw new ValidationError('La factura de Kids se sube en la plataforma KIDS (Mis horas y facturas).');
  const { id } = await subirFactura({
    advisorId: adv._id, programa: 'LGS',
    periodo: String(form.get('periodo') || ''), corte: String(form.get('corte') || '') as any,
    archivo: { buf: Buffer.from(await file.arrayBuffer()), tipo: file.type, nombre: file.name || 'factura' },
    concepto: String(form.get('concepto') || '') || null,
    modo: form.get('modo') === 'agregar' ? 'agregar' : 'reemplazar',
    reemplazaId: String(form.get('reemplazaId') || '') || null,
  }, { email: u.email, nombre: u.name || null, rol: u.role || '' }, { esAdvisor: true });
  return successResponse({ id });
});

export const DELETE = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  const u = (session?.user as any) || {};
  const adv = await advisorDeSesion(u.email || '');
  if (!adv) throw new NotFoundError('Ficha de advisor de su usuario', u.email || '');
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) throw new ValidationError('id es obligatorio');
  await quitarFactura(id, { email: u.email, nombre: u.name || null, rol: u.role || '' }, { advisorId: adv._id });
  return successResponse({ id });
});
