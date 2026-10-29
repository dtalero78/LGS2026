import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { withTransaction } from '@/lib/postgres'
import { ValidationError } from '@/lib/errors'
import { MantenimientoPermission } from '@/types/permissions'
import { categoriaDe, whereCategoria, tipoPurgaDe } from '@/lib/limpieza-anulados'
import { purgarContrato } from '@/lib/purgar-contrato'

/**
 * POST /api/admin/limpieza-anulados/purge
 *   body: { contratos: string[], motivo: string }
 *
 * Borra definitivamente contratos ANULADOS. Cada contrato = una transacción.
 *
 * ⚠️ A DIFERENCIA del borrado de Contratos Prueba / Centro de Aprobaciones, aquí
 * NO se borra en cascada por numeroId/email a ciegas: un contrato anulado casi
 * siempre es de alguien que tiene OTRO contrato vivo (se anuló justamente porque
 * se creó uno nuevo). Por eso:
 *   - ACADEMICA (+ clases, overrides, complementarias): solo de los documentos que
 *     NO aparecen en ningún otro contrato. Si aparecen, se CONSERVAN.
 *   - USUARIOS_ROLES: solo logins de rol ESTUDIANTE cuyo correo NO aparece en otro
 *     contrato. Nunca cuentas de staff.
 *   - PAGOS_TITULARES: solo por idPeople de las filas del contrato (nunca por
 *     numeroId). Si hay algún pago VALIDADO, el contrato se OMITE — salvo que
 *     llegue `incluirPagosValidados: true` (casilla + segunda confirmación en la
 *     página). Esos pagos quedan en el snapshot de PURGE_LOG.
 *   - FINANCIEROS / KIDS_INSCRIPCIONES / PEOPLE: por número de contrato.
 * Antes de borrar se guarda copia completa en PURGE_LOG (tipoPurga
 * LIMPIEZA_ANULADOS), consultable en el Histórico de la página.
 */

type Status = 'ok' | 'error' | 'sin_titular' | 'no_anulado' | 'con_pagos_validados'
interface ResultItem {
  contrato: string
  status: Status
  error?: string
  borrados?: Record<string, number>
  conservados?: { documentos: string[]; correos: string[] }
}

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.LIMPIEZA_ANULADOS)

  const body = await request.json().catch(() => ({}))
  const contratos: string[] = Array.isArray(body?.contratos) ? body.contratos.filter((c: any) => typeof c === 'string' && c.trim()) : []
  const motivo = String(body?.motivo || '').trim()
  // Borrar contratos con pagos VALIDADOS exige confirmación explícita (casilla en
  // la página + segunda confirmación en el modal). Sin ella se omiten.
  const incluirPagosValidados = body?.incluirPagosValidados === true
  // Pestaña de origen: anulados (Contrato nulo/Devuelto/Rechazado) o retractados.
  const categoria = categoriaDe(body?.categoria)
  const ANULADO_WHERE = whereCategoria(categoria)
  const TIPO_PURGA = tipoPurgaDe(categoria)
  if (!contratos.length) throw new ValidationError('contratos requerido')
  if (contratos.length > 100) throw new ValidationError('Máximo 100 contratos por operación')
  if (motivo.length < 5) throw new ValidationError('El motivo es obligatorio')

  const actorEmail = (session?.user as any)?.email ?? 'desconocido'
  const actorNombre = (session?.user as any)?.name ?? null
  const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '').split(',')[0].trim().slice(0, 45)
  const userAgent = request.headers.get('user-agent') || ''

  const results: ResultItem[] = []

  for (const contrato of contratos) {
    try {
      const res = await withTransaction((client) => purgarContrato(client, contrato, {
        tipoPurga: TIPO_PURGA, motivo, actorEmail, actorNombre, ip, userAgent, incluirPagosValidados,
        // Re-verifica que SIGA anulado (pudo cambiar desde que se listó).
        verificar: async (c, titular) =>
          !!(await c.query(`SELECT 1 FROM "PEOPLE" p WHERE p."_id" = $1 AND ${ANULADO_WHERE}`, [titular._id])).rowCount,
      }))
      const out = { ...res, status: (res.status === 'no_aplica' ? 'no_anulado' : res.status) as Status }

      const msg: Record<Status, string> = {
        ok: '',
        error: '',
        sin_titular: 'No se encontró el titular del contrato',
        no_anulado: categoria === 'retractados' ? 'El contrato ya no está retractado; no se borró' : 'El contrato ya no está anulado (pudo reactivarse); no se borró',
        con_pagos_validados: 'Tiene pagos validados; no se borra desde aquí',
      }
      results.push({ contrato, status: out.status, ...(out.status !== 'ok' ? { error: msg[out.status] } : {}),
        ...((out as any).borrados ? { borrados: (out as any).borrados, conservados: (out as any).conservados } : {}) })
    } catch (err: any) {
      console.error(`[limpieza-anulados] ${contrato}:`, err?.message || err)
      results.push({ contrato, status: 'error', error: err?.message || 'Error desconocido' })
    }
  }

  const ok = results.filter(r => r.status === 'ok').length
  const omitidos = results.filter(r => r.status === 'no_anulado' || r.status === 'con_pagos_validados').length
  const failed = results.filter(r => r.status === 'error' || r.status === 'sin_titular').length
  return successResponse({
    message: `Limpieza: ${ok} borrados · ${omitidos} omitidos · ${failed} fallidos`,
    results, ok, omitidos, failed, total: results.length,
  })
})
