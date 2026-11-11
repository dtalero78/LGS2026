import 'server-only';
import { queryMany, queryOne } from '@/lib/postgres';
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors';
import { registrarEventoContrato } from '@/lib/contrato-eventos';
import { hasPermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { etiquetaRecibos } from '@/lib/recibos-multiples';

/**
 * Seguimiento del contrato: bitácora de todo lo que le pasó al contrato y a sus personas
 * (titular + beneficiarios), armada AL LEER con lo que cada proceso ya deja escrito —igual
 * que el Seguimiento de los casos de atención de MOSAICO—, más CONTRATO_EVENTOS, que guarda
 * solo lo que no tenía dónde quedar (lib/contrato-eventos.ts).
 *
 * Fuentes: PEOPLE (creación, documentación, recibo, consentimiento, listo para aprobación,
 * OnHold, extensiones, suspensión, comentarios), APROBACION_AUDIT, auditautoaprov,
 * PAGOS_TITULARES (+ tipoCarteraHistory), PAGOS_AJUSTES, CERTIFICADO_DESBLOQUEOS,
 * KIDS_INSCRIPCIONES, ACADEMICA (ficha, cambioStepHistory, inicianivel), STEP_OVERRIDES,
 * ACADEMICA_BOOKINGS (Welcome), CERTIFICADOS_LOG, EXAM_INTERN_AUDIT, PURGE_LOG y CONTRATO_EVENTOS.
 *
 * Lo que existe en dos fuentes (p. ej. un documento que también quedó en CONTRATO_EVENTOS)
 * se muestra una vez: manda CONTRATO_EVENTOS porque trae quién lo hizo.
 */

export type CategoriaSeguimiento =
  | 'MATRICULA' | 'DOCUMENTOS' | 'FIRMA' | 'APROBACION' | 'BENEFICIARIOS' | 'PAGOS'
  | 'RECAUDOS' | 'VIGENCIA' | 'ACADEMICO' | 'KIDS' | 'COMENTARIO';

export interface EventoSeguimiento {
  id: string;
  fecha: string;           // ISO
  soloFecha?: boolean;     // la fuente guarda solo el día (sin hora)
  categoria: CategoriaSeguimiento;
  accion: string;
  detalle?: string | null;
  usuario?: string | null; // nombre (o email) de quien lo hizo
  usuarioEmail?: string | null;
  personaId?: string | null;
  personaNombre?: string | null;
  tipoUsuario?: string | null;
  cambios?: Record<string, { antes: any; despues: any }> | null;
  /** Etiqueta resaltada de un comentario (ver ETIQUETAS_COMENTARIO). */
  etiqueta?: EtiquetaComentario | null;
  /** Cambio automático del sistema (sin usuario). */
  sistema?: boolean;
}

/**
 * Etiquetas de los comentarios del Seguimiento:
 *  - SOBRE_APROBACION: la escribe Aprobación (permiso PERSON.INFO.SEGUIMIENTO_SOBRE_APROBACION).
 *  - PARA_APROBACION: la escribe Comercial — el ejecutivo que hizo el contrato (PEOPLE.asesor del
 *    titular = su correo) o quien tenga PERSON.INFO.SEGUIMIENTO_PARA_APROBACION (directores).
 * Se guarda en CONTRATO_EVENTOS.datos.etiqueta.
 */
export const ETIQUETAS_COMENTARIO = ['SOBRE_APROBACION', 'PARA_APROBACION'] as const;
export type EtiquetaComentario = typeof ETIQUETAS_COMENTARIO[number];

export interface SeguimientoContrato {
  titularId: string;
  contrato: string | null;
  personas: { _id: string; nombre: string; tipoUsuario: string | null }[];
  eventos: EventoSeguimiento[];
  /** Etiquetas que quien consulta puede poner en un comentario de este contrato. */
  etiquetasPermitidas?: EtiquetaComentario[];
}

/** Etiquetas de comentario que la sesión puede usar en el contrato de `id` (titular o beneficiario). */
export async function etiquetasPermitidas(id: string, session: any): Promise<EtiquetaComentario[]> {
  const out: EtiquetaComentario[] = [];
  if (await hasPermission(session, PersonPermission.SEGUIMIENTO_SOBRE_APROBACION)) out.push('SOBRE_APROBACION');
  let para = await hasPermission(session, PersonPermission.SEGUIMIENTO_PARA_APROBACION);
  if (!para) {
    const email = String(session?.user?.email || '').trim().toLowerCase();
    if (email) {
      const t = await queryOne<{ asesor: string | null }>(
        `SELECT t."asesor" FROM "PEOPLE" b
           JOIN "PEOPLE" t ON t."_id" = CASE WHEN b."tipoUsuario" = 'TITULAR' THEN b."_id" ELSE COALESCE(b."titularId", b."_id") END
          WHERE b."_id" = $1`, [id]);
      para = !!t?.asesor && t.asesor.trim().toLowerCase() === email;
    }
  }
  if (para) out.push('PARA_APROBACION');
  return out;
}

const json = (v: any) => {
  if (v == null) return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
};
const iso = (v: any): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
/** Fecha de calendario (AAAA-MM-DD) de un valor que puede venir como ISO con hora. */
const dia = (v: any) => (v ? String(v).slice(0, 10) : '—');
const arr = (v: any): any[] => { const x = json(v); return Array.isArray(x) ? x : []; };
const nombreDe = (p: any) => [p?.primerNombre, p?.primerApellido].filter(Boolean).join(' ').trim() || 'Sin nombre';
const money = (n: any) => { const v = parseFloat(String(n ?? '')); return Number.isFinite(v) ? `$${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })}` : null; };

/** Lecturas tolerantes: una fuente caída (tabla nueva sin crear, etc.) no tumba el seguimiento. */
async function leer<T extends Record<string, any> = any>(sql: string, params: any[]): Promise<T[]> {
  try { return await queryMany<T>(sql, params); } catch (e: any) {
    console.warn('⚠️ [seguimiento] fuente omitida:', e?.message || e);
    return [];
  }
}

/**
 * Comentario escrito en la ventana Seguimiento: va a CONTRATO_EVENTOS (inmutable) con quién y
 * cuándo. `personaId` opcional: una persona del MISMO contrato; si no, queda sobre el titular.
 * A diferencia de los registros automáticos, aquí un fallo SÍ se informa al usuario.
 */
export async function comentarSeguimiento(id: string, texto: any, personaId: any, session: any, etiqueta?: any): Promise<void> {
  let tag: EtiquetaComentario | null = null;
  if (etiqueta) {
    if (!ETIQUETAS_COMENTARIO.includes(etiqueta)) throw new ValidationError('Etiqueta de comentario no válida.');
    if (!(await etiquetasPermitidas(id, session)).includes(etiqueta))
      throw new ForbiddenError(etiqueta === 'SOBRE_APROBACION'
        ? 'Solo el equipo de Aprobación puede marcar un comentario "Sobre la aprobación".'
        : 'Solo el ejecutivo que hizo el contrato o un director comercial puede marcar un comentario "Para aprobación".');
    tag = etiqueta;
  }
  const t = String(texto ?? '').trim();
  if (t.length < 3) throw new ValidationError('Escribe el comentario (mínimo 3 caracteres).');
  if (t.length > 2000) throw new ValidationError('El comentario no puede pasar de 2.000 caracteres.');
  const base = await queryOne<any>(`SELECT "_id","titularId","contrato","tipoUsuario" FROM "PEOPLE" WHERE "_id" = $1`, [id]);
  if (!base) throw new NotFoundError('Persona', id);
  const titularId = base.tipoUsuario === 'TITULAR' ? base._id : (base.titularId || base._id);
  let destino = titularId;
  if (personaId && personaId !== titularId) {
    const p = await queryOne<{ _id: string }>(
      `SELECT "_id" FROM "PEOPLE" WHERE "_id" = $1 AND ($2::text IS NOT NULL AND "contrato" = $2)`, [personaId, base.contrato || null]);
    if (!p) throw new ValidationError('La persona elegida no pertenece a este contrato.');
    destino = p._id;
  }
  await registrarEventoContrato({
    personaId: destino, categoria: 'COMENTARIO', accion: 'Comentario de seguimiento', detalle: t, session, estricto: true,
    ...(tag ? { datos: { etiqueta: tag } } : {}),
  });
}

export async function seguimientoContrato(personaId: string): Promise<SeguimientoContrato> {
  // El seguimiento es del contrato: desde cualquier persona se llega a su titular.
  const base = await queryOne<any>(`SELECT "_id","titularId","contrato","tipoUsuario" FROM "PEOPLE" WHERE "_id"=$1`, [personaId]);
  if (!base) throw new NotFoundError('Persona', personaId);
  const contrato: string | null = base.contrato || null;

  const gente = await queryMany<any>(
    `SELECT "_id","tipoUsuario","titularId","numeroId","primerNombre","primerApellido","kids","asesor","asesorCreadorContrato",
            "fechaCreacion","_createdDate","plataforma","filial","origenMatricula","fullExecutive","modulo","tipoContrato",
            "documentacion","reciboInscripcion","consentimientoDeclarativo","listoAprobacion","listoAprobacionPor","listoAprobacionEn",
            "onHoldHistory","extensionHistory","suspenddata",
            COALESCE("comentarios"::text[], ARRAY[]::text[]) AS "comentarios"
       FROM "PEOPLE"
      WHERE ${contrato ? `"contrato" = $1` : `"_id" = $1`}
      ORDER BY ("tipoUsuario" = 'TITULAR') DESC, "_createdDate"`,
    [contrato || personaId]);
  const titular = gente.find(p => p.tipoUsuario === 'TITULAR') || gente.find(p => p._id === personaId) || base;
  const titularId: string = titular._id;
  const ids = gente.map(p => p._id);
  const porId = new Map(gente.map(p => [p._id, p]));
  const benef = gente.filter(p => p.tipoUsuario !== 'TITULAR');

  const ev: EventoSeguimiento[] = [];
  const add = (e: Omit<EventoSeguimiento, 'id' | 'fecha'> & { fecha: any; id?: string }) => {
    const fecha = iso(e.fecha);
    if (!fecha) return;
    const p = e.personaId ? porId.get(e.personaId) : null;
    ev.push({
      ...e, fecha, id: e.id || `${e.categoria}-${ev.length}`,
      personaNombre: e.personaNombre ?? (p ? nombreDe(p) : null),
      tipoUsuario: e.tipoUsuario ?? p?.tipoUsuario ?? null,
    });
  };

  // Todas las fuentes independientes en paralelo (el pool limita la concurrencia).
  const [cev, autoaprob, aud, pagos, ajustes, desbloqueos, kidsInsc, fichas, purgas] = await Promise.all([
    leer<any>(
    `SELECT * FROM "CONTRATO_EVENTOS" WHERE ($1::text IS NOT NULL AND "contrato" = $1) OR "titularId" = $2 OR "personaId" = ANY($3::text[])`,
    [contrato, titularId, ids]),
    leer<any>(`SELECT * FROM "auditautoaprov" WHERE "titularId" = $1 OR ($2::text IS NOT NULL AND "contrato" = $2)`, [titularId, contrato]),
    leer<any>(`SELECT * FROM "APROBACION_AUDIT" WHERE "personId" = ANY($1::text[]) OR ($2::text IS NOT NULL AND "contrato" = $2)`, [ids, contrato]),
    leer<any>(
      `SELECT "_id","idPeople","numCuota","numPago","valorPagado","descuento","medioPago","fechaPago","validado","validadoPor",
              "fechaValidacion","numeroFactura","createdBy","realizadopor","abono","tipoCarteraHistory","_createdDate"
         FROM "PAGOS_TITULARES" WHERE "idPeople" = ANY($1::text[])`, [ids]),
    leer<any>(`SELECT * FROM "PAGOS_AJUSTES" WHERE "idPeople" = ANY($1::text[]) OR ($2::text IS NOT NULL AND "contrato" = $2)`, [ids, contrato]),
    contrato ? leer<any>(`SELECT * FROM "CERTIFICADO_DESBLOQUEOS" WHERE "contrato" = $1`, [contrato]) : Promise.resolve([] as any[]),
    leer<any>(`SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "beneficiarioId" = ANY($1::text[])`, [ids]),
    benef.length ? leer<any>(
      `SELECT a."_id", a."_createdDate", a."cambioStepHistory", a."inicianivel", p."_id" AS "personaId"
         FROM "ACADEMICA" a
         JOIN "PEOPLE" p ON p."_id" = ANY($1::text[])
          AND (a."usuarioId" = p."_id" OR (a."numeroId" = p."numeroId" AND ($2::text IS NULL OR a."contrato" = $2 OR a."contrato" IS NULL)))`,
      [benef.map(b => b._id), contrato]) : Promise.resolve([] as any[]),
    contrato ? leer<any>(`SELECT "_id","tipoPurga","motivo","realizadoPor","realizadoPorNombre","_createdDate" FROM "PURGE_LOG" WHERE "contrato" = $1`, [contrato]) : Promise.resolve([] as any[]),
  ]);

  // ── Bitácora nueva (CONTRATO_EVENTOS) ─────────────────────────────────────────
  const urlsRegistradas = new Set(cev.map(c => json(c.datos)?.url).filter(Boolean));
  const accionesPorPersona = new Set(cev.map(c => `${c.personaId}|${c.accion}`));
  for (const c of cev) {
    const d = json(c.datos);
    add({
      id: c._id, fecha: c._createdDate, categoria: c.categoria, accion: c.accion, detalle: c.detalle,
      usuario: c.usuarioNombre || c.usuarioEmail, usuarioEmail: c.usuarioEmail,
      personaId: c.personaId, personaNombre: porId.has(c.personaId) ? undefined : c.personaNombre, tipoUsuario: c.tipoUsuario,
      cambios: d?.cambios || null,
      etiqueta: ETIQUETAS_COMENTARIO.includes(d?.etiqueta) ? d.etiqueta : null,
    });
  }

  // ── Matrícula ──────────────────────────────────────────────────────────────────
  // En contratos migrados fechaCreacion puede ser posterior a sus beneficiarios: se toma la más antigua.
  const creado = [titular.fechaCreacion, titular._createdDate, ...benef.map(b => b._createdDate)]
    .map(iso).filter(Boolean).sort()[0] || titular._createdDate;
  const conTitular = benef.filter(b => Math.abs(new Date(b._createdDate).getTime() - new Date(creado).getTime()) < 10 * 60_000);
  add({
    id: `matricula-${titularId}`, fecha: creado, categoria: 'MATRICULA', accion: 'Matrícula creada',
    detalle: [
      contrato && `Contrato ${contrato}`, titular.plataforma,
      titular.tipoContrato === 'CANJE' && 'Canje', titular.modulo && 'Módulo',
      conTitular.length && `${conTitular.length} beneficiario(s)`,
      titular.filial && `Filial ${titular.filial}`, titular.origenMatricula && `Origen ${titular.origenMatricula}`,
    ].filter(Boolean).join(' · '),
    // Quien la creó es el correo del asesor (el nombre se resuelve abajo); asesorCreadorContrato
    // es el Ej. Training y puede haberse corregido después con "Ajuste Escalera".
    usuario: titular.asesor || titular.asesorCreadorContrato, usuarioEmail: titular.asesor, personaId: titularId,
  });
  for (const b of benef) {
    if (conTitular.includes(b) || accionesPorPersona.has(`${b._id}|Beneficiario agregado`)) continue;
    add({ id: `benef-${b._id}`, fecha: b._createdDate, categoria: 'BENEFICIARIOS', accion: 'Beneficiario agregado',
      detalle: `Documento ${b.numeroId || '—'}${b.kids ? ' · Kids' : ''}`, personaId: b._id });
  }

  // ── Documentos y recibo de inscripción ─────────────────────────────────────────
  for (const p of gente) {
    arr(p.documentacion).forEach((d: any, i: number) => {
      if (!d || typeof d !== 'object' || urlsRegistradas.has(d.url)) return;
      add({ id: `doc-${p._id}-${i}`, fecha: d.fechaSubida, categoria: 'DOCUMENTOS',
        accion: d.ratificacion ? 'Correo "SÍ, ACEPTO" adjuntado' : 'Documento subido', detalle: d.nombre,
        usuario: d.subidoPor || null, usuarioEmail: d.subidoPor || null, personaId: p._id });
    });
    const r = json(p.reciboInscripcion);
    if (r?.url && !urlsRegistradas.has(r.url)) {
      add({ id: `recibo-${p._id}`, fecha: r.subidoEn, categoria: 'PAGOS', accion: 'Recibo de inscripción subido',
        detalle: [r.dosRecibos ? etiquetaRecibos(Array.isArray(r.recibos) ? r.recibos.length : 2) : r.nombre, r.extraido?.monto && `monto leído ${money(r.extraido.monto)}`].filter(Boolean).join(' · '),
        usuario: r.subidoPor, usuarioEmail: r.subidoPor, personaId: p._id });
    }
  }

  // ── Firma ──────────────────────────────────────────────────────────────────────
  const cons = json(titular.consentimientoDeclarativo);
  if (cons?.timestampAcceptacion) {
    const tipo = String(cons.tipoAprobacion || 'OTP').toUpperCase();
    if (!(tipo === 'AUTOMATICA' && autoaprob.length)) {
      add({
        id: `firma-${titularId}`, fecha: cons.timestampAcceptacion, categoria: 'FIRMA',
        accion: tipo === 'AUTOMATICA' ? 'Consentimiento auto-aprobado' : tipo === 'CORREO' ? 'Ratificado por correo' : 'Contrato firmado (código WhatsApp)',
        detalle: tipo === 'OTP' || !cons.tipoAprobacion ? `Celular validado ${cons.celularValidado || '—'}` : null,
        usuario: cons.aprobadoPor || (tipo === 'OTP' || !cons.tipoAprobacion ? 'El cliente' : null),
        usuarioEmail: cons.aprobadoPor || null, personaId: titularId,
      });
    }
  }
  for (const a of autoaprob) {
    add({ id: a._id, fecha: a._createdDate, categoria: 'FIRMA', accion: 'Consentimiento auto-aprobado',
      usuario: a.usuarioNombre || a.usuarioEmail, usuarioEmail: a.usuarioEmail, personaId: titularId });
  }
  if (titular.listoAprobacionEn) {
    add({ id: `listo-${titularId}`, fecha: titular.listoAprobacionEn, categoria: 'APROBACION', accion: 'Dejado listo para aprobación',
      detalle: titular.listoAprobacion ? null : 'Marca retirada después', usuario: titular.listoAprobacionPor, usuarioEmail: titular.listoAprobacionPor, personaId: titularId });
  }

  // ── Aprobación ─────────────────────────────────────────────────────────────────
  for (const a of aud) {
    const sistema = a.origen === 'SISTEMA' || String(a.usuarioEmail || '').toLowerCase() === 'sistema';
    add({ id: a._id, fecha: a._createdDate, categoria: 'APROBACION', sistema,
      accion: `${a.estadoAnterior || 'Sin estado'} → ${a.estadoNuevo || 'Sin estado'}`,
      detalle: [a.origen === 'APROBAR_CASCADA' ? 'En cascada al aprobar el contrato' : null, a.motivo].filter(Boolean).join(' · ') || null,
      usuario: sistema ? 'Sistema (automático)' : (a.usuarioNombre || a.usuarioEmail), usuarioEmail: a.usuarioEmail,
      personaId: a.personId, personaNombre: porId.has(a.personId) ? undefined : a.nombre, tipoUsuario: a.tipoUsuario });
  }

  // ── Pagos y recaudos ───────────────────────────────────────────────────────────
  for (const p of pagos) {
    const que = p.numCuota === 0 || p.numCuota === '0' ? 'Inscripción' : `Cuota ${p.numCuota}${p.abono ? ' (abono)' : ''}`;
    const quien = p.createdBy || p.realizadopor;
    add({ id: `pago-${p._id}`, fecha: p._createdDate, categoria: 'PAGOS', accion: `Pago registrado · ${que}`,
      detalle: [money(p.valorPagado), parseFloat(p.descuento) > 0 && `descuento ${money(p.descuento)}`, p.medioPago,
        p.fechaPago && `pagado el ${iso(p.fechaPago)!.slice(0, 10)}`].filter(Boolean).join(' · '),
      usuario: quien, usuarioEmail: quien, personaId: p.idPeople });
    if (p.validado && (p.fechaValidacion || p.validadoPor)) {
      add({ id: `valida-${p._id}`, fecha: p.fechaValidacion || p._createdDate, soloFecha: !!p.fechaValidacion,
        categoria: 'PAGOS', accion: `Pago validado · ${que}`,
        detalle: [money(p.valorPagado), p.numeroFactura && `factura ${p.numeroFactura}`].filter(Boolean).join(' · '),
        usuario: p.validadoPor, usuarioEmail: p.validadoPor, personaId: p.idPeople });
    }
    arr(p.tipoCarteraHistory).forEach((h: any, i: number) => add({
      id: `cartera-${p._id}-${i}`, fecha: h.fecha, categoria: 'RECAUDOS',
      accion: `Tipo de cartera: ${h.estadoAnterior || '—'} → ${h.estadoNuevo || '—'}`, detalle: h.motivo,
      usuario: h.realizadoPorNombre || h.realizadoPor, usuarioEmail: h.realizadoPor, personaId: p.idPeople,
    }));
  }
  {
    for (const a of ajustes) {
      const antes = json(a.antes) || {}, despues = json(a.despues) || {};
      const cambios = Object.fromEntries(Object.keys(despues).map(k => [k, { antes: antes[k] ?? null, despues: despues[k] ?? null }]));
      add({ id: a._id, fecha: a._createdDate, categoria: 'RECAUDOS',
        accion: `Ajuste a pago validado · ${a.tipo === 'INSCRIPCION' ? 'Inscripción' : a.tipo === 'FACTURA' ? 'Factura' : `Cuota ${a.numCuota ?? ''}`}`,
        detalle: a.motivo, usuario: a.usuarioNombre || a.usuarioEmail, usuarioEmail: a.usuarioEmail, personaId: a.idPeople || titularId, cambios });
    }
    for (const d of desbloqueos) {
      add({ id: `desb-${d._id}`, fecha: d._createdDate, categoria: 'RECAUDOS', accion: 'Certificado desbloqueado (mora)',
        detalle: d.motivo, usuario: d.desbloqueadoPorNombre || d.desbloqueadoPor, usuarioEmail: d.desbloqueadoPor, personaId: titularId });
      if (d.revocadoEn) add({ id: `revoca-${d._id}`, fecha: d.revocadoEn, categoria: 'RECAUDOS', accion: 'Desbloqueo de certificado revocado',
        usuario: d.revocadoPor, usuarioEmail: d.revocadoPor, personaId: titularId });
    }
  }

  // ── Vigencia: OnHold, extensiones, suspensión ──────────────────────────────────
  for (const p of gente) {
    arr(p.onHoldHistory).forEach((h: any, i: number) => add({
      id: `onhold-${p._id}-${i}`, fecha: h.fechaActivacion || h.fechaOnHold, categoria: 'VIGENCIA',
      accion: h.origen === 'KIDS' ? 'OnHold (desde KIDS)' : 'OnHold activado',
      detalle: [`${dia(h.fechaOnHold)} a ${dia(h.fechaFinOnHold)}`, h.motivo].filter(Boolean).join(' · '),
      usuario: h.activadoPorNombre || h.activadoPor, usuarioEmail: h.activadoPorEmail || null, personaId: p._id,
    }));
    arr(p.extensionHistory).forEach((h: any, i: number) => add({
      id: `ext-${p._id}-${i}`, fecha: h.fechaEjecucion, categoria: 'VIGENCIA',
      accion: h.tipo === 'SINCRONIZACION' ? 'Fecha final sincronizada con beneficiarios'
        : /onhold/i.test(h.motivo || '') ? 'Extensión automática por OnHold' : 'Extensión de vigencia',
      detalle: [`${dia(h.vigenciaAnterior)} → ${dia(h.vigenciaNueva)}`, h.diasExtendidos && `${h.diasExtendidos} días`, h.motivo].filter(Boolean).join(' · '),
      usuario: h.ejecutadoPor || null, usuarioEmail: h.ejecutadoPorEmail || null, personaId: p._id,
    }));
    // suspenddata guarda solo la última; si ya está en CONTRATO_EVENTOS no se repite.
    const s = json(p.suspenddata);
    if (s?.fecha && !cev.some(c => c.personaId === p._id && ['Inactivado', 'Reactivado'].includes(c.accion)
        && Math.abs(new Date(c._createdDate).getTime() - new Date(s.fecha).getTime()) < 5 * 60_000)) {
      add({ id: `susp-${p._id}`, fecha: s.fecha, categoria: 'VIGENCIA', accion: s.accion === 'REACTIVACION' ? 'Reactivado' : 'Inactivado',
        detalle: s.motivo, usuario: s.realizadoPorNombre || s.realizadoPor, usuarioEmail: s.realizadoPor, personaId: p._id });
    }
  }

  // ── Kids ───────────────────────────────────────────────────────────────────────
  for (const k of kidsInsc) {
    const curso = [k.tipoCurso, k.salonNombre, k.horario].filter(Boolean).join(' · ');
    if (k.fechaEnvioKids) add({ id: `kids-res-${k._id}`, fecha: k.fechaEnvioKids, categoria: 'KIDS', accion: 'Reserva creada en KIDS', detalle: curso, personaId: k.beneficiarioId });
    if (k.fechaAprobacionKids) add({ id: `kids-mat-${k._id}`, fecha: k.fechaAprobacionKids, categoria: 'KIDS', accion: 'Matriculado en KIDS', detalle: curso, personaId: k.beneficiarioId });
  }

  // ── Académico (fichas de los beneficiarios) ────────────────────────────────────
  const fichaPersona = new Map<string, string>();
  for (const f of fichas) {
    if (fichaPersona.has(f._id)) continue;
    fichaPersona.set(f._id, f.personaId);
    add({ id: `ficha-${f._id}`, fecha: f._createdDate, categoria: 'ACADEMICO', accion: 'Ficha académica creada', personaId: f.personaId });
    arr(f.cambioStepHistory).forEach((h: any, i: number) => add({
      id: `step-${f._id}-${i}`, fecha: h.fecha, categoria: 'ACADEMICO',
      accion: `Cambio de step: ${h.nivelAnterior || ''} ${h.stepAnterior || ''} → ${h.nivelNuevo || ''} ${h.stepNuevo || ''}`.replace(/\s+/g, ' '),
      detalle: [h.motivo, h.autorizadoPor && `autoriza ${h.autorizadoPor}`].filter(Boolean).join(' · '),
      usuario: h.realizadoPor, personaId: f.personaId,
    }));
    const ini = json(f.inicianivel);
    if (ini?.fecha) add({ id: `ini-${f._id}`, fecha: ini.fecha, categoria: 'ACADEMICO', accion: `Nivel ${ini.nivel || ''} inicializado`,
      detalle: [`${ini.stepAnterior || ''} → ${ini.stepNuevo || ''}`, ini.bookingsEliminados != null && `${ini.bookingsEliminados} clases borradas`, ini.motivo,
        ini.autorizadoPor && `autoriza ${ini.autorizadoPor}`].filter(Boolean).join(' · '),
      usuario: ini.realizadoPor, personaId: f.personaId });
  }
  const fichaIds = Array.from(fichaPersona.keys());
  if (fichaIds.length) {
    const [welcome, overrides, certs, exams] = await Promise.all([
      leer<any>(`SELECT DISTINCT ON (COALESCE(b."studentId", b."idEstudiante")) COALESCE(b."studentId", b."idEstudiante") AS sid,
                        COALESCE(b."fechaEvento", b."fecha") AS f, COALESCE(ad."nombreCompleto", b."advisor") AS "advisor"
                   FROM "ACADEMICA_BOOKINGS" b
                   LEFT JOIN "ADVISORS" ad ON ad."_id" = b."advisor"
                  WHERE (b."studentId" = ANY($1::text[]) OR b."idEstudiante" = ANY($1::text[]))
                    AND UPPER(COALESCE(b."nivel", b."tituloONivel", '')) = 'WELCOME' AND (b."asistio" = true OR b."asistencia" = true)
                  ORDER BY COALESCE(b."studentId", b."idEstudiante"), COALESCE(b."fechaEvento", b."fecha")`, [fichaIds]),
      leer<any>(`SELECT * FROM "STEP_OVERRIDES" WHERE "studentId" = ANY($1::text[]) OR "academicaId" = ANY($1::text[])`, [fichaIds]),
      leer<any>(`SELECT * FROM "CERTIFICADOS_LOG" WHERE "studentId" = ANY($1::text[])`, [fichaIds]),
      leer<any>(`SELECT * FROM "EXAM_INTERN_AUDIT" WHERE "studentId" = ANY($1::text[])`, [fichaIds]),
    ]);
    for (const w of welcome) add({ id: `welcome-${w.sid}`, fecha: w.f, categoria: 'ACADEMICO', accion: 'Asistió a la Welcome Session',
      detalle: w.advisor ? `Advisor ${w.advisor}` : null, personaId: fichaPersona.get(w.sid) });
    for (const o of overrides) {
      const pid = fichaPersona.get(o.studentId) || fichaPersona.get(o.academicaId);
      const hist = arr(o.notaoverrideHistory);
      if (hist.length) hist.forEach((h: any, i: number) => add({ id: `ovr-${o._id}-${i}`, fecha: h.fecha, categoria: 'ACADEMICO',
        accion: `${o.nivel || ''} ${o.step || ''} marcado ${h.isCompletedAfter ? 'completo' : 'incompleto'} (override)`.trim(),
        detalle: h.motivo, usuario: h.realizadoPorNombre || h.realizadoPor, usuarioEmail: h.realizadoPor, personaId: pid }));
      else add({ id: `ovr-${o._id}`, fecha: o._createdDate || o.createdAt, categoria: 'ACADEMICO',
        accion: `${o.nivel || ''} ${o.step || ''} marcado ${o.isCompleted ? 'completo' : 'incompleto'} (override)`.trim(), personaId: pid });
    }
    for (const c of certs) add({ id: `cert-${c._id}`, fecha: c.generadoEn, categoria: 'ACADEMICO',
      accion: `Certificado ${String(c.nivel || '').replace(/^./, (x: string) => x.toUpperCase())} generado`,
      detalle: c.origen === 'ESTUDIANTE' ? 'Desde el panel del estudiante' : 'Desde el panel administrativo',
      usuario: c.generadoPor, usuarioEmail: c.generadoPor, personaId: fichaPersona.get(c.studentId) });
    for (const x of exams) add({ id: `exam-${x._id}`, fecha: x._createdDate, categoria: 'ACADEMICO',
      accion: `Exam. Intern. ${x.prueba || ''}: ${x.accion === 'EXTENDIDO' ? 'confirmado' : 'bloqueado'}`.trim(),
      detalle: x.nuevoFinalContrato ? `Nueva fecha final ${iso(x.nuevoFinalContrato)!.slice(0, 10)}` : null,
      usuario: x.ejecutadoPor, personaId: fichaPersona.get(x.studentId) });
  }

  // ── Comentarios internos ───────────────────────────────────────────────────────
  for (const p of gente) {
    (p.comentarios || []).forEach((raw: string, i: number) => {
      const c = json(raw);
      if (!c?.fecha) return;
      add({ id: `com-${p._id}-${i}`, fecha: c.fecha, categoria: 'COMENTARIO', accion: 'Comentario',
        detalle: c.texto || c.comentario || null, usuario: c.usuario || c.autor || null, usuarioEmail: c.usuario || null, personaId: p._id });
    });
  }

  // ── Depuraciones (borrados) ────────────────────────────────────────────────────
  for (const g of purgas) {
    add({ id: g._id, fecha: g._createdDate, categoria: 'MATRICULA', accion: `Depuración (${g.tipoPurga})`, detalle: g.motivo,
      usuario: g.realizadoPorNombre || g.realizadoPor, usuarioEmail: g.realizadoPor, personaId: titularId });
  }

  // Nombres legibles: los emails de quien hizo cada cosa → USUARIOS_ROLES y, para los
  // comerciales sin login, EQUIPO_COMERCIAL (una consulta cada uno).
  const emails = Array.from(new Set(ev.filter(e => e.usuario && e.usuario.includes('@')).map(e => e.usuario!.toLowerCase())));
  if (emails.length) {
    const [us, eq] = await Promise.all([
      leer<{ email: string; nombre: string }>(
        `SELECT DISTINCT ON (LOWER("email")) LOWER("email") AS email, TRIM(CONCAT_WS(' ', "nombre", "apellido")) AS nombre
           FROM "USUARIOS_ROLES" WHERE LOWER("email") = ANY($1::text[])`, [emails]),
      leer<{ email: string; nombre: string }>(
        `SELECT DISTINCT ON (LOWER(TRIM("correo"))) LOWER(TRIM("correo")) AS email, TRIM("nombre") AS nombre
           FROM "EQUIPO_COMERCIAL" WHERE LOWER(TRIM("correo")) = ANY($1::text[])`, [emails]),
    ]);
    const m = new Map([...eq, ...us].filter(u => u.nombre).map(u => [u.email, u.nombre]));
    for (const e of ev) if (e.usuario && m.has(e.usuario.toLowerCase())) { e.usuarioEmail = e.usuarioEmail || e.usuario; e.usuario = m.get(e.usuario.toLowerCase())!; }
  }

  ev.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    titularId, contrato,
    personas: gente.map(p => ({ _id: p._id, nombre: nombreDe(p), tipoUsuario: p.tipoUsuario })),
    eventos: ev,
  };
}
