import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { exigirClaveKids } from '@/lib/kids-sync-server';
import { cortesDeGuia } from '@/lib/kids-facturas-guias';

/**
 * GET /api/kids-sync/liquidacion-guia?kidsUserId=&periodo=AAAA-MM — cortes Kids de una
 * guía para su pantalla "Mis horas y facturas" en KIDS: horas, estado, plazo y factura.
 * Sin valores ($). La identidad la pone KIDS (de la sesión de la guía), con clave de servicio.
 */
export const GET = handler(async (request) => {
  exigirClaveKids(request);
  const sp = new URL(request.url).searchParams;
  const kidsUserId = String(sp.get('kidsUserId') || '').trim();
  const periodo = String(sp.get('periodo') || '').trim();
  if (!kidsUserId) throw new ValidationError('kidsUserId es obligatorio');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) throw new ValidationError('periodo debe ser AAAA-MM');
  return successResponse(await cortesDeGuia(kidsUserId, periodo));
});
