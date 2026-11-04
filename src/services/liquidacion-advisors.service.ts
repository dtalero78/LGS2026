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
import { kidsIntake } from '@/lib/kids-intake';

export type Pais = 'Chile' | 'Colombia' | 'Ecuador';
export const TIPOS_CLASE = ['sesiones', 'jumps', 'training', 'clubes', 'welcome', 'essential', 'examen', 'otros', 'administrativas', 'kids', 'ajustes'] as const;
export type TipoClase = typeof TIPOS_CLASE[number];
export type Concepto = 'NORMAL' | 'FESTIVO' | 'EXAM_INTERN';

const TZ: Record<Pais, string> = { Chile: 'America/Santiago', Colombia: 'America/Bogota', Ecuador: 'America/Guayaquil' };
const CODIGO: Record<Pais, string> = { Chile: 'CL', Colombia: 'CO', Ecuador: 'EC' };
const EXAMENES = new Set(['IELTS', 'TOEFL', 'B2FIRST', 'B2 FIRST']);
/** Países donde la hora festiva lleva recargo (decisión 2026-11-03: Colombia, por ahora, a tarifa normal). */
const FESTIVO_CON_RECARGO: Record<Pais, boolean> = { Chile: true, Colombia: false, Ecuador: true };
/** Cuentas técnicas de ADVISORS que no son personas (bienvenidas, actividades, superadmin, coordinación). */
const CUENTAS_SISTEMA = /advisorbienvenidas@|plataformalgsdigital@|superadmin@|academicoconsultalgs@|l\.merino@letsgospeak|super advisor|plataforma lgs|advisor welcome/i;

type PorTipo = Record<TipoClase, number>;
type PorPais = Record<Pais, number>;
const ceroTipo = (): PorTipo => Object.fromEntries(TIPOS_CLASE.map((t) => [t, 0])) as PorTipo;
const ceroPais = (): PorPais => ({ Chile: 0, Colombia: 0, Ecuador: 0 });
const r2 = (n: number) => Math.round(n * 100) / 100;

/** País de pago de un alumno (Perú → Ecuador). Acepta nombre de plataforma o código (CL/CO/EC/PE). */
function paisAlumno(plataforma: string | null | undefined): Pais | null {
  const p = String(plataforma || '').toLowerCase();
  if (p.startsWith('chile') || p === 'cl') return 'Chile';
  if (p.startsWith('colom') || p === 'co') return 'Colombia';
  if (p.startsWith('ecua') || p.startsWith('per') || p === 'ec' || p === 'pe') return 'Ecuador';
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
  /** Programa de ESTA liquidación: quien está en LGS y KIDS tiene una por programa. */
  programaLiq: 'LGS' | 'KIDS';
  advisorId: string; nombre: string; email: string | null; activo: boolean;
  pais: Pais; tipoContratacion: string; categoriaTarifa: string; programa: string;
  porTipo: PorTipo; porConcepto: Record<Concepto, number>; sinAsistentes: number;
  semanas: { n: number; total: number; porTipo: PorTipo }[];
  quincenas: { q1: number; q2: number };
  total: number; reparto: PorPais;
  noPagadas: { canceladas: number; suspendidas: number; noAsistio: number };
  /** Horas por concepto de cada quincena (Colombia factura por quincena). */
  porConceptoQ: { q1: Record<Concepto, number>; q2: Record<Concepto, number> };
  /** Horas extra autorizadas (semiplanta) y gestión administrativa informativa, por quincena. */
  extras: { q1: number; q2: number };
  gestionAdmin: number;
  /** Suma neta de ajustes (horas) del mes. */
  ajustes: number;
  valor: null | {
    moneda: string; normal: number; festivo: number; exam: number; extras: number; fijo: number; total: number;
    reparto: PorPais; tarifas: Partial<Record<Concepto, number>>; faltanTarifas: Concepto[];
  };
  /** Cortes de pago: Colombia Q1 + Q2; Chile y Ecuador MES. */
  cortes: { corte: Corte; horas: number; valor: number | null }[];
  eventos?: EventoLiq[];
}

