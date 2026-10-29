import 'server-only'
import { queryOne, queryMany } from '@/lib/postgres'
import { NotFoundError } from '@/lib/errors'
import { sqlNorm } from '@/lib/limpieza-anulados'

/**
 * Libro de Producción › casillas "Depurar" (firmado sin aprobar) y "Ratificar"
 * (sin firmar, con el correo "SÍ, ACEPTO"). Reglas y vista previa compartidas
 * por GET …/depuracion, POST …/depurar y POST …/ratificar.
 */

/** Sin estado real en la ficha: vacío o "Pendiente" (los demás se gestionan desde la ficha / Limpieza de Anulados). */
export const SIN_ESTADO_SQL = `COALESCE(TRIM(p."aprobacion"),'') IN ('','Pendiente','PENDIENTE','pendiente')`
export const esSinEstado = (a: unknown) => ['', 'pendiente'].includes(String(a ?? '').trim().toLowerCase())
export const estaFirmado = (t: any) => String(t?.hashConsentimiento || '').trim() !== ''

export interface DocDescargable { grupo: string; nombre: string; url: string }
export interface OtroContrato { contrato: string; tipoUsuario: string; nombre: string; aprobacion: string | null; estado: string | null; firmado: boolean }

const normDoc = (v: unknown) => String(v || '').trim().toUpperCase().replace(/[.\s\-_]/g, '')

function urlsDe(raw: unknown): { url: string; nombre: string }[] {
  let v: any = raw
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch { return v.startsWith('http') ? [{ url: v, nombre: '' }] : [] } }
  const arr = Array.isArray(v) ? v : v ? [v] : []
  return arr.flatMap((d: any) => {
    if (!d) return []
    if (typeof d === 'string') return d.startsWith('http') ? [{ url: d, nombre: '' }] : []
    const propio = d.url ? [{ url: String(d.url), nombre: String(d.nombre || '') }] : []
    // reciboInscripcion con dos recibos: { recibos: [{url,nombre}] }
    return [...propio, ...urlsDe(d.recibos)]
  })
}

export async function previsualizarDepuracion(titularId: string) {
  const titular = await queryOne(
    `SELECT "_id","contrato","numeroId","primerNombre","segundoNombre","primerApellido","segundoApellido",
            "aprobacion","estado","hashConsentimiento","tipoUsuario"
       FROM "PEOPLE" WHERE "_id" = $1`, [titularId])
  if (!titular || titular.tipoUsuario !== 'TITULAR') throw new NotFoundError('Titular', titularId)
  const contrato: string = titular.contrato

  const personas = await queryMany(
    `SELECT "_id","tipoUsuario","primerNombre","primerApellido","numeroId","documentacion","reciboInscripcion"
       FROM "PEOPLE" WHERE "contrato" = $1 ORDER BY ("tipoUsuario" = 'TITULAR') DESC, "_createdDate"`, [contrato])
  const pagos = await queryMany(
    `SELECT "_id","numCuota","validado","documentosAdjuntos" FROM "PAGOS_TITULARES"
      WHERE "idPeople" = ANY($1::text[]) ORDER BY "numCuota"`, [personas.map((p: any) => p._id)])
  const fin = await queryOne(`SELECT "reciboUrl" FROM "FINANCIEROS" WHERE "contrato" = $1 ORDER BY "_createdDate" DESC LIMIT 1`, [contrato]).catch(() => null)

  // Documentos y recibos a descargar antes de borrar (sin repetir la misma URL).
  const vistos = new Set<string>()
  const documentos: DocDescargable[] = []
  const add = (grupo: string, items: { url: string; nombre: string }[]) => {
    for (const it of items) {
      if (!it.url || vistos.has(it.url)) continue
      vistos.add(it.url)
      documentos.push({ grupo, nombre: it.nombre || decodeURIComponent(it.url.split('/').pop() || 'archivo'), url: it.url })
    }
  }
  for (const p of personas) {
    const quien = `${p.tipoUsuario === 'TITULAR' ? 'Titular' : 'Beneficiario'} · ${`${p.primerNombre || ''} ${p.primerApellido || ''}`.trim()}`
    add(`Documentación — ${quien}`, urlsDe(p.documentacion))
    add('Recibo de inscripción', urlsDe(p.reciboInscripcion))
  }
  if (fin?.reciboUrl) add('Recibo de inscripción', urlsDe(fin.reciboUrl))
  for (const pg of pagos) add(Number(pg.numCuota) === 0 ? 'Pago de inscripción' : `Pago cuota ${pg.numCuota}`, urlsDe(pg.documentosAdjuntos))

  // Otros contratos de la misma persona (como titular o beneficiario).
  const doc = normDoc(titular.numeroId)
  const otros: OtroContrato[] = doc
    ? (await queryMany(
        `SELECT p."contrato", p."tipoUsuario", p."aprobacion", p."estado",
                TRIM(CONCAT_WS(' ', p."primerNombre", p."primerApellido")) AS nombre,
                (COALESCE(p."hashConsentimiento",'') <> '') AS firmado
           FROM "PEOPLE" p
          WHERE ${sqlNorm('p."numeroId"')} = $1 AND COALESCE(p."contrato",'') <> $2
          ORDER BY p."_createdDate" DESC`, [doc, contrato])).map((r: any) => ({ ...r, firmado: r.firmado === true }))
    : []

  const firmado = estaFirmado(titular)
  const sinEstado = esSinEstado(titular.aprobacion)
  const pagosValidados = pagos.filter((p: any) => p.validado === true).length
  const nombre = [titular.primerNombre, titular.segundoNombre, titular.primerApellido, titular.segundoApellido]
    .map(s => String(s || '').trim()).filter(Boolean).join(' ')

  return {
    titular: { id: titular._id, contrato, nombre, documento: titular.numeroId, aprobacion: titular.aprobacion, firmado },
    beneficiarios: personas.filter((p: any) => p.tipoUsuario !== 'TITULAR').length,
    documentos,
    pagos: { total: pagos.length, validados: pagosValidados },
    otrosContratos: otros,
    depurable: firmado && sinEstado && pagosValidados === 0,
    motivoNoDepurable: !firmado ? 'El contrato no está firmado (use Ratificar en la pestaña Sin firmar).'
      : !sinEstado ? `El contrato ya tiene estado "${titular.aprobacion}"; se gestiona desde la ficha.`
      : pagosValidados ? `Tiene ${pagosValidados} pago(s) validado(s) por Recaudos; no se depura desde aquí.` : null,
    ratificable: !firmado && sinEstado,
    motivoNoRatificable: firmado ? 'El contrato ya está firmado.'
      : !sinEstado ? `El contrato ya tiene estado "${titular.aprobacion}".` : null,
  }
}
