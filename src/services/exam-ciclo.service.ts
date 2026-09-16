/**
 * Exam Ciclo Service — SetUp Ciclo y Agrupación (Exam. Intern.)
 *
 * Dos flujos:
 *   1. SetUp Ciclo: CRUD de ciclos de examen (EXAM_CICLOS) + generación en
 *      bloque de los eventos de examen en CALENDARIO a partir de la config
 *      (franjas de días+hora+advisor+Zoom+cupo por IELTS/TOEFL/B2FIRST) y el
 *      rango de fechas del ciclo. Idempotente: un ciclo GENERADO no regenera.
 *
 *   2. Agrupación: lista los estudiantes CONFIRMADOS (EXAM_INTERN_AUDIT,
 *      accion='EXTENDIDO') con sus programas (colisión si tiene >1), permite
 *      agendamiento masivo a un evento del ciclo y marcar cada inscripción como
 *      Confirmado / Pendiente / Cancelado (Cancelado = soft-cancel que libera
 *      el cupo; reversible).
 *
 * El esquema (tabla EXAM_CICLOS + columnas cicloId/confirmadoExamen) se crea
 * con scripts/create-exam-ciclos-table.js — NUNCA DDL en el request path.
 */

import 'server-only';
import { query, queryOne, queryMany, withTransaction } from '@/lib/postgres';
import { generateId } from '@/lib/id-generator';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { CalendarioRepository } from '@/repositories/calendar.repository';
import { enrollStudents } from '@/services/enrollment.service';

export type ExamPrueba = 'IELTS' | 'TOEFL' | 'B2FIRST';
const PRUEBAS: ExamPrueba[] = ['IELTS', 'TOEFL', 'B2FIRST'];
const PRUEBA_TO_STEP: Record<ExamPrueba, string> = { IELTS: 'Step 47', TOEFL: 'Step 49', B2FIRST: 'Step 48' };
const PRUEBA_DISPLAY: Record<ExamPrueba, string> = { IELTS: 'IELTS', TOEFL: 'TOEFL', B2FIRST: 'B2 First' };

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

/** Franja de un examen: días de semana (0=Dom..6=Sáb) + hora + advisor + Zoom + cupo. */
export interface Franja {
  dias: number[];
  hora: string;                 // "HH:mm"
  advisor: string | null;       // ADVISORS._id
  linkZoom: string | null;
  cupo: number;
}
export type CicloConfig = Partial<Record<ExamPrueba, Franja[]>>;

/**
 * Decisión sobre una fecha con festivo o día off manual del ciclo. Solo se
 * guardan fechas con acción distinta de "generar" (lo default). Aplica al DÍA
 * completo: afecta todas las sesiones (todos los exámenes/franjas) de esa fecha.
 */
export type DiaEspecialTipo = 'FESTIVO' | 'OFF';
export type DiaEspecialAccion = 'OMITIR' | 'MOVER';
export interface DiaEspecial {
  fecha: string;                     // YYYY-MM-DD afectada
  tipo: DiaEspecialTipo;             // FESTIVO (nacional) | OFF (manual)
  accion: DiaEspecialAccion;         // OMITIR = no generar | MOVER = generar en otra fecha
  fechaReemplazo?: string | null;    // YYYY-MM-DD (solo accion='MOVER')
  motivo?: string | null;
}