export type Corte = 'MES' | 'Q1' | 'Q2';
export const cortesDe = (pais: Pais): Corte[] => (pais === 'Colombia' ? ['Q1', 'Q2'] : ['MES']);

export interface Liquidacion {
  periodo: string; parcial: boolean; semanas: Semana[]; advisors: AdvisorLiq[];
  tipoCambio: { COP: number | null; CLP: number | null; fecha: string | null; fuente: string | null };
  /** Estado de la integración KIDS: error si no respondió; sesiones sin guía asignada o con guía no enlazada. */
  kids: { ok: boolean; error: string | null; sinGuia: number; guiaSinEnlace: { username: string; sesiones: number }[] };
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
            "valorFijoMensual", "kidsUserId"
       FROM "ADVISORS" WHERE "programa" IN ('LGS', 'AMBOS', 'KIDS') ${opts.advisorId ? `AND "_id" = $1` : ''}`,
    opts.advisorId ? [opts.advisorId] : []);
  const advPorId = new Map<string, any>();
  for (const a of advisors) { const g = grupoPagoDe(a); if (g) advPorId.set(a._id, { ...a, grupo: g as Pais }); }
  const enLgs = (a: any) => a.programa === 'LGS' || a.programa === 'AMBOS';
  const enKids = (a: any) => a.programa === 'KIDS' || a.programa === 'AMBOS';
  const ids = Array.from(advPorId.values()).filter(enLgs).map((a) => a._id);

  const [eventos, admin, logs] = !ids.length ? [[], [], []] as any[][] : await Promise.all([
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
  const base = (a: any, programaLiq: 'LGS' | 'KIDS' = 'LGS') => {
    const clave = `${a._id}|${programaLiq}`;
    let r = res.get(clave);
    if (!r) {
      r = {
        programaLiq, advisorId: a._id, nombre: a.nombre || a._id, email: a.email || null, activo: !!a.activo, pais: a.grupo,
        tipoContratacion: a.tipoContratacion, categoriaTarifa: a.categoriaTarifa, programa: a.programa,
        porTipo: ceroTipo(), porConcepto: { NORMAL: 0, FESTIVO: 0, EXAM_INTERN: 0 }, sinAsistentes: 0,
        semanas: semanas.map((s) => ({ n: s.n, total: 0, porTipo: ceroTipo() })), quincenas: { q1: 0, q2: 0 },
        total: 0, reparto: ceroPais(), noPagadas: { canceladas: 0, suspendidas: 0, noAsistio: 0 }, valor: null, _eventos: [],
        porConceptoQ: { q1: { NORMAL: 0, FESTIVO: 0, EXAM_INTERN: 0 }, q2: { NORMAL: 0, FESTIVO: 0, EXAM_INTERN: 0 } },
        extras: { q1: 0, q2: 0 }, gestionAdmin: 0, ajustes: 0, cortes: [],
      };
      res.set(clave, r);
    }
    return r;
  };
  const sumar = (r: AdvisorLiq, fecha: string, tipo: TipoClase, concepto: Concepto, horas: number) => {
    r.porTipo[tipo] += horas; r.porConcepto[concepto] += horas; r.total += horas;
    const s = r.semanas[semanaDe(fecha) - 1]; s.total += horas; s.porTipo[tipo] += horas;
    const q = Number(fecha.slice(8, 10)) <= 15 ? 'q1' : 'q2';
    r.quincenas[q] += horas; r.porConceptoQ[q][concepto] += horas;
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

  // Todos los advisors ACTIVOS de la plataforma aparecen aunque no tengan horas en el
  // mes (la fuente real es la plataforma, no la hoja). Los inactivos, solo con actividad.
  // Se excluyen las cuentas de sistema (sin correo real) que no dictan clases.
  // ── KIDS: sesiones de las guías desde KIDS2026 (1 sesión = 1 h; ½ h sin presentes para por horas) ──
  const kids: Liquidacion['kids'] = { ok: true, error: null, sinGuia: 0, guiaSinEnlace: [] };
  const guiasKids = new Map<string, any>();
  for (const a of advPorId.values()) if (enKids(a) && a.kidsUserId) guiasKids.set(String(a.kidsUserId).toLowerCase(), a);
  if (guiasKids.size || !opts.advisorId) {
    try {
      const finMesStr = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const { sesiones } = await kidsIntake.horasGuias(`${periodo}-01`, finMesStr);
      const sinEnlace = new Map<string, number>();
      for (const s of sesiones) {
        if (!s.fecha?.startsWith(periodo)) continue;
        if (!s.guiaUserId) { kids.sinGuia++; continue; }
        const a = guiasKids.get(s.guiaUserId.toLowerCase());
        if (!a) { const u = s.guiaUsername || s.guiaUserId; sinEnlace.set(u, (sinEnlace.get(u) || 0) + 1); continue; }
        const r = base(a, 'KIDS');
        const pres = ceroPais(); const insc = ceroPais(); let presT = 0; let inscT = 0;
        for (const [cc, n] of Object.entries(s.presentes || {})) { const p = paisAlumno(cc); if (p) pres[p] += n; presT += n; }
        for (const [cc, n] of Object.entries(s.inscritos || {})) { const p = paisAlumno(cc); if (p) insc[p] += n; inscT += n; }
        const sinAsis = presT === 0;
        const horas = sinAsis && a.tipoContratacion === 'POR_HORAS' ? 0.5 : 1;
        const festivo = esFestivo(s.fecha, a.grupo as Pais);
        const concepto: Concepto = festivo ? 'FESTIVO' : 'NORMAL';
        const fuente = presT > 0 ? pres : inscT > 0 ? insc : null;
        const tf = fuente ? PAISES_PAGO.reduce((t, p) => t + fuente[p as Pais], 0) : 0;
        const reparto = ceroPais();
        if (fuente && tf > 0) for (const p of PAISES_PAGO) reparto[p as Pais] = fuente[p as Pais] / tf;
        else reparto[a.grupo as Pais] = 1;
        sumar(r, s.fecha, 'kids', concepto, horas);
        if (sinAsis) r.sinAsistentes++;
        for (const p of PAISES_PAGO) r.reparto[p as Pais] += horas * reparto[p as Pais];
        r._eventos.push({
          eventoId: s.id, fecha: s.fecha,
          hora: new Intl.DateTimeFormat('es-CO', { timeZone: TZ[a.grupo as Pais], hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(s.startsAt)),
          semana: semanaDe(s.fecha), quincena: Number(s.fecha.slice(8, 10)) <= 15 ? 1 : 2,
          tipo: 'kids', concepto, horas, titulo: `${s.salon} · ${s.tipoCurso}${s.marcadas ? '' : ' · asistencia sin marcar'}`,
          inscritos: inscT, asistentes: presT, sinAsistentes: sinAsis, compartido: false, cerrada: s.marcadas > 0,
          festivo, reparto,
        });
      }
      kids.guiaSinEnlace = Array.from(sinEnlace.entries()).map(([username, sesiones]) => ({ username, sesiones }));
    } catch (e: any) {
      kids.ok = false;
      kids.error = e?.message || 'KIDS no respondió';
      console.warn('[liquidacion] KIDS horas-guias:', kids.error);
    }
  }

  // Todos los advisors ACTIVOS de la plataforma aparecen aunque no tengan horas en el
  // mes (la fuente real es la plataforma, no la hoja). Los inactivos, solo con actividad.
  // Se excluyen las cuentas de sistema (sin correo real) que no dictan clases.
  for (const a of advPorId.values()) {
    if (!a.activo || CUENTAS_SISTEMA.test(String(a.email || '')) || CUENTAS_SISTEMA.test(String(a.nombre || ''))) continue;
    if (enLgs(a)) base(a, 'LGS');
    if (enKids(a)) base(a, 'KIDS');
  }

  // ── Ajustes (Académico): liquidable = plataforma + Σ ajustes. Por corte (Q1/Q2/MES). ──
  const ajustes = await queryMany<any>(
    `SELECT l."advisorId", l."programa", l."corte", a."alcance", TO_CHAR(a."semanaInicio", 'YYYY-MM-DD') AS "semanaInicio",
            a."concepto", a."horas"
       FROM "LIQ_ADVISOR_AJUSTES" a JOIN "LIQ_ADVISOR" l ON l."_id" = a."liqId"
      WHERE l."periodo" = $1 ${opts.advisorId ? `AND l."advisorId" = $2` : ''}`,
    opts.advisorId ? [periodo, opts.advisorId] : [periodo]);
  for (const aj of ajustes) {
    const a = advPorId.get(aj.advisorId); if (!a) continue;
    const r = base(a, aj.programa === 'KIDS' ? 'KIDS' : 'LGS');
    const h = Number(aj.horas) || 0; if (!h) continue;
    r.ajustes += h;
    const q: 'q1' | 'q2' = aj.corte === 'Q1' ? 'q1' : aj.corte === 'Q2' ? 'q2'
      : (aj.semanaInicio && Number(aj.semanaInicio.slice(8, 10)) <= 15 ? 'q1' : 'q2');
    if (aj.concepto === 'EXTRA_AUTORIZADA') { r.extras[q] += h; }
    else if (aj.concepto === 'GESTION_ADMIN') { r.gestionAdmin += h; continue; } // informativo: no suma horas pagables
    else {
      const c: Concepto = aj.concepto === 'FESTIVO' ? 'FESTIVO' : aj.concepto === 'EXAM_INTERN' ? 'EXAM_INTERN' : 'NORMAL';
      r.porConcepto[c] += h; r.porConceptoQ[q][c] += h;
    }
    r.porTipo.ajustes += h; r.total += h; r.quincenas[q] += h;
    if (aj.alcance === 'SEMANA' && aj.semanaInicio) {
      const s = r.semanas[semanaDe(aj.semanaInicio) - 1]; if (s) { s.total += h; s.porTipo.ajustes += h; }
    }
    // El ajuste se reparte entre países en la misma proporción que las horas del advisor.
    const base0 = r.total - h;
    if (base0 > 0) { const rep = { ...r.reparto }; for (const p of PAISES_PAGO) r.reparto[p as Pais] += h * (rep[p as Pais] / base0); }
    else r.reparto[a.grupo as Pais] += h;
  }

  // Valores
  if (opts.verValores) {
    const tarifas = await queryMany<any>(
      `SELECT DISTINCT ON ("pais", "programa", "tipo", "categoria", "concepto")
              "pais", "programa", "tipo", "categoria", "concepto", "valor", "moneda"
         FROM "TARIFAS_ADVISOR" WHERE "activo" = true AND "vigenteDesde" <= $1::date
        ORDER BY "pais", "programa", "tipo", "categoria", "concepto", "vigenteDesde" DESC`, [`${periodo}-01`]);
    // Kids sin tarifa propia usa la de LGS; categoría sin tarifa usa ESTANDAR.
    const tarifa = (pais: string, programa: string, tipo: string, categoria: string, concepto: Concepto) => {
      for (const prog of programa === 'KIDS' ? ['KIDS', 'LGS'] : ['LGS']) {
        for (const cat of categoria === 'ESTANDAR' ? ['ESTANDAR'] : [categoria, 'ESTANDAR']) {
          const t = tarifas.find((x) => x.pais === pais && x.programa === prog && x.tipo === tipo && x.categoria === cat && x.concepto === concepto);
          if (t) return Number(t.valor);
        }
      }
      return null;
    };
    for (const r of res.values()) {
      const a = advPorId.get(r.advisorId);
      const moneda = MONEDA_POR_PAIS[r.pais];
      const tipoTarifa = r.tipoContratacion === 'SEMIPLANTA' ? 'SEMIPLANTA' : 'POR_HORAS';
      const ts: Partial<Record<Concepto, number>> = {};
      const faltan: Concepto[] = [];
      for (const c of ['NORMAL', 'FESTIVO', 'EXAM_INTERN'] as Concepto[]) {
        const v = tarifa(r.pais, r.programaLiq, tipoTarifa, r.categoriaTarifa, c);
        if (v === null) { if (r.porConcepto[c] > 0 && r.tipoContratacion === 'POR_HORAS') faltan.push(c); } else ts[c] = v;
      }
      // El valor fijo de quien está en los dos programas va en su liquidación LGS (una sola vez).
      const llevaFijo = r.programaLiq === 'LGS' || a?.programa === 'KIDS';
      const fijo = r.tipoContratacion === 'POR_HORAS' || !llevaFijo ? 0 : Number(a?.valorFijoMensual) || 0;
      const porHoras = r.tipoContratacion === 'POR_HORAS';
      const semi = r.tipoContratacion === 'SEMIPLANTA';
      // Festivo: con recargo solo en los países que lo pagan (Colombia, por ahora, a tarifa normal).
      // Semiplanta: el valor fijo cubre lo normal; se pagan aparte las horas festivas de la
      // plataforma y las horas EXTRA AUTORIZADAS (ajuste) a tarifa normal. Planta: solo el fijo.
      const tarifaFestivo = FESTIVO_CON_RECARGO[r.pais] ? (ts.FESTIVO || 0) : (ts.NORMAL || 0);
      const valorDe = (pc: Record<Concepto, number>, extras: number, conFijo: boolean) => {
        const normal = porHoras ? pc.NORMAL * (ts.NORMAL || 0) : 0;
        const festivo = porHoras || semi ? pc.FESTIVO * tarifaFestivo : 0;
        const exam = porHoras ? pc.EXAM_INTERN * (ts.EXAM_INTERN || 0) : 0;
        const ext = semi ? extras * (ts.NORMAL || 0) : 0;
        const f = conFijo ? fijo : 0;
        return { normal, festivo, exam, extras: ext, fijo: f, total: normal + festivo + exam + ext + f };
      };
      const v = valorDe(r.porConcepto, r.extras.q1 + r.extras.q2, true);
      const reparto = ceroPais();
      for (const p of PAISES_PAGO) reparto[p as Pais] = r.total > 0 ? v.total * (r.reparto[p as Pais] / r.total) : (p === r.pais ? v.total : 0);
      r.valor = { moneda, normal: r2(v.normal), festivo: r2(v.festivo), exam: r2(v.exam), extras: r2(v.extras), fijo: r2(v.fijo), total: r2(v.total),
        reparto: { Chile: r2(reparto.Chile), Colombia: r2(reparto.Colombia), Ecuador: r2(reparto.Ecuador) }, tarifas: ts, faltanTarifas: faltan };
      // Por quincena (Colombia): el fijo, si lo hubiera, va en la 2da.
      r.cortes = cortesDe(r.pais).map((c) => c === 'MES'
        ? { corte: c, horas: r2(r.total), valor: r2(v.total) }
        : { corte: c, horas: r2(r.quincenas[c === 'Q1' ? 'q1' : 'q2']),
            valor: r2(valorDe(r.porConceptoQ[c === 'Q1' ? 'q1' : 'q2'], r.extras[c === 'Q1' ? 'q1' : 'q2'], c === 'Q2').total) });
    }
  }
  for (const r of res.values()) {
    if (!r.cortes.length) {
      r.cortes = cortesDe(r.pais).map((c) => ({ corte: c, horas: r2(c === 'MES' ? r.total : r.quincenas[c === 'Q1' ? 'q1' : 'q2']), valor: null }));
    }
  }

  const out: AdvisorLiq[] = [];
  for (const r of res.values()) {
    const { _eventos, ...rest } = r;
    rest.reparto = { Chile: r2(rest.reparto.Chile), Colombia: r2(rest.reparto.Colombia), Ecuador: r2(rest.reparto.Ecuador) };
    out.push(opts.advisorId ? { ...rest, eventos: _eventos.sort((x, y) => (x.fecha + (x.hora || '')).localeCompare(y.fecha + (y.hora || ''))) } : rest);
  }
  out.sort((x, y) => x.programaLiq.localeCompare(y.programaLiq) || x.pais.localeCompare(y.pais) || x.nombre.localeCompare(y.nombre));
  return { periodo, parcial, semanas, advisors: out, tipoCambio: await tipoCambioDe(periodo), kids };
}

/** Último intento de traer el tipo de cambio oficial por fecha (evita reintentar en cada carga). */
const INTENTOS_TC = new Map<string, number>();

/**
 * Valor oficial de 1 USD vigente en una fecha: TRM de Colombia (datos.gov.co, vigente
 * ese día) y dólar observado de Chile (mindicador.cl, último publicado ≤ fecha).
 * Best-effort: si una fuente no responde devuelve null para esa moneda.
 */
async function tipoCambioOficial(fecha: string): Promise<{ COP: number | null; CLP: number | null }> {
  const pedir = async (url: string) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  const [cop, clp] = await Promise.all([
    pedir(`https://www.datos.gov.co/resource/32sa-8pi3.json?$where=${encodeURIComponent(`vigenciadesde <= '${fecha}T00:00:00'`)}&$order=vigenciadesde%20DESC&$limit=1`)
      .then((j: any[]) => (j?.[0]?.valor ? Number(j[0].valor) : null)).catch(() => null),
    pedir(`https://mindicador.cl/api/dolar/${fecha.slice(0, 4)}`)
      .then((j: any) => {
        const x = (j?.serie || []).filter((s: any) => String(s.fecha).slice(0, 10) <= fecha)
          .sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha)))[0];
        return x ? Number(x.valor) : null;
      }).catch(() => null),
  ]);
  return { COP: cop && cop > 0 ? cop : null, CLP: clp && clp > 0 ? clp : null };
}

