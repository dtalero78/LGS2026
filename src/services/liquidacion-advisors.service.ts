/**
 * Administración › Gestión Advisors — cálculo de la liquidación (Fase 2, programa LGS).
 *
 * Reglas (docs/specs/gestion-advisors.md, validadas contra la hoja de oct-2026):
 *  - Fuente: CALENDARIO (eventos ya ocurridos del advisor) + ADMIN_EVENTS registrados.
 *  - El mes / la semana / la quincena de un evento se toman en la HORA LOCAL del país
 *    de pago del advisor (Chile / Colombia / Ecuador).
 *  - Eventos compartidos (mismo `eventoCompartidoId`, varios niveles a la misma hora)
 *    = 1 sola hora y nunca "sin asistentes" (misma regla que Control Horas).
 *  - 1 evento = 1 h; sin asistentes = 0,5 h solo para POR_HORAS.
 *  - Concepto: EXAM_INTERN (ciclo de examen / niveles IELTS-TOEFL-B2FIRST) › FESTIVO
 *    (festivo del país del advisor, src/data/festivos.json) › NORMAL.
 *  - Eventos administrativos registrados suman sus horas (concepto NORMAL), como la hoja.
 *  - Reparto entre países (CL / CO / EC; Perú suma a Ecuador): plataforma de los
 *    asistentes › de los inscritos › país del advisor. Lo administrativo y los fijos se
 *    reparten en la proporción de las clases dictadas por el advisor.
 *  - Valor: POR_HORAS = horas × tarifa del concepto; SEMIPLANTA = valor fijo + extras
 *    autorizadas (ajustes, Fase 4); PLANTA = valor fijo (solo reporte de horas).
 */

import 'server-only';
import { queryMany } from '@/lib/postgres';
import { ValidationError } from '@/lib/errors';
import FESTIVOS from '@/data/festivos.json';
import { grupoPagoDe, MONEDA_POR_PAIS, PAISES_PAGO } from '@/services/gestion-advisors.service';

export type Pais = 'Chile' | 'Colombia' | 'Ecuador';
export const TIPOS_CLASE = ['sesiones', 'jumps', 'training', 'clubes', 'welcome', 'essential', 'examen', 'otros', 'administrativas'] as const;
export type TipoClase = typeof TIPOS_CLASE[number];
export type Concepto = 'NORMAL' | 'FESTIVO' | 'EXAM_INTERN';

const TZ: Record<Pais, string> = { Chile: 'America/Santiago', Colombia: 'America/Bogota', Ecuador: 'America/Guayaquil' };
const CODIGO: Record<Pais, string> = { Chile: 'CL', Colombia: 'CO', Ecuador: 'EC' };
const EXAMENES = new Set(['IELTS', 'TOEFL', 'B2FIRST', 'B2 FIRST']);

type PorTipo = Record<TipoClase, number>;
type PorPais = Record<Pais, number>;
const ceroTipo = (): PorTipo => Object.fromEntries(TIPOS_CLASE.map((t) => [t, 0])) as PorTipo;
const ceroPais = (): PorPais => ({ Chile: 0, Colombia: 0, Ecuador: 0 });
const r2 = (n: number) => Math.round(n * 100) / 100;

/** País de pago de un alumno (Perú → Ecuador). */
function paisAlumno(plataforma: string | null | undefined): Pais | null {
  const p = String(plataforma || '').toLowerCase();
  if (p.startsWith('chile')) return 'Chile';
  if (p.startsWith('colom')) return 'Colombia';
  if (p.startsWith('ecua') || p.startsWith('per')) return 'Ecuador';
  return null;
}

