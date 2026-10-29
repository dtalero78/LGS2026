import 'server-only'
import type { PoolClient } from 'pg'
import { ids } from '@/lib/id-generator'
import { sqlNorm } from '@/lib/limpieza-anulados'

/**
 * Borrado definitivo de UN contrato con la regla de la Limpieza de Anulados.
 * Lo usan la Limpieza de Anulados (Mantenimiento) y la depuración del Libro de
 * Producción. Corre dentro de la transacción del llamador (`client`).
 *
 * No se borra en cascada por numeroId/email a ciegas (la persona suele tener
 * OTRO contrato vivo):
 *   - ACADEMICA (+ clases, overrides, complementarias): solo de los documentos que
 *     NO aparecen en ningún otro contrato.
 *   - USUARIOS_ROLES: solo logins ESTUDIANTE cuyo correo NO aparece en otro contrato.
 *   - PAGOS_TITULARES: por idPeople de las filas del contrato. Con algún pago
 *     VALIDADO se omite, salvo `incluirPagosValidados`.
 *   - FINANCIEROS / KIDS_INSCRIPCIONES / PEOPLE: por número de contrato.
 * Antes de borrar guarda copia completa en PURGE_LOG (`tipoPurga`).
 */
export type PurgaStatus = 'ok' | 'sin_titular' | 'no_aplica' | 'con_pagos_validados'

export interface PurgaOpts {
  tipoPurga: string
  motivo: string
  actorEmail: string
  actorNombre: string | null
  ip: string
  userAgent: string
  incluirPagosValidados?: boolean
  /** Re-verifica (con la fila bloqueada) que el contrato siga siendo borrable. */
  verificar: (client: PoolClient, titular: any) => Promise<boolean>
}

export interface PurgaResult {
  status: PurgaStatus
  borrados?: Record<string, number>
  conservados?: { documentos: string[]; correos: string[] }
}

export async function purgarContrato(client: PoolClient, contrato: string, opts: PurgaOpts): Promise<PurgaResult> {
  const peopleSnap = await client.query(`SELECT * FROM "PEOPLE" WHERE "contrato" = $1 FOR UPDATE`, [contrato])
  const titular = peopleSnap.rows.find((p: any) => p.tipoUsuario === 'TITULAR')
  if (!titular) return { status: 'sin_titular' }
  if (!(await opts.verificar(client, titular))) return { status: 'no_aplica' }

  const peopleIds: string[] = peopleSnap.rows.map((p: any) => p._id)
  const pagosSnap = await client.query(`SELECT * FROM "PAGOS_TITULARES" WHERE "idPeople" = ANY($1::text[])`, [peopleIds])
  const pagosValidados = pagosSnap.rows.filter((p: any) => p.validado === true).length
  if (pagosValidados > 0 && !opts.incluirPagosValidados) return { status: 'con_pagos_validados' }

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
    [ids.audit(), opts.tipoPurga, contrato, titular._id, titularNombre, JSON.stringify(snapshot), opts.motivo,
     opts.actorEmail, opts.actorNombre, opts.ip, opts.userAgent, JSON.stringify(borrados)])

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

  return { status: 'ok', borrados, conservados }
}