/**
 * Tipo de cambio del periodo = el vigente el ÚLTIMO DÍA del mes (mes en curso: hoy).
 * Si aún no está guardado para esa fecha, se trae de la fuente oficial y se guarda;
 * si la fuente no responde se usa el último registrado antes (incluido el manual).
 */
async function tipoCambioDe(periodo: string) {
  const [y, m] = periodo.split('-').map(Number);
  const finMes = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);
  const fin = finMes < hoy ? finMes : hoy;
  const ya = await queryMany<any>(`SELECT "moneda" FROM "TIPO_CAMBIO" WHERE "fecha" = $1::date AND "moneda" IN ('COP', 'CLP')`, [fin]);
  const faltan = ['COP', 'CLP'].filter((mon) => !ya.some((r) => r.moneda === mon));
  const ultimoIntento = INTENTOS_TC.get(fin) || 0;
  if (faltan.length && Date.now() - ultimoIntento > 30 * 60e3) {
    INTENTOS_TC.set(fin, Date.now());
    const of = await tipoCambioOficial(fin);
    for (const mon of faltan) {
      const v = of[mon as 'COP' | 'CLP'];
      if (!v) continue;
      await queryMany(
        `INSERT INTO "TIPO_CAMBIO" ("fecha", "moneda", "valor", "fuente") VALUES ($1::date, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [fin, mon, v, mon === 'COP' ? 'TRM (datos.gov.co)' : 'Dólar observado (mindicador.cl)']);
    }
  }
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