export interface CicloRow {
  _id: string;
  nombre: string;
  fechaInicial: string;         // YYYY-MM-DD
  fechaFinal: string;           // YYYY-MM-DD
  config: CicloConfig;
  diasEspeciales: DiaEspecial[];
  estado: string;               // BORRADOR | GENERADO
  eventosGenerados: number;
  creadoPor: string | null;
  _createdDate: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Itera cada fecha del rango [start,end] (YYYY-MM-DD) con su día de semana (0=Dom..6=Sáb). */
function* eachDate(start: string, end: string): Generator<{ ymd: string; dow: number }> {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  let cur = Date.UTC(ys, ms - 1, ds);
  const last = Date.UTC(ye, me - 1, de);
  let guard = 0;
  while (cur <= last && guard < 2000) {
    const d = new Date(cur);
    yield { ymd: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`, dow: d.getUTCDay() };
    cur += 86400000;
    guard++;
  }
}

/**
 * Instante UTC (ISO) para una fecha+hora LOCAL de Bogotá (UTC-5, sin DST).
 * Se fija el offset -05:00 explícito para que la generación sea determinista
 * sin depender de la zona horaria del servidor que corre el proceso.
 */
function bogotaToUTC(ymd: string, hora: string): string {
  return new Date(`${ymd}T${hora}:00-05:00`).toISOString();
}

/** Normaliza y valida la config entrante (descarta franjas inválidas). */
function sanitizeConfig(raw: any): CicloConfig {
  const out: CicloConfig = {};
  for (const p of PRUEBAS) {
    const arr = Array.isArray(raw?.[p]) ? raw[p] : [];
    const franjas: Franja[] = [];
    for (const f of arr) {
      const dias = Array.isArray(f?.dias)
        ? Array.from(new Set(f.dias.map((x: any) => Number(x)).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6)))
        : [];
      const hora = String(f?.hora ?? '').trim();
      if (dias.length === 0 || !HHMM.test(hora)) continue;
      franjas.push({
        dias: (dias as number[]).sort((a, b) => a - b),
        hora,
        advisor: f?.advisor ? String(f.advisor) : null,
        linkZoom: f?.linkZoom ? String(f.linkZoom).trim() : null,
        cupo: Number(f?.cupo) > 0 ? Math.floor(Number(f.cupo)) : 30,
      });
    }
    if (franjas.length) out[p] = franjas;
  }
  return out;
}

/** Normaliza las decisiones de festivos/días off (descarta entradas inválidas). */
function sanitizeDiasEspeciales(raw: any): DiaEspecial[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, DiaEspecial>();
  for (const d of raw) {
    const fecha = String(d?.fecha ?? '').slice(0, 10);
    if (!YMD.test(fecha)) continue;
    const tipo: DiaEspecialTipo = d?.tipo === 'OFF' ? 'OFF' : 'FESTIVO';
    const accion: DiaEspecialAccion = d?.accion === 'MOVER' ? 'MOVER' : 'OMITIR';
    let fechaReemplazo: string | null = null;
    if (accion === 'MOVER') {
      const fr = String(d?.fechaReemplazo ?? '').slice(0, 10);
      if (!YMD.test(fr) || fr === fecha) continue; // mover sin destino válido → se ignora
      fechaReemplazo = fr;
    }
    const motivo = d?.motivo ? String(d.motivo).slice(0, 200) : null;
    map.set(fecha, { fecha, tipo, accion, fechaReemplazo, motivo }); // dedupe por fecha (última gana)
  }
  return Array.from(map.values());
}

const CICLO_COLS = `"_id", "nombre", "fechaInicial"::text AS "fechaInicial",
  "fechaFinal"::text AS "fechaFinal", "config",
  COALESCE("diasEspeciales", '[]'::jsonb) AS "diasEspeciales", "estado",
  "eventosGenerados", "creadoPor", "_createdDate"`;

// ── SetUp Ciclo: CRUD ──────────────────────────────────────────────────────

export async function listCiclos(): Promise<CicloRow[]> {
  return queryMany<CicloRow>(
    `SELECT ${CICLO_COLS} FROM "EXAM_CICLOS" ORDER BY "_createdDate" DESC`
  );
}

export async function getCiclo(id: string): Promise<CicloRow | null> {
  return queryOne<CicloRow>(
    `SELECT ${CICLO_COLS} FROM "EXAM_CICLOS" WHERE "_id" = $1`,
    [id]
  );
}

export async function saveCiclo(input: any, actor: string): Promise<CicloRow> {
  const nombre = String(input?.nombre ?? '').trim();
  const fechaInicial = String(input?.fechaInicial ?? '').trim();
  const fechaFinal = String(input?.fechaFinal ?? '').trim();

  if (!nombre) throw new ValidationError('El nombre del ciclo es requerido');
  if (!YMD.test(fechaInicial) || !YMD.test(fechaFinal)) {
    throw new ValidationError('Fechas inválidas (formato esperado YYYY-MM-DD)');
  }
  if (fechaFinal < fechaInicial) {
    throw new ValidationError('La fecha final no puede ser anterior a la inicial');
  }
  const config = sanitizeConfig(input?.config);
  const diasEspeciales = sanitizeDiasEspeciales(input?.diasEspeciales);

  const id = input?._id ? String(input._id) : null;
  if (id) {
    const existing = await getCiclo(id);
    if (!existing) throw new NotFoundError('EXAM_CICLOS', id);
    if (existing.estado === 'GENERADO') {
      throw new ConflictError('No se puede editar un ciclo que ya generó sus eventos.');
    }
    const updated = await queryOne<CicloRow>(
      `UPDATE "EXAM_CICLOS"
          SET "nombre" = $1, "fechaInicial" = $2::date, "fechaFinal" = $3::date,
              "config" = $4::jsonb, "diasEspeciales" = $5::jsonb, "_updatedDate" = NOW()
        WHERE "_id" = $6
        RETURNING ${CICLO_COLS}`,
      [nombre, fechaInicial, fechaFinal, JSON.stringify(config), JSON.stringify(diasEspeciales), id]
    );
    return updated!;
  }

  const created = await queryOne<CicloRow>(
    `INSERT INTO "EXAM_CICLOS"
       ("_id", "nombre", "fechaInicial", "fechaFinal", "config", "diasEspeciales", "estado", "eventosGenerados", "creadoPor")
     VALUES ($1, $2, $3::date, $4::date, $5::jsonb, $6::jsonb, 'BORRADOR', 0, $7)
     RETURNING ${CICLO_COLS}`,
    [generateId('exc'), nombre, fechaInicial, fechaFinal, JSON.stringify(config), JSON.stringify(diasEspeciales), actor]
  );
  return created!;
}

// ── SetUp Ciclo: generación de eventos ─────────────────────────────────────

export async function generarEventos(cicloId: string): Promise<{ generados: number }> {
  const ciclo = await getCiclo(cicloId);
  if (!ciclo) throw new NotFoundError('EXAM_CICLOS', cicloId);
  if (ciclo.estado === 'GENERADO') {
    throw new ConflictError('Este ciclo ya generó sus eventos.');
  }

  const config = ciclo.config || {};

  // Decisiones por fecha (festivos / días off). Aplican al día completo.
  const especiales = Array.isArray(ciclo.diasEspeciales) ? ciclo.diasEspeciales : [];
  const skip = new Set<string>();          // fechas a OMITIR (no se generan)
  const move = new Map<string, string>();  // fecha -> fechaReemplazo (MOVER)
  for (const d of especiales) {
    if (d.accion === 'OMITIR') skip.add(d.fecha);
    else if (d.accion === 'MOVER' && d.fechaReemplazo) move.set(d.fecha, d.fechaReemplazo);
  }

  const rows: Record<string, any>[] = [];
  let seq = 0;

  for (const prueba of PRUEBAS) {
    const franjas = Array.isArray(config[prueba]) ? (config[prueba] as Franja[]) : [];
    const step = PRUEBA_TO_STEP[prueba];
    for (const f of franjas) {
      for (const { ymd, dow } of eachDate(ciclo.fechaInicial, ciclo.fechaFinal)) {
        if (!f.dias.includes(dow)) continue;
        if (skip.has(ymd)) continue;              // día omitido
        const targetYmd = move.get(ymd) || ymd;   // día movido a su reemplazo
        rows.push({
          _id: `${generateId('evt')}${(seq++).toString(36)}`,
          cicloId,
          dia: bogotaToUTC(targetYmd, f.hora),
          fecha: targetYmd,
          hora: f.hora,
          advisor: f.advisor,
          nivel: prueba,
          step,
          tipo: 'SESSION',
          titulo: `${PRUEBA_DISPLAY[prueba]} — ${ciclo.nombre}`,
          nombreEvento: step,
          tituloONivel: `${prueba} - ${step}`,
          linkZoom: f.linkZoom,
          limiteUsuarios: f.cupo,
        });
      }
    }
  }

  if (rows.length === 0) {
    throw new ValidationError('El ciclo no tiene franjas válidas para generar eventos.');
  }

  await withTransaction(async (client) => {
    for (const r of rows) {
      await CalendarioRepository.create(r, client);
    }
    await client.query(
      `UPDATE "EXAM_CICLOS" SET "estado" = 'GENERADO', "eventosGenerados" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`,
      [rows.length, cicloId]
    );
  });

  return { generados: rows.length };
}

// ── SetUp Ciclo: reabrir / borrar ──────────────────────────────────────────

/** Nº de estudiantes con inscripción ACTIVA (cancelo=false) en los eventos del ciclo. */
export async function countInscritosCiclo(cicloId: string): Promise<number> {
  const r = await queryOne<{ n: number }>(
    `SELECT COUNT(DISTINCT COALESCE(b."studentId", b."idEstudiante"))::int AS n
       FROM "CALENDARIO" c
       JOIN "ACADEMICA_BOOKINGS" b
         ON (b."eventoId" = c."_id" OR b."idEvento" = c."_id") AND b."cancelo" = false
      WHERE c."cicloId" = $1`,
    [cicloId]
  );
  return r?.n || 0;
}

/**
 * Reabre un ciclo GENERADO para poder editarlo: borra TODOS sus eventos del
 * calendario (y sus bookings) y lo vuelve a BORRADOR. Bloquea si hay inscritos
 * activos (deben cancelarse en Agrupación primero). Idempotente si ya es BORRADOR.
 */
export async function reabrirCiclo(cicloId: string): Promise<CicloRow> {
  const ciclo = await getCiclo(cicloId);
  if (!ciclo) throw new NotFoundError('EXAM_CICLOS', cicloId);
  if (ciclo.estado !== 'GENERADO') return ciclo;
  const inscritos = await countInscritosCiclo(cicloId);
  if (inscritos > 0) {
    throw new ConflictError(`No se puede reabrir: el ciclo tiene ${inscritos} inscrito(s) activo(s). Cancélalos en Agrupación primero.`);
  }
  await withTransaction(async (client) => {
    const ev = await client.query(`SELECT "_id" FROM "CALENDARIO" WHERE "cicloId" = $1`, [cicloId]);
    const ids = ev.rows.map((r: any) => r._id);
    if (ids.length) {
      await client.query(`DELETE FROM "ACADEMICA_BOOKINGS" WHERE COALESCE("eventoId", "idEvento") = ANY($1::text[])`, [ids]);
      await client.query(`DELETE FROM "CALENDARIO" WHERE "cicloId" = $1`, [cicloId]);
    }
    await client.query(
      `UPDATE "EXAM_CICLOS" SET "estado" = 'BORRADOR', "eventosGenerados" = 0, "_updatedDate" = NOW() WHERE "_id" = $1`,
      [cicloId]
    );
  });
  const updated = await getCiclo(cicloId);
  return updated!;
}

/**
 * Borra un ciclo y TODOS sus eventos generados (y sus bookings). Bloquea si hay
 * inscritos activos.
 */
export async function deleteCiclo(cicloId: string): Promise<{ eventosBorrados: number }> {
  const ciclo = await getCiclo(cicloId);
  if (!ciclo) throw new NotFoundError('EXAM_CICLOS', cicloId);
  const inscritos = await countInscritosCiclo(cicloId);
  if (inscritos > 0) {
    throw new ConflictError(`No se puede borrar: el ciclo tiene ${inscritos} inscrito(s) activo(s). Cancélalos en Agrupación primero.`);
  }
  let eventosBorrados = 0;
  await withTransaction(async (client) => {
    const ev = await client.query(`SELECT "_id" FROM "CALENDARIO" WHERE "cicloId" = $1`, [cicloId]);
    const ids = ev.rows.map((r: any) => r._id);
    if (ids.length) {
      await client.query(`DELETE FROM "ACADEMICA_BOOKINGS" WHERE COALESCE("eventoId", "idEvento") = ANY($1::text[])`, [ids]);
      await client.query(`DELETE FROM "CALENDARIO" WHERE "cicloId" = $1`, [cicloId]);
    }
    eventosBorrados = ids.length;
    await client.query(`DELETE FROM "EXAM_CICLOS" WHERE "_id" = $1`, [cicloId]);
  });
  return { eventosBorrados };
}

// ── Agrupación: pool de confirmados ────────────────────────────────────────

export interface AgrupacionRow {
  studentId: string;            // ACADEMICA._id
  numeroId: string | null;
  primerNombre: string | null;
  primerApellido: string | null;
  email: string | null;
  celular: string | null;
  plataforma: string | null;
  nivel: string | null;
  step: string | null;
  programas: string[];          // ej. ['IELTS','TOEFL'] (colisión si >1)
}

export async function listAgrupacion(opts: { search?: string | null }): Promise<AgrupacionRow[]> {
  const params: any[] = [];
  let searchClause = '';
  const search = (opts.search || '').trim();
  if (search) {
    params.push(`%${search}%`);
    searchClause = `AND (LOWER(a."primerApellido") LIKE LOWER($1)
                      OR LOWER(a."primerNombre") LIKE LOWER($1)
                      OR a."numeroId" LIKE $1)`;
  }
  return queryMany<AgrupacionRow>(
    `SELECT a."_id" AS "studentId", a."numeroId", a."primerNombre", a."primerApellido",
            a."email", a."celular", a."plataforma", a."nivel", a."step",
            progs."programas"
       FROM (
         SELECT "studentId", ARRAY_AGG(DISTINCT "prueba" ORDER BY "prueba") AS "programas"
           FROM "EXAM_INTERN_AUDIT"
          WHERE "accion" = 'EXTENDIDO'
          GROUP BY "studentId"
       ) progs
       JOIN "ACADEMICA" a ON a."_id" = progs."studentId"
      WHERE TRUE ${searchClause}
      ORDER BY a."primerApellido" ASC NULLS LAST, a."primerNombre" ASC NULLS LAST`,
    params
  );
}

// ── Agrupación: eventos del ciclo (dropdown) ───────────────────────────────

export interface EventoCicloRow {
  _id: string;
  nivel: string | null;
  step: string | null;
  fecha: string | null;
  hora: string | null;
  dia: string | null;
  limiteUsuarios: number | null;
  inscritos: number | null;
  advisor: string | null;
  advisorNombre: string | null;
}

export async function listEventosCiclo(cicloId: string): Promise<EventoCicloRow[]> {
  return queryMany<EventoCicloRow>(
    `SELECT c."_id", c."nivel", c."step", c."fecha"::text AS "fecha", c."hora", c."dia",
            c."limiteUsuarios", c."inscritos", c."advisor",
            ad."nombreCompleto" AS "advisorNombre"
       FROM "CALENDARIO" c
       LEFT JOIN "ADVISORS" ad ON c."advisor" = ad."_id"
      WHERE c."cicloId" = $1
      ORDER BY c."dia" ASC`,
    [cicloId]
  );
}

// ── Agrupación: roster de un evento (con estado por inscripción) ───────────

export type EstadoInscripcion = 'CONFIRMADO' | 'PENDIENTE' | 'CANCELADO';

export interface RosterRow {
  studentId: string;
  bookingId: string;
  primerNombre: string | null;
  primerApellido: string | null;
  numeroId: string | null;
  celular: string | null;
  nivel: string | null;
  estado: EstadoInscripcion;
}

export async function listRoster(eventoId: string): Promise<RosterRow[]> {
  const rows = await queryMany<any>(
    `SELECT DISTINCT ON (COALESCE(b."studentId", b."idEstudiante"))
            COALESCE(b."studentId", b."idEstudiante") AS "studentId",
            b."_id" AS "bookingId",
            b."primerNombre", b."primerApellido", b."numeroId", b."celular", b."nivel",
            b."cancelo", b."confirmadoExamen"
       FROM "ACADEMICA_BOOKINGS" b
      WHERE (b."eventoId" = $1 OR b."idEvento" = $1)
      ORDER BY COALESCE(b."studentId", b."idEstudiante"),
               (b."cancelo" IS TRUE) ASC,
               b."_createdDate" DESC`,
    [eventoId]
  );
  return rows.map((r) => ({
    studentId: r.studentId,
    bookingId: r.bookingId,
    primerNombre: r.primerNombre,
    primerApellido: r.primerApellido,
    numeroId: r.numeroId,
    celular: r.celular,
    nivel: r.nivel,
    estado: (r.cancelo === true
      ? 'CANCELADO'
      : r.confirmadoExamen === true
        ? 'CONFIRMADO'
        : 'PENDIENTE') as EstadoInscripcion,
  }));
}

// ── Agrupación: agendamiento masivo ────────────────────────────────────────

export interface AgendarOpts {
  eventoId: string;
  studentIds: string[];
  agendadoPor?: string;
  agendadoPorEmail?: string;
  agendadoPorRol?: string;
  sessionRole?: string;
}

export async function agendarMasivo(opts: AgendarOpts): Promise<{ enrolled: number; yaInscritos: number }> {
  const eventoId = String(opts.eventoId || '');
  const studentIds = Array.isArray(opts.studentIds) ? opts.studentIds.map(String).filter(Boolean) : [];
  if (!eventoId) throw new ValidationError('eventoId es requerido');
  if (studentIds.length === 0) throw new ValidationError('Selecciona al menos un estudiante');

  // Excluir los que ya están inscritos ACTIVOS en el evento (evita que un
  // duplicado aborte todo el lote — enrollStudents es all-or-nothing).
  const existing = await queryMany<{ sid: string }>(
    `SELECT DISTINCT COALESCE("studentId", "idEstudiante") AS sid
       FROM "ACADEMICA_BOOKINGS"
      WHERE ("eventoId" = $1 OR "idEvento" = $1) AND "cancelo" = false
        AND COALESCE("studentId", "idEstudiante") = ANY($2::text[])`,
    [eventoId, studentIds]
  );
  const already = new Set(existing.map((r) => r.sid));
  const toEnroll = studentIds.filter((id) => !already.has(id));

  if (toEnroll.length === 0) return { enrolled: 0, yaInscritos: already.size };

  const r = await enrollStudents({
    eventId: eventoId,
    studentIds: toEnroll,
    agendadoPor: opts.agendadoPor,
    agendadoPorEmail: opts.agendadoPorEmail,
    agendadoPorRol: opts.agendadoPorRol,
    sessionRole: opts.sessionRole,
  });
  return { enrolled: r.enrolled, yaInscritos: already.size };
}

// ── Agrupación: cambiar estado de una inscripción ──────────────────────────

export interface SetEstadoOpts {
  eventoId: string;
  studentId: string;
  estado: string;
  agendadoPor?: string;
  agendadoPorEmail?: string;
  agendadoPorRol?: string;
  sessionRole?: string;
}

export async function setEstadoInscripcion(opts: SetEstadoOpts): Promise<{ estado: EstadoInscripcion }> {
  const eventoId = String(opts.eventoId || '');
  const studentId = String(opts.studentId || '');
  const estado = String(opts.estado || '').toUpperCase() as EstadoInscripcion;
  if (!eventoId || !studentId) throw new ValidationError('eventoId y studentId son requeridos');
  if (!['CONFIRMADO', 'PENDIENTE', 'CANCELADO'].includes(estado)) {
    throw new ValidationError(`estado inválido: ${estado}`);
  }

  if (estado === 'CANCELADO') {
    // Soft-cancel: la fila queda cancelo=true (visible en el roster) y libera el cupo.
    await withTransaction(async (client) => {
      const r = await client.query(
        `SELECT "_id" FROM "ACADEMICA_BOOKINGS"
          WHERE ("eventoId" = $1 OR "idEvento" = $1)
            AND ("studentId" = $2 OR "idEstudiante" = $2)
            AND "cancelo" = false
          ORDER BY "_createdDate" DESC LIMIT 1`,
        [eventoId, studentId]
      );
      if (!r.rows[0]) return; // ya cancelado / no inscrito
      await client.query(
        `UPDATE "ACADEMICA_BOOKINGS" SET "cancelo" = true, "confirmadoExamen" = false, "_updatedDate" = NOW() WHERE "_id" = $1`,
        [r.rows[0]._id]
      );
      await client.query(
        `UPDATE "CALENDARIO" SET "inscritos" = GREATEST("inscritos" - 1, 0), "_updatedDate" = NOW() WHERE "_id" = $1`,
        [eventoId]
      );
    });
    return { estado };
  }

  // CONFIRMADO / PENDIENTE — asegurar booking activo (re-inscribe si estaba cancelado).
  const flag = estado === 'CONFIRMADO';
  const active = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "ACADEMICA_BOOKINGS"
      WHERE ("eventoId" = $1 OR "idEvento" = $1)
        AND ("studentId" = $2 OR "idEstudiante" = $2)
        AND "cancelo" = false
      LIMIT 1`,
    [eventoId, studentId]
  );
  if (!active) {
    // Re-inscribe respetando cupo/duplicados/inactivos.
    await enrollStudents({
      eventId: eventoId,
      studentIds: [studentId],
      agendadoPor: opts.agendadoPor,
      agendadoPorEmail: opts.agendadoPorEmail,
      agendadoPorRol: opts.agendadoPorRol,
      sessionRole: opts.sessionRole,
    });
  }
  await query(
    `UPDATE "ACADEMICA_BOOKINGS" SET "confirmadoExamen" = $1, "_updatedDate" = NOW()
      WHERE ("eventoId" = $2 OR "idEvento" = $2)
        AND ("studentId" = $3 OR "idEstudiante" = $3)
        AND "cancelo" = false`,
    [flag, eventoId, studentId]
  );
  return { estado };
}

// ── Agrupación por CURSO (serie de eventos del mismo examen) ────────────────
//
// Un "curso" = todos los eventos de un mismo examen (nivel) dentro del ciclo —
// las N franjas y todas las fechas. Al agendar/confirmar/cancelar se aplica a
// TODA la serie, no a una sola sesión.

export interface CursoCicloRow {
  examen: string;          // nivel (IELTS/TOEFL/B2FIRST)
  advisores: string;       // nombres distintos de advisor (join ', ')
  totalEventos: number;    // sesiones de la serie
  franjas: number;         // horas distintas
  inscritos: number;       // estudiantes distintos con inscripción activa
}

export async function listCursosCiclo(cicloId: string): Promise<CursoCicloRow[]> {
  const rows = await queryMany<any>(
    `SELECT c."nivel" AS examen,
            COUNT(*)::int AS "totalEventos",
            COUNT(DISTINCT c."hora")::int AS franjas,
            STRING_AGG(DISTINCT COALESCE(ad."nombreCompleto", c."advisor"), ', ') AS advisores
       FROM "CALENDARIO" c
       LEFT JOIN "ADVISORS" ad ON c."advisor" = ad."_id"
      WHERE c."cicloId" = $1
      GROUP BY c."nivel"
      ORDER BY c."nivel" ASC`,
    [cicloId]
  );
  const insc = await queryMany<{ examen: string; n: number }>(
    `SELECT c."nivel" AS examen,
            COUNT(DISTINCT COALESCE(b."studentId", b."idEstudiante"))::int AS n
       FROM "CALENDARIO" c
       JOIN "ACADEMICA_BOOKINGS" b
         ON (b."eventoId" = c."_id" OR b."idEvento" = c."_id") AND b."cancelo" = false
      WHERE c."cicloId" = $1
      GROUP BY c."nivel"`,
    [cicloId]
  );
  const map = new Map(insc.map((r) => [r.examen, Number(r.n)]));
  return rows.map((r) => ({
    examen: r.examen,
    advisores: r.advisores || '',
    totalEventos: Number(r.totalEventos) || 0,
    franjas: Number(r.franjas) || 0,
    inscritos: map.get(r.examen) || 0,
  }));
}

/** Ids de los eventos de un curso (ciclo + examen), ordenados por fecha. */
async function eventoIdsDeCurso(cicloId: string, examen: string): Promise<string[]> {
  const rows = await queryMany<{ _id: string }>(
    `SELECT "_id" FROM "CALENDARIO" WHERE "cicloId" = $1 AND "nivel" = $2 ORDER BY "dia" ASC`,
    [cicloId, examen]
  );
  return rows.map((r) => r._id);
}

export interface AgendarSerieOpts {
  cicloId: string;
  examen: string;
  studentIds: string[];
  agendadoPor?: string;
  agendadoPorEmail?: string;
  agendadoPorRol?: string;
  sessionRole?: string;
}

/** Inscribe a los estudiantes en TODA la serie de eventos del curso. */
export async function agendarSerieCurso(opts: AgendarSerieOpts): Promise<{ eventos: number; enrolled: number }> {
  const cicloId = String(opts.cicloId || '');
  const examen = String(opts.examen || '');
  const studentIds = Array.isArray(opts.studentIds) ? opts.studentIds.map(String).filter(Boolean) : [];
  if (!cicloId || !examen) throw new ValidationError('cicloId y examen son requeridos');
  if (studentIds.length === 0) throw new ValidationError('Selecciona al menos un estudiante');

  const eventoIds = await eventoIdsDeCurso(cicloId, examen);
  if (eventoIds.length === 0) throw new ValidationError('El curso no tiene eventos generados.');

  let enrolled = 0;
  for (const eventoId of eventoIds) {
    const r = await agendarMasivo({
      eventoId,
      studentIds,
      agendadoPor: opts.agendadoPor,
      agendadoPorEmail: opts.agendadoPorEmail,
      agendadoPorRol: opts.agendadoPorRol,
      sessionRole: opts.sessionRole,
    });
    enrolled += r.enrolled;
  }
  return { eventos: eventoIds.length, enrolled };
}

/** Roster del curso: 1 fila por estudiante con su estado en la serie. */
export async function listRosterCurso(cicloId: string, examen: string): Promise<RosterRow[]> {
  const rows = await queryMany<any>(
    `SELECT COALESCE(b."studentId", b."idEstudiante") AS "studentId",
            MAX(b."primerNombre")   AS "primerNombre",
            MAX(b."primerApellido") AS "primerApellido",
            MAX(b."numeroId")       AS "numeroId",
            MAX(b."celular")        AS "celular",
            MAX(b."nivel")          AS "nivel",
            bool_or(b."cancelo" = false) AS "tieneActivo",
            bool_or(b."cancelo" = false AND (b."confirmadoExamen" IS DISTINCT FROM true)) AS "algunPendiente"
       FROM "CALENDARIO" c
       JOIN "ACADEMICA_BOOKINGS" b ON (b."eventoId" = c."_id" OR b."idEvento" = c."_id")
      WHERE c."cicloId" = $1 AND c."nivel" = $2
      GROUP BY COALESCE(b."studentId", b."idEstudiante")
      ORDER BY MAX(b."primerApellido") ASC NULLS LAST, MAX(b."primerNombre") ASC NULLS LAST`,
    [cicloId, examen]
  );
  return rows.map((r) => ({
    studentId: r.studentId,
    bookingId: '',
    primerNombre: r.primerNombre,
    primerApellido: r.primerApellido,
    numeroId: r.numeroId,
    celular: r.celular,
    nivel: r.nivel,
    estado: (!r.tieneActivo
      ? 'CANCELADO'
      : r.algunPendiente
        ? 'PENDIENTE'
        : 'CONFIRMADO') as EstadoInscripcion,
  }));
}

export interface SetEstadoSerieOpts {
  cicloId: string;
  examen: string;
  studentId: string;
  estado: string;
  agendadoPor?: string;
  agendadoPorEmail?: string;
  agendadoPorRol?: string;
  sessionRole?: string;
}

/** Marca el estado de un estudiante en TODA la serie del curso. */
export async function setEstadoInscripcionSerie(opts: SetEstadoSerieOpts): Promise<{ estado: EstadoInscripcion }> {
  const cicloId = String(opts.cicloId || '');
  const examen = String(opts.examen || '');
  const studentId = String(opts.studentId || '');
  const estado = String(opts.estado || '').toUpperCase() as EstadoInscripcion;
  if (!cicloId || !examen || !studentId) throw new ValidationError('cicloId, examen y studentId son requeridos');
  if (!['CONFIRMADO', 'PENDIENTE', 'CANCELADO'].includes(estado)) {
    throw new ValidationError(`estado inválido: ${estado}`);
  }

  const eventoIds = await eventoIdsDeCurso(cicloId, examen);
  if (eventoIds.length === 0) throw new ValidationError('El curso no tiene eventos.');

  if (estado === 'CANCELADO') {
    // Soft-cancel de TODAS las inscripciones activas del estudiante en la serie.
    await withTransaction(async (client) => {
      const active = await client.query(
        `SELECT "_id", COALESCE("eventoId", "idEvento") AS eid
           FROM "ACADEMICA_BOOKINGS"
          WHERE COALESCE("eventoId", "idEvento") = ANY($1::text[])
            AND ("studentId" = $2 OR "idEstudiante" = $2)
            AND "cancelo" = false`,
        [eventoIds, studentId]
      );
      for (const row of active.rows) {
        await client.query(
          `UPDATE "ACADEMICA_BOOKINGS" SET "cancelo" = true, "confirmadoExamen" = false, "_updatedDate" = NOW() WHERE "_id" = $1`,
          [row._id]
        );
        await client.query(
          `UPDATE "CALENDARIO" SET "inscritos" = GREATEST("inscritos" - 1, 0), "_updatedDate" = NOW() WHERE "_id" = $1`,
          [row.eid]
        );
      }
    });
    return { estado };
  }

  // CONFIRMADO / PENDIENTE — asegurar inscripción en toda la serie, luego marcar el flag.
  const flag = estado === 'CONFIRMADO';
  await agendarSerieCurso({
    cicloId,
    examen,
    studentIds: [studentId],
    agendadoPor: opts.agendadoPor,
    agendadoPorEmail: opts.agendadoPorEmail,
    agendadoPorRol: opts.agendadoPorRol,
    sessionRole: opts.sessionRole,
  });
  await query(
    `UPDATE "ACADEMICA_BOOKINGS" SET "confirmadoExamen" = $1, "_updatedDate" = NOW()
      WHERE COALESCE("eventoId", "idEvento") = ANY($2::text[])
        AND ("studentId" = $3 OR "idEstudiante" = $3)
        AND "cancelo" = false`,
    [flag, eventoIds, studentId]
  );
  return { estado };
}
