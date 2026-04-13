import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { queryMany } from '@/lib/postgres'
import { ForbiddenError, ValidationError } from '@/lib/errors'

export const DELETE = handlerWithAuth(async (req, session) => {
  if (session.user.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Solo SUPER_ADMIN puede ejecutar operaciones de limpieza')
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (type === 'bookings_cancelled') {
    const deleted = await queryMany<{ count: string }>(
      `WITH del AS (
        DELETE FROM "ACADEMICA_BOOKINGS"
        WHERE "cancelo" = true
        RETURNING 1
      ) SELECT COUNT(*)::text AS count FROM del`
    )
    const count = deleted[0]?.count ?? '0'
    return successResponse({ message: `Se eliminaron ${count} bookings cancelados` })
  }

  if (type === 'otp_expired') {
    // El OTP store es in-memory, no hay tabla. Solo confirmar que no hay acción en DB.
    return successResponse({ message: 'OTP store limpiado (in-memory, se limpia automáticamente al expirar)' })
  }

  throw new ValidationError(`Tipo de operación no reconocido: ${type}`)
})
