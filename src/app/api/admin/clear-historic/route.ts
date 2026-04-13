import 'server-only'
import { handlerWithAuth } from '@/lib/api-helpers'
import { ForbiddenError, ValidationError } from '@/lib/errors'

// Bulk operations removed — use /lookup and /student sub-routes instead
export const DELETE = handlerWithAuth(async (req, _ctx, session) => {
  if ((session.user as any)?.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Solo SUPER_ADMIN puede ejecutar operaciones de limpieza')
  }
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  throw new ValidationError(`Tipo de operación no reconocido: ${type}`)
})
