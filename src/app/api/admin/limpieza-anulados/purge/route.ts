import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/api-permissions'
import { withTransaction } from '@/lib/postgres'
import { ValidationError } from '@/lib/errors'
import { MantenimientoPermission } from '@/types/permissions'
import { ids } from '@/lib/id-generator'
import { sqlNorm, categoriaDe, whereCategoria, tipoPurgaDe } from '@/lib/limpieza-anulados'

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
      const out = await withTransaction(async (client) => {
        const peopleSnap = await client.query(`SELECT * FROM "PEOPLE" WHERE "contrato" = $1 FOR UPDATE`, [contrato])
        const titular = peopleSnap.rows.find((p: any) => p.tipoUsuario === 'TITULAR')
        if (!titular) return { status: 'sin_titular' as Status }

        // Re-verifica que SIGA anulado (pudo cambiar desde que se listó).
        const sigue = await client.query(`SELECT 1 FROM "PEOPLE" p WHERE p."_id" = $1 AND ${ANULADO_WHERE}`, [titular._id])
        if (!sigue.rowCount) return { status: 'no_anulado' as Status }

        const peopleIds: string[] = peopleSnap.rows.map((p: any) => p._id)
        const pagosSnap = await client.query(`SELECT * FROM "PAGOS_TITULARES" WHERE "idPeople" = ANY($1::text[])`, [peopleIds])
        const pagosValidados = pagosSnap.rows.filter((p: any) => p.validado === true).length
        if (pagosValidados > 0 && !incluirPagosValidados) return { status: 'con_pagos_validados' as Status }

        // Documentos y correos COMPARTIDOS con otros contratos → se conservan.
        const nids = Array.from(new Set(peopleSnap.rows
          .map((p: any) => String(p.numeroId || '').trim().toUpperCase().replace(/[.\s\-_]/g, ''))
          .filter(Boolean))) as string[]
        const sharedNids = nids.length
          ? (await client.query(
              `SELECT DISTINCT ${sqlNorm('"numeroId"')} AS nid FROM "PEOPLE"
                WHERE ${sqlNorm('"numeroId"')} = ANY($1::text[]) AND COALESCE("contrato",'') <> $2`,
              [nids, contrato])).rows.map((r: any) => r.nid)
          : []
        const nidsBorrables = nids.filter(n => !sharedNids.includes(n))

        const emails = Array.from(new Set(peopleSnap.rows
          .map((p: any) => String(p.email || '').trim().toLowerCase()).filter(Boolean))) as string[]
        const sharedEmails = emails.length
          ? (await client.query(
              `SELECT DISTINCT LOWER(TRIM("email")) AS e FROM "PEOPLE"
                WHERE LOWER(TRIM("email")) = ANY($1::text[]) AND COALESCE("contrato",'') <> $2`,
              [emails, contrato])).rows.map((r: any) => r.e)
          : []
        const emailsBorrables = emails.filter(e => !sharedEmails.includes(e))

        const academicaSnap = nidsBorrables.length
          ? await client.query(`SELECT * FROM "ACADEMICA" WHERE ${sqlNorm('"numeroId"')} = ANY($1::text[])`, [nidsBorrables])
          : { rows: [] as any[] }
        const academicaIds: string[] = academicaSnap.rows.map((a: any) => a._id)
        const bookingsSnap = academicaIds.length
          ? await client.query(`SELECT * FROM "ACADEMICA_BOOKINGS" WHERE "studentId" = ANY($1::text[]) OR "idEstudiante" = ANY($1::text[])`, [academicaIds])
          : { rows: [] as any[] }
        const overridesSnap = academicaIds.length
          ? await client.query(`SELECT * FROM "STEP_OVERRIDES" WHERE "studentId" = ANY($1::text[])`, [academicaIds])
          : { rows: [] as any[] }
        const complemSnap = academicaIds.length
          ? await client.query(`SELECT * FROM "COMPLEMENTARIA_ATTEMPTS" WHERE "studentId" = ANY($1::text[])`, [academicaIds]).catch(() => ({ rows: [] as any[] }))
          : { rows: [] as any[] }
        const usuariosSnap = emailsBorrables.length
          ? await client.query(
              `SELECT * FROM "USUARIOS_ROLES" WHERE LOWER(TRIM("email")) = ANY($1::text[]) AND UPPER(COALESCE("rol",'')) = 'ESTUDIANTE'`,
              [emailsBorrables])
          : { rows: [] as any[] }
        const finSnap = await client.query(`SELECT * FROM "FINANCIEROS" WHERE "contrato" = $1`, [contrato])
        const kidsSnap = await client.query(`SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "contrato" = $1`, [contrato]).catch(() => ({ rows: [] as any[] }))

        const conservados = { documentos: sharedNids, correos: sharedEmails }
        const snapshot = {
          people: peopleSnap.rows, academica: academicaSnap.rows, bookings: bookingsSnap.rows,
          financieros: finSnap.rows, pagos: pagosSnap.rows, stepOverrides: overridesSnap.rows,
          complementarias: complemSnap.rows, kidsInscripciones: kidsSnap.rows, usuariosRoles: usuariosSnap.rows,
          conservados,
        }
        const borrados = {
          people: peopleSnap.rows.length, academica: academicaSnap.rows.length, bookings: bookingsSnap.rows.length,
          financieros: finSnap.rows.length, pagos: pagosSnap.rows.length, pagosValidados, stepOverrides: overridesSnap.rows.length,
          complementarias: complemSnap.rows.length, kidsInscripciones: kidsSnap.rows.length, usuariosRoles: usuariosSnap.rows.length,
        }
        const titularNombre = `${titular.primerNombre || ''} ${titular.primerApellido || ''}`.trim()

        await client.query(
          `INSERT INTO "PURGE_LOG"
             ("_id","tipoPurga","contrato","titularId","titularNombre","snapshot","motivo",
              "realizadoPor","realizadoPorNombre","ip","userAgent","filasBorradas")
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12::jsonb)`,
          [ids.audit(), TIPO_PURGA, contrato, titular._id, titularNombre, JSON.stringify(snapshot), motivo,
           actorEmail, actorNombre, ip, userAgent, JSON.stringify(borrados)])

        if (academicaIds.length) {
          await client.query(`DELETE FROM "STEP_OVERRIDES" WHERE "studentId" = ANY($1::text[])`, [academicaIds])
          await client.query(`DELETE FROM "COMPLEMENTARIA_ATTEMPTS" WHERE "studentId" = ANY($1::text[])`, [academicaIds]).catch(() => null)
          await client.query(`DELETE FROM "ACADEMICA_BOOKINGS" WHERE "studentId" = ANY($1::text[]) OR "idEstudiante" = ANY($1::text[])`, [academicaIds])
          await client.query(`DELETE FROM "ACADEMICA" WHERE "_id" = ANY($1::text[])`, [academicaIds])
        }
        if (usuariosSnap.rows.length) {
          await client.query(`DELETE FROM "USUARIOS_ROLES" WHERE "_id" = ANY($1::text[])`, [usuariosSnap.rows.map((u: any) => u._id)])
        }
        await client.query(`DELETE FROM "PAGOS_TITULARES" WHERE "idPeople" = ANY($1::text[])`, [peopleIds])
        await client.query(`DELETE FROM "FINANCIEROS" WHERE "contrato" = $1`, [contrato])
        await client.query(`DELETE FROM "KIDS_INSCRIPCIONES" WHERE "contrato" = $1`, [contrato]).catch(() => null)
        await client.query(`DELETE FROM "PEOPLE" WHERE "contrato" = $1`, [contrato])

        return { status: 'ok' as Status, borrados, conservados }
      })

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
