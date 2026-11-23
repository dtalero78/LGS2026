import 'server-only'
import { queryMany, queryOne, query } from '@/lib/postgres'
import { NotFoundError } from '@/lib/errors'
import { tzForPlataforma } from '@/lib/timezone'

/** Mensajes a los inscritos de UN evento (envío "Por evento" de /admin/envio-mensajes). */

const SQL_TIPO = `COALESCE(NULLIF(c."tipo",''), c."evento", '')`
const SQL_NIVEL = `COALESCE(NULLIF(c."nivel",''), c."tituloONivel", '')`

export interface EventoFiltro { desde: string; hasta: string; tipo?: string | null; advisor?: string | null; nivel?: string | null }

export async function listarEventos(f: EventoFiltro) {
  const params: any[] = [f.desde, f.hasta]
  const cond = [`(c."dia"::timestamptz AT TIME ZONE 'America/Bogota')::date BETWEEN $1::date AND $2::date`]
  if (f.tipo) {
    const t = f.tipo.toUpperCase()
    if (t === 'WELCOME') {
      cond.push(`(UPPER(COALESCE(c."tituloONivel",'')) LIKE '%WELCOME%' OR UPPER(${SQL_TIPO}) = 'WELCOME')`)
    } else {
      params.push(t)
      cond.push(`UPPER(${SQL_TIPO}) = $${params.length} AND UPPER(COALESCE(c."tituloONivel",'')) NOT LIKE '%WELCOME%'`)
    }
  }
  if (f.advisor) { params.push(f.advisor); cond.push(`c."advisor" = $${params.length}`) }
  if (f.nivel) { params.push(f.nivel.toUpperCase()); cond.push(`UPPER(${SQL_NIVEL}) = $${params.length}`) }
  return queryMany(
    `SELECT c."_id", c."dia", ${SQL_TIPO} AS "tipo", ${SQL_NIVEL} AS "nivel", c."step",
            COALESCE(NULLIF(c."titulo",''), NULLIF(c."nombreEvento",''), c."tituloONivel") AS "titulo",
            c."limiteUsuarios",
            COALESCE(a."nombreCompleto", TRIM(CONCAT_WS(' ', a."primerNombre", a."primerApellido"))) AS "advisorNombre",
            (SELECT COUNT(*)::int FROM "ACADEMICA_BOOKINGS" b
               WHERE (b."eventoId" = c."_id" OR b."idEvento" = c."_id") AND (b."cancelo" IS NULL OR b."cancelo" = false)) AS "inscritos"
       FROM "CALENDARIO" c LEFT JOIN "ADVISORS" a ON a."_id" = c."advisor"
      WHERE ${cond.join(' AND ')}
      ORDER BY c."dia" ASC LIMIT 300`, params)
}

async function cargarEvento(eventoId: string) {
  const ev = await queryOne<any>(
    `SELECT c."_id", c."dia", ${SQL_TIPO} AS "tipo", ${SQL_NIVEL} AS "nivel", c."step", c."linkZoom",
            COALESCE(NULLIF(c."titulo",''), NULLIF(c."nombreEvento",''), c."tituloONivel") AS "titulo",
            UPPER(COALESCE(c."tituloONivel",'')) LIKE '%WELCOME%' AS "esWelcome",
            COALESCE(a."nombreCompleto", TRIM(CONCAT_WS(' ', a."primerNombre", a."primerApellido"))) AS "advisorNombre"
       FROM "CALENDARIO" c LEFT JOIN "ADVISORS" a ON a."_id" = c."advisor" WHERE c."_id" = $1`, [eventoId])
  if (!ev) throw new NotFoundError('Evento', eventoId)
  return ev
}

export interface InscritoMensaje {
  bookingId: string; academicaId: string | null; numeroId: string; nombre: string; primerApellido: string
  celular: string; celularValido: boolean; inactivo: boolean
  nivel: string; step: string; plataforma: string; contrato: string
  fechaEvento: string; horaEvento: string
}

