import 'server-only'
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { MantenimientoPermission } from '@/types/permissions'
import { ValidationError } from '@/lib/errors'
import { listarEventos } from '@/services/mensajes-evento.service'

/** GET /api/admin/envio-mensajes/eventos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&tipo][&advisor][&nivel] — máx. 31 días. */
export const GET = handlerWithStaffAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.ENVIO_MENSAJES)
  const sp = new URL(req.url).searchParams
  const desde = sp.get('desde') || ''
  const hasta = sp.get('hasta') || desde
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) throw new ValidationError('Fechas inválidas (YYYY-MM-DD)')
  const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000
  if (dias < 0) throw new ValidationError('La fecha final es anterior a la inicial')
  if (dias > 31) throw new ValidationError('El rango máximo es de 31 días')
  const eventos = await listarEventos({ desde, hasta, tipo: sp.get('tipo'), advisor: sp.get('advisor'), nivel: sp.get('nivel') })
  return successResponse({ eventos })
})
