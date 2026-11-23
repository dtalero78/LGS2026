import 'server-only'
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { MantenimientoPermission } from '@/types/permissions'
import { inscritosDeEvento } from '@/services/mensajes-evento.service'

/** GET …/eventos/[id]/inscritos — inscritos no cancelados del evento, con celular y estado. */
export const GET = handlerWithStaffAuth(async (_req, ctx, session) => {
  await requirePermission(session, MantenimientoPermission.ENVIO_MENSAJES)
  return successResponse(await inscritosDeEvento(ctx.params.id))
})
