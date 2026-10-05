import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { query, queryOne } from '@/lib/postgres'
import { NotFoundError } from '@/lib/errors'
import { MantenimientoPermission } from '@/types/permissions'
import { TIPO_PURGA_ANULADOS } from '@/lib/limpieza-anulados'

/**
 * GET /api/admin/limpieza-anulados/historico?search=      → lista (sin snapshot)
 * GET /api/admin/limpieza-anulados/historico?id=<_id>     → detalle legible
 *
 * Registro de los contratos anulados que se BORRARON (PURGE_LOG, tipoPurga
 * LIMPIEZA_ANULADOS). Solo para consulta / referencia. Gateado por
 * MANTENIMIENTO.CONTRATOS.LIMPIEZA_ANULADOS.
 */
export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.LIMPIEZA_ANULADOS)
  const { searchParams } = new URL(req.url)
  const id = (searchParams.get('id') || '').trim()

  if (id) {
    const row = await queryOne<any>(
      `SELECT * FROM "PURGE_LOG" WHERE "_id" = $1 AND "tipoPurga" = $2`, [id, TIPO_PURGA_ANULADOS])
    if (!row) throw new NotFoundError('Registro', id)
    const snap = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : (row.snapshot || {})
    const fin = (snap.financieros || [])[0] || null
    return successResponse({
      registro: {
        _id: row._id, contrato: row.contrato, titularNombre: row.titularNombre, motivo: row.motivo,
        realizadoPor: row.realizadoPorNombre || row.realizadoPor, fecha: row._createdDate,
        filasBorradas: row.filasBorradas,
      },
      personas: (snap.people || []).map((p: any) => ({
        tipoUsuario: p.tipoUsuario,
        nombre: [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido].filter(Boolean).join(' '),
        numeroId: p.numeroId, email: p.email, celular: p.celular, plataforma: p.plataforma,
        aprobacion: p.aprobacion, estado: p.estado, asesor: p.asesor,
        creado: p._createdDate, actualizado: p._updatedDate,
      })),
      financiero: fin ? { totalPlan: fin.totalPlan, pagoInscripcion: fin.pagoInscripcion, numeroCuotas: fin.numeroCuotas, saldo: fin.saldo } : null,
      pagos: (snap.pagos || []).map((p: any) => ({ numCuota: p.numCuota, valorPagado: p.valorPagado, validado: p.validado, fechaPago: p.fechaPago })),
      conservados: snap.conservados || { documentos: [], correos: [] },
    })
  }

  const search = (searchParams.get('search') || '').trim()
  const params: any[] = [TIPO_PURGA_ANULADOS]
  let where = `"tipoPurga" = $1`
  if (search) { where += ` AND ("contrato" ILIKE $2 OR "titularNombre" ILIKE $2 OR "realizadoPor" ILIKE $2)`; params.push(`%${search}%`) }
  const r = await query<any>(
    `SELECT "_id","contrato","titularNombre","motivo","realizadoPor","realizadoPorNombre","filasBorradas",
            "_createdDate" AS "fecha"
       FROM "PURGE_LOG" WHERE ${where}
      ORDER BY "_createdDate" DESC LIMIT 1000`, params)
  return successResponse({ rows: r.rows, total: r.rowCount || 0 })
})
