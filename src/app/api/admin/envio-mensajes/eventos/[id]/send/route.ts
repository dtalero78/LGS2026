import 'server-only'
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { MantenimientoPermission } from '@/types/permissions'
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors'
import { MessageTemplatesRepository } from '@/repositories/message-templates.repository'
import { fillTemplate } from '@/lib/message-template-filler'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { inscritosDeEvento, envioReciente, registrarEnvio } from '@/services/mensajes-evento.service'

const MAX_SEND = 300

/**
 * POST /api/admin/envio-mensajes/eventos/[id]/send
 * Body: { plantillaId? | texto?, bookingIds: string[], confirmarRepetido?: boolean }
 * Plantilla → ENVIO_MENSAJES; texto personalizado → además ENVIO_MENSAJES_PERSONALIZADO (el servidor lo exige).
 * Los destinatarios se RESUELVEN en el servidor desde los inscritos reales del evento (el cliente solo elige cuáles).
 */
export const POST = handlerWithStaffAuth(async (req, ctx, session) => {
  await requirePermission(session, MantenimientoPermission.ENVIO_MENSAJES)
  const body = await req.json().catch(() => ({}))
  const eventoId = ctx.params.id
  const plantillaId = String(body?.plantillaId || '').trim() || null
  const texto = String(body?.texto || '').trim() || null
  if (!!plantillaId === !!texto) throw new ValidationError('Elige una plantilla o escribe un mensaje personalizado (solo uno)')
  if (texto) {
    await requirePermission(session, MantenimientoPermission.ENVIO_MENSAJES_PERSONALIZADO)
    if (texto.length > 1500) throw new ValidationError('El mensaje no puede pasar de 1500 caracteres')
  }
  const elegidos = new Set<string>(Array.isArray(body?.bookingIds) ? body.bookingIds.map(String) : [])
  if (!elegidos.size) throw new ValidationError('Selecciona al menos un destinatario')
  if (elegidos.size > MAX_SEND) throw new ValidationError(`Máximo ${MAX_SEND} destinatarios por envío`)

  let tpl: any = null
  if (plantillaId) {
    tpl = await MessageTemplatesRepository.findById(plantillaId)
    if (!tpl) throw new NotFoundError('Plantilla', plantillaId)
    if (!tpl.activo) throw new ValidationError(`La plantilla "${tpl.nombre}" está inactiva`)
  }
  const modo = tpl ? 'PLANTILLA' : 'PERSONALIZADO'

  const { evento, inscritos } = await inscritosDeEvento(eventoId)
  const dest = inscritos.filter(i => elegidos.has(i.bookingId))
  if (dest.length !== elegidos.size) throw new ValidationError('Hay destinatarios que ya no están inscritos en el evento. Recarga la lista.')
  const sinCel = dest.filter(d => !d.celularValido)
  if (sinCel.length) throw new ValidationError(`${sinCel.length} destinatario(s) sin celular válido: quítalos de la selección`)

  const previo = await envioReciente(eventoId, modo, plantillaId, texto)
  if (previo && body?.confirmarRepetido !== true) {
    throw new ConflictError(`Este mismo mensaje ya se envió a este evento hace menos de 10 minutos (por ${previo.usuarioNombre || previo.usuarioEmail || 'otro usuario'}). Confirma para enviarlo de nuevo.`)
  }

  const resultados: any[] = []
  for (const d of dest) {
    const base: string = tpl ? tpl.contenido : texto!
    const mensaje = fillTemplate(base, {
      nombre: d.nombre, primerApellido: d.primerApellido, nivel: d.nivel, step: d.step, plataforma: d.plataforma,
      contrato: d.contrato, numeroId: d.numeroId, fechaEvento: d.fechaEvento, horaEvento: d.horaEvento,
      tipoEvento: evento.tipo, tituloEvento: evento.titulo, advisor: evento.advisor, linkZoom: evento.linkZoom,
    })
    const nombre = `${d.nombre} ${d.primerApellido}`.trim() || '(sin nombre)'
    try {
      await sendWhatsAppMessage(d.celular, mensaje, 'masivo')
      resultados.push({ bookingId: d.bookingId, numeroId: d.numeroId, nombre, celular: d.celular, ok: true, mensajeEnviado: mensaje })
    } catch (err: any) {
      resultados.push({ bookingId: d.bookingId, numeroId: d.numeroId, nombre, celular: d.celular, ok: false, error: err?.message || 'Error desconocido' })
    }
  }
  const enviados = resultados.filter(r => r.ok).length
  const u: any = session?.user
  await registrarEnvio({
    eventoId, eventoTitulo: evento.titulo, eventoDia: evento.dia, modo, plantillaId, plantillaNombre: tpl?.nombre ?? null, texto,
    total: resultados.length, enviados, fallidos: resultados.length - enviados,
    resultados: resultados.map(r => ({ numeroId: r.numeroId, nombre: r.nombre, celular: r.celular, ok: r.ok, error: r.error })),
    usuarioEmail: u?.email ?? null, usuarioNombre: u?.name ?? null,
  }).catch(e => console.error('[mensajes-evento] no se pudo registrar el envío:', e?.message))
  return successResponse({ enviados, fallidos: resultados.length - enviados, resultados })
})