function fechaHora(dia: any, plataforma: string) {
  const d = new Date(dia), tz = tzForPlataforma(plataforma)
  return {
    fechaEvento: new Intl.DateTimeFormat('es', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(d),
    horaEvento: new Intl.DateTimeFormat('es', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
  }
}

const etiquetaTipo = (ev: any) => (ev.esWelcome ? 'WELCOME' : String(ev.tipo || '')).toUpperCase()

/** Inscritos NO cancelados con su celular de ACADEMICA (misma fuente que el envío masivo). */
export async function inscritosDeEvento(eventoId: string) {
  const ev = await cargarEvento(eventoId)
  const rows = await queryMany<any>(
    `SELECT DISTINCT ON (b."_id") b."_id" AS "bookingId", a."_id" AS "academicaId", a."numeroId", a."primerNombre", a."primerApellido",
            a."celular", a."estadoInactivo", a."nivel", a."step", a."plataforma", a."contrato"
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "ACADEMICA" a ON a."_id" = COALESCE(b."idEstudiante", b."studentId")
      WHERE (b."eventoId" = $1 OR b."idEvento" = $1) AND (b."cancelo" IS NULL OR b."cancelo" = false)
      ORDER BY b."_id"`, [eventoId])
  const inscritos: InscritoMensaje[] = rows.map((r: any) => {
    const cel = String(r.celular || '').replace(/\D/g, '')
    const plataforma = String(r.plataforma || '')
    return {
      bookingId: r.bookingId, academicaId: r.academicaId, numeroId: String(r.numeroId || ''),
      nombre: String(r.primerNombre || ''), primerApellido: String(r.primerApellido || ''),
      celular: cel, celularValido: cel.length >= 10, inactivo: r.estadoInactivo === true,
      nivel: String(r.nivel || ''), step: String(r.step || ''), plataforma, contrato: String(r.contrato || ''),
      ...fechaHora(ev.dia, plataforma),
    }
  }).sort((x, y) => `${x.primerApellido} ${x.nombre}`.localeCompare(`${y.primerApellido} ${y.nombre}`, 'es'))
  return {
    evento: { _id: ev._id, dia: ev.dia, tipo: etiquetaTipo(ev), nivel: ev.nivel, step: ev.step, titulo: ev.titulo, advisor: ev.advisorNombre, linkZoom: ev.linkZoom },
    inscritos,
  }
}

export async function envioReciente(eventoId: string, modo: string, plantillaId: string | null, texto: string | null) {
  return queryOne<any>(
    `SELECT "usuarioNombre","usuarioEmail","_createdDate" FROM "MENSAJES_EVENTO_LOG"
      WHERE "eventoId" = $1 AND "modo" = $2 AND COALESCE("plantillaId",'') = COALESCE($3,'') AND COALESCE("texto",'') = COALESCE($4,'')
        AND "_createdDate" > NOW() - INTERVAL '10 minutes' ORDER BY "_createdDate" DESC LIMIT 1`,
    [eventoId, modo, plantillaId, texto])
}

export async function registrarEnvio(d: {
  eventoId: string; eventoTitulo: string | null; eventoDia: any; modo: string; plantillaId: string | null; plantillaNombre: string | null
  texto: string | null; total: number; enviados: number; fallidos: number; resultados: any[]; usuarioEmail: string | null; usuarioNombre: string | null
}) {
  await query(
    `INSERT INTO "MENSAJES_EVENTO_LOG" ("_id","eventoId","eventoTitulo","eventoDia","modo","plantillaId","plantillaNombre","texto","total","enviados","fallidos","resultados","usuarioEmail","usuarioNombre")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)`,
    [`mev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, d.eventoId, d.eventoTitulo, d.eventoDia, d.modo, d.plantillaId, d.plantillaNombre,
     d.texto, d.total, d.enviados, d.fallidos, JSON.stringify(d.resultados), d.usuarioEmail, d.usuarioNombre])
}