function fechaLocal(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function esFestivo(fecha: string, pais: Pais): string | null {
  const lista = (FESTIVOS as Record<string, { c: string; n: string }[]>)[fecha] || [];
  return lista.find((f) => f.c === CODIGO[pais])?.n || null;
}

/** Clasificación del evento (misma que el informe Horas Advisor) + examen. */
function tipoClase(e: { tipo: string | null; nivel: string | null; step: string | null; titulo: string | null; cicloId: string | null }): TipoClase {
  const tipo = String(e.tipo || '').toUpperCase();
  const nivel = String(e.nivel || '').toUpperCase();
  const titulo = String(e.titulo || '').toUpperCase();
  if (e.cicloId || EXAMENES.has(nivel)) return 'examen';
  if (nivel === 'ESS' && tipo === 'SESSION') return 'essential';
  if (nivel === 'WELCOME' || tipo === 'WELCOME' || titulo.includes('WELCOME')) return 'welcome';
  if (tipo === 'CLUB') return titulo.startsWith('TRAINING -') ? 'training' : 'clubes';
  if (tipo === 'SESSION') {
    const n = parseInt(String(e.step || '').replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > 0 && n % 5 === 0 ? 'jumps' : 'sesiones';
  }
  return 'otros';
}

// ── Semanas (lunes–domingo, cortadas en el borde del mes) ────────────────────

export interface Semana { n: number; inicio: string; fin: string }

export function semanasDelMes(periodo: string): Semana[] {
  const [y, m] = periodo.split('-').map(Number);
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: Semana[] = [];
  let ini = 1;
  for (let d = 1; d <= dias; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
    if (dow === 0 || d === dias) {
      const f = (x: number) => `${periodo}-${String(x).padStart(2, '0')}`;
      out.push({ n: out.length + 1, inicio: f(ini), fin: f(d) });
      ini = d + 1;
    }
  }
  return out;
}

// ── Resultado ────────────────────────────────────────────────────────────────

export interface EventoLiq {
  eventoId: string; fecha: string; hora: string | null; semana: number; quincena: 1 | 2;
  tipo: TipoClase; concepto: Concepto; horas: number; titulo: string;
  inscritos: number; asistentes: number; sinAsistentes: boolean; compartido: boolean; cerrada: boolean;
  festivo: string | null; reparto: PorPais;
}

export interface AdvisorLiq {
  advisorId: string; nombre: string; email: string | null; activo: boolean;
  pais: Pais; tipoContratacion: string; categoriaTarifa: string; programa: string;
  porTipo: PorTipo; porConcepto: Record<Concepto, number>; sinAsistentes: number;
  semanas: { n: number; total: number; porTipo: PorTipo }[];
  quincenas: { q1: number; q2: number };
  total: number; reparto: PorPais;
  noPagadas: { canceladas: number; suspendidas: number; noAsistio: number };
  valor: null | {
    moneda: string; normal: number; festivo: number; exam: number; fijo: number; total: number;
    reparto: PorPais; tarifas: Partial<Record<Concepto, number>>; faltanTarifas: Concepto[];
  };
  eventos?: EventoLiq[];
}

export interface Liquidacion {
  periodo: string; parcial: boolean; semanas: Semana[]; advisors: AdvisorLiq[];
  tipoCambio: { COP: number | null; CLP: number | null; fecha: string | null; fuente: string | null };
}

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function calcularLiquidacion(periodo: string, opts: { verValores: boolean; advisorId?: string | null }): Promise<Liquidacion> {
  if (!PERIODO_RE.test(periodo)) throw new ValidationError('Periodo inválido (AAAA-MM).');
  const [y, m] = periodo.split('-').map(Number);
  const desdeUTC = new Date(Date.UTC(y, m - 1, 1) - 36 * 3600e3).toISOString();  // margen por zonas horarias
  const hastaUTC = new Date(Date.UTC(y, m, 1) + 36 * 3600e3).toISOString();
  const ahora = new Date();
  const finMes = new Date(Date.UTC(y, m, 1));
  const parcial = ahora < finMes;
  const semanas = semanasDelMes(periodo);
  const semanaDe = (fecha: string) => semanas.find((s) => fecha >= s.inicio && fecha <= s.fin)?.n || 1;

  const advisors = await queryMany<any>(
    `SELECT "_id", COALESCE(NULLIF(TRIM("nombreCompleto"), ''), TRIM(CONCAT("primerNombre", ' ', "primerApellido"))) AS nombre,
            "email", "pais", COALESCE("activo", false) AS activo, "tipoContratacion", "categoriaTarifa", "programa", "grupoPago",
            "valorFijoMensual"
       FROM "ADVISORS" WHERE "programa" IN ('LGS', 'AMBOS') ${opts.advisorId ? `AND "_id" = $1` : ''}`,
    opts.advisorId ? [opts.advisorId] : []);
  const advPorId = new Map<string, any>();
  for (const a of advisors) { const g = grupoPagoDe(a); if (g) advPorId.set(a._id, { ...a, grupo: g as Pais }); }
  const ids = Array.from(advPorId.keys());
  if (!ids.length) return { periodo, parcial, semanas, advisors: [], tipoCambio: await tipoCambioDe(periodo) };

  const [eventos, admin, logs] = await Promise.all([
    queryMany<any>(
      `SELECT c."_id", c."advisor", c."dia", c."hora", c."tipo", c."nivel", c."step", c."cicloId", c."eventoCompartidoId",
              COALESCE(c."sesionCerrada", false) AS cerrada,
              COALESCE(c."tituloONivel", c."titulo", c."nombreEvento") AS titulo
         FROM "CALENDARIO" c
        WHERE c."advisor" = ANY($1::text[]) AND c."dia" >= $2::timestamptz AND c."dia" < $3::timestamptz AND c."dia" <= NOW()`,
      [ids, desdeUTC, hastaUTC]),
    queryMany<any>(
      `SELECT "advisorId", "fechaInicio", "horas" FROM "ADMIN_EVENTS"
        WHERE "advisorId" = ANY($1::text[]) AND "registrado" = true
          AND "fechaInicio" >= $2::timestamptz AND "fechaInicio" < $3::timestamptz AND "fechaInicio" <= NOW()`,
      [ids, desdeUTC, hastaUTC]),
    queryMany<any>(
      `SELECT "advisorId", "fechaEvento", "estado" FROM "ADVISOR_EVENT_LOG"
        WHERE "advisorId" = ANY($1::text[]) AND "fechaEvento" >= $2::timestamptz AND "fechaEvento" < $3::timestamptz`,
      [ids, desdeUTC, hastaUTC]),
  ]);

  // Inscritos / asistentes por evento y plataforma del alumno (una consulta)
  const evIds = eventos.map((e) => e._id);
  const bk = evIds.length ? await queryMany<any>(
    `SELECT COALESCE(b."eventoId", b."idEvento") AS ev,
            COALESCE(ac."plataforma", b."plataforma") AS plataforma,
            COUNT(*) FILTER (WHERE b."cancelo" IS NOT TRUE)::int AS insc,
            COUNT(*) FILTER (WHERE b."asistio" = true)::int AS asis
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "ACADEMICA" ac ON ac."_id" = COALESCE(b."studentId", b."idEstudiante")
      WHERE b."eventoId" = ANY($1::text[]) OR b."idEvento" = ANY($1::text[])
      GROUP BY 1, 2`, [evIds]) : [];
  const bkPorEv = new Map<string, { insc: PorPais; asis: PorPais; inscT: number; asisT: number }>();
  for (const r of bk) {
    const x = bkPorEv.get(r.ev) || { insc: ceroPais(), asis: ceroPais(), inscT: 0, asisT: 0 };
    const p = paisAlumno(r.plataforma);
    if (p) { x.insc[p] += r.insc; x.asis[p] += r.asis; }
    x.inscT += r.insc; x.asisT += r.asis;
    bkPorEv.set(r.ev, x);
  }

  // Agrupar eventos compartidos y filtrar al mes en hora local del advisor
  type Grupo = { a: any; fecha: string; hora: string | null; filas: any[]; insc: PorPais; asis: PorPais; inscT: number; asisT: number; compartido: boolean; cerrada: boolean };
  const grupos = new Map<string, Grupo>();
  for (const e of eventos) {
    const a = advPorId.get(e.advisor);
    if (!a) continue;
    const fecha = fechaLocal(new Date(e.dia), TZ[a.grupo as Pais]);
    if (!fecha.startsWith(periodo)) continue;
    const k = `${e.advisor}|${e.eventoCompartidoId || e._id}`;
    const b = bkPorEv.get(e._id) || { insc: ceroPais(), asis: ceroPais(), inscT: 0, asisT: 0 };
    const g = grupos.get(k);
    if (!g) {
      grupos.set(k, { a, fecha, hora: e.hora || null, filas: [e], insc: { ...b.insc }, asis: { ...b.asis }, inscT: b.inscT, asisT: b.asisT, compartido: !!e.eventoCompartidoId, cerrada: e.cerrada });
    } else {
      g.filas.push(e); g.inscT += b.inscT; g.asisT += b.asisT; g.cerrada ||= e.cerrada;
      for (const p of PAISES_PAGO) { g.insc[p as Pais] += b.insc[p as Pais]; g.asis[p as Pais] += b.asis[p as Pais]; }
    }
  }

  const res = new Map<string, AdvisorLiq & { _eventos: EventoLiq[] }>();
  const base = (a: any) => {
    let r = res.get(a._id);
    if (!r) {
      r = {
        advisorId: a._id, nombre: a.nombre || a._id, email: a.email || null, activo: !!a.activo, pais: a.grupo,
        tipoContratacion: a.tipoContratacion, categoriaTarifa: a.categoriaTarifa, programa: a.programa,
        porTipo: ceroTipo(), porConcepto: { NORMAL: 0, FESTIVO: 0, EXAM_INTERN: 0 }, sinAsistentes: 0,
        semanas: semanas.map((s) => ({ n: s.n, total: 0, porTipo: ceroTipo() })), quincenas: { q1: 0, q2: 0 },
        total: 0, reparto: ceroPais(), noPagadas: { canceladas: 0, suspendidas: 0, noAsistio: 0 }, valor: null, _eventos: [],
      };
      res.set(a._id, r);
    }
    return r;
  };
  const sumar = (r: AdvisorLiq, fecha: string, tipo: TipoClase, concepto: Concepto, horas: number) => {
    r.porTipo[tipo] += horas; r.porConcepto[concepto] += horas; r.total += horas;
    const s = r.semanas[semanaDe(fecha) - 1]; s.total += horas; s.porTipo[tipo] += horas;
    if (Number(fecha.slice(8, 10)) <= 15) r.quincenas.q1 += horas; else r.quincenas.q2 += horas;
  };

  for (const g of grupos.values()) {
    const a = g.a; const pais = a.grupo as Pais; const r = base(a);
    const e0 = g.filas[0];
    const tipo = tipoClase({ tipo: e0.tipo, nivel: e0.nivel, step: e0.step, titulo: e0.titulo, cicloId: e0.cicloId });
    const sinAsis = g.asisT === 0 && !g.compartido;
    const horas = sinAsis && a.tipoContratacion === 'POR_HORAS' ? 0.5 : 1;
    const festivo = esFestivo(g.fecha, pais);
    const concepto: Concepto = tipo === 'examen' ? 'EXAM_INTERN' : festivo ? 'FESTIVO' : 'NORMAL';
    // Reparto: asistentes › inscritos › país del advisor
    const fuente = g.asisT > 0 ? g.asis : g.inscT > 0 ? g.insc : null;
    const totalFuente = fuente ? PAISES_PAGO.reduce((s, p) => s + fuente[p as Pais], 0) : 0;
    const reparto = ceroPais();
    if (fuente && totalFuente > 0) for (const p of PAISES_PAGO) reparto[p as Pais] = fuente[p as Pais] / totalFuente;
    else reparto[pais] = 1;
    sumar(r, g.fecha, tipo, concepto, horas);
    if (sinAsis) r.sinAsistentes++;
    for (const p of PAISES_PAGO) r.reparto[p as Pais] += horas * reparto[p as Pais];
    r._eventos.push({
      eventoId: e0._id, fecha: g.fecha, hora: g.hora, semana: semanaDe(g.fecha), quincena: Number(g.fecha.slice(8, 10)) <= 15 ? 1 : 2,
      tipo, concepto, horas, titulo: [e0.titulo, e0.step].filter(Boolean).join(' · ') + (g.filas.length > 1 ? ` (+${g.filas.length - 1} niveles)` : ''),
      inscritos: g.inscT, asistentes: g.asisT, sinAsistentes: sinAsis, compartido: g.compartido, cerrada: g.cerrada,
      festivo, reparto,
    });
  }

  // Administrativas: horas registradas, reparto en la proporción de sus clases
  for (const x of admin) {
    const a = advPorId.get(x.advisorId); if (!a) continue;
    const fecha = fechaLocal(new Date(x.fechaInicio), TZ[a.grupo as Pais]);
    if (!fecha.startsWith(periodo)) continue;
    const r = base(a); const h = Number(x.horas) || 0; if (!h) continue;
    const clases = r.total;
    sumar(r, fecha, 'administrativas', 'NORMAL', h);
    if (clases > 0) for (const p of PAISES_PAGO) r.reparto[p as Pais] += h * (r.reparto[p as Pais] / clases);
    else r.reparto[a.grupo as Pais] += h;
  }

  for (const l of logs) {
    const a = advPorId.get(l.advisorId); if (!a) continue;
    if (!fechaLocal(new Date(l.fechaEvento), TZ[a.grupo as Pais]).startsWith(periodo)) continue;
    const r = base(a);
    if (l.estado === 'Canceled') r.noPagadas.canceladas++;
    else if (l.estado === 'Suspended') r.noPagadas.suspendidas++;
    else if (l.estado === 'NoAsistio') r.noPagadas.noAsistio++;
  }

  // Valores
  if (opts.verValores) {
    const tarifas = await queryMany<any>(
      `SELECT DISTINCT ON ("pais", "programa", "tipo", "categoria", "concepto")
              "pais", "programa", "tipo", "categoria", "concepto", "valor", "moneda"
         FROM "TARIFAS_ADVISOR" WHERE "activo" = true AND "programa" = 'LGS' AND "vigenteDesde" <= $1::date
        ORDER BY "pais", "programa", "tipo", "categoria", "concepto", "vigenteDesde" DESC`, [`${periodo}-01`]);
    const tarifa = (pais: string, tipo: string, categoria: string, concepto: Concepto) => {
      const t = tarifas.find((x) => x.pais === pais && x.tipo === tipo && x.categoria === categoria && x.concepto === concepto)
        || tarifas.find((x) => x.pais === pais && x.tipo === tipo && x.categoria === 'ESTANDAR' && x.concepto === concepto);
      return t ? Number(t.valor) : null;
    };
    for (const r of res.values()) {
      const a = advPorId.get(r.advisorId);
      const moneda = MONEDA_POR_PAIS[r.pais];
      const tipoTarifa = r.tipoContratacion === 'SEMIPLANTA' ? 'SEMIPLANTA' : 'POR_HORAS';
      const ts: Partial<Record<Concepto, number>> = {};
      const faltan: Concepto[] = [];
      for (const c of ['NORMAL', 'FESTIVO', 'EXAM_INTERN'] as Concepto[]) {
        const v = tarifa(r.pais, tipoTarifa, r.categoriaTarifa, c);
        if (v === null) { if (r.porConcepto[c] > 0 && r.tipoContratacion === 'POR_HORAS') faltan.push(c); } else ts[c] = v;
      }
      const fijo = r.tipoContratacion === 'POR_HORAS' ? 0 : Number(a?.valorFijoMensual) || 0;
      const porHoras = r.tipoContratacion === 'POR_HORAS';
      const normal = porHoras ? r.porConcepto.NORMAL * (ts.NORMAL || 0) : 0;
      const festivo = porHoras ? r.porConcepto.FESTIVO * (ts.FESTIVO || 0) : 0;
      const exam = porHoras ? r.porConcepto.EXAM_INTERN * (ts.EXAM_INTERN || 0) : 0;
      const total = normal + festivo + exam + fijo;
      const reparto = ceroPais();
      for (const p of PAISES_PAGO) reparto[p as Pais] = r.total > 0 ? total * (r.reparto[p as Pais] / r.total) : (p === r.pais ? total : 0);
      r.valor = { moneda, normal: r2(normal), festivo: r2(festivo), exam: r2(exam), fijo: r2(fijo), total: r2(total),
        reparto: { Chile: r2(reparto.Chile), Colombia: r2(reparto.Colombia), Ecuador: r2(reparto.Ecuador) }, tarifas: ts, faltanTarifas: faltan };
    }
  }

  const out: AdvisorLiq[] = [];
  for (const r of res.values()) {
    const { _eventos, ...rest } = r;
    rest.reparto = { Chile: r2(rest.reparto.Chile), Colombia: r2(rest.reparto.Colombia), Ecuador: r2(rest.reparto.Ecuador) };
    out.push(opts.advisorId ? { ...rest, eventos: _eventos.sort((x, y) => (x.fecha + (x.hora || '')).localeCompare(y.fecha + (y.hora || ''))) } : rest);
  }
  out.sort((x, y) => x.pais.localeCompare(y.pais) || x.nombre.localeCompare(y.nombre));
  return { periodo, parcial, semanas, advisors: out, tipoCambio: await tipoCambioDe(periodo) };
}

/** Último tipo de cambio registrado hasta el fin del periodo (unidades por 1 USD). */
async function tipoCambioDe(periodo: string) {
  const [y, m] = periodo.split('-').map(Number);
  const fin = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const rows = await queryMany<any>(
    `SELECT DISTINCT ON ("moneda") "moneda", "valor", TO_CHAR("fecha", 'YYYY-MM-DD') AS fecha, "fuente"
       FROM "TIPO_CAMBIO" WHERE "fecha" <= $1::date AND "moneda" IN ('COP', 'CLP')
      ORDER BY "moneda", "fecha" DESC`, [fin]);
  const cop = rows.find((r) => r.moneda === 'COP'); const clp = rows.find((r) => r.moneda === 'CLP');
  return {
    COP: cop ? Number(cop.valor) : null, CLP: clp ? Number(clp.valor) : null,
    fecha: [cop?.fecha, clp?.fecha].filter(Boolean).sort().pop() || null,
    fuente: cop?.fuente || clp?.fuente || null,
  };
}

/** Registra (o corrige) el tipo de cambio de un día. */
export async function guardarTipoCambio(datos: any, actor: string) {
  const fecha = String(datos?.fecha || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ValidationError('Fecha inválida (AAAA-MM-DD).');
  const filas: [string, number][] = [];
  for (const mon of ['COP', 'CLP']) {
    if (datos?.[mon] === undefined || datos?.[mon] === null || datos?.[mon] === '') continue;
    const v = Number(datos[mon]);
    if (!Number.isFinite(v) || v <= 0) throw new ValidationError(`Tipo de cambio ${mon} inválido.`);
    filas.push([mon, v]);
  }
  if (!filas.length) throw new ValidationError('Indique al menos un valor (COP o CLP por 1 USD).');
  for (const [mon, v] of filas) {
    await queryMany(
      `INSERT INTO "TIPO_CAMBIO" ("fecha", "moneda", "valor", "fuente") VALUES ($1::date, $2, $3, $4)
       ON CONFLICT ("fecha", "moneda") DO UPDATE SET "valor" = EXCLUDED."valor", "fuente" = EXCLUDED."fuente"`,
      [fecha, mon, v, `manual: ${actor}`]);
  }
}
