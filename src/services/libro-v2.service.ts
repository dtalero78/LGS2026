/**
 * New Books v2 — libros interactivos BEGINNER / PRACTICAL / FUNCTIONAL
 * (Mantenimiento › New Books › Book BEG / PRA / FUNC New).
 *
 * Mismas reglas que el Book ESS New (book-ess.service.ts), parametrizadas por libro:
 *   - Interruptor propio por libro en APP_CONFIG (nace APAGADO).
 *   - ESTUDIANTE: sesión → resolveStudentFromSession (vencimiento/OnHold) → ficha
 *     activa + login activo + nivel de la ETAPA del libro (BN1-3 / P1-3 / F1-3).
 *     Se revalida en CADA endpoint; la identidad sale siempre de la sesión.
 *   - SUPER_ADMIN / ADMIN: vista previa de solo lectura.
 *   - Calificación solo en servidor (75%, intentos ilimitados, todos se guardan,
 *     mejor nota), idempotente por requestId. Completo = todos los checkpoints
 *     requeridos (12 episodios + 2 Jump + final). Lectura y respuestas abiertas
 *     no condicionan el avance. Nada promueve el nivel académico.
 */
import 'server-only';
import { Session } from 'next-auth';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { query, queryMany, queryOne, transaction } from '@/lib/postgres';
import { ids } from '@/lib/id-generator';
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from '@/lib/errors';
import { AppConfigRepository } from '@/repositories/config.repository';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { getEtapaForNivel } from '@/lib/etapas';
import { LIBROS_V2, LibroV2Meta, SlugLibroV2, libroV2 } from '@/lib/libros-v2-catalogo';
import {
  CONTENT_VERSION_V2, SIGNED_URL_TTL_V2, PERSONAJES_V2, contenidoV2, claveRetrato, vistaAlumno,
} from '@/lib/libros-v2-contenido';

type Ctx =
  | { modo: 'estudiante'; studentId: string; numeroId: string | null; nombre: string }
  | { modo: 'preview'; nombre: string };

const ROLES_PREVIEW = ['SUPER_ADMIN', 'ADMIN'];
const FLAG_TTL_MS = 60 * 1000;
const flagCache = new Map<string, { value: boolean; expires: number }>();

function meta(slug: string): LibroV2Meta {
  const m = libroV2(slug);
  if (!m) throw new NotFoundError('Libro', slug);
  return m;
}

async function isActive(slug: string): Promise<boolean> {
  const m = meta(slug);
  const hit = flagCache.get(m.flagKey);
  if (hit && hit.expires > Date.now()) return hit.value;
  const row = await AppConfigRepository.get(m.flagKey);
  const value = String(row?.value ?? 'false').toLowerCase() === 'true';
  flagCache.set(m.flagKey, { value, expires: Date.now() + FLAG_TTL_MS });
  return value;
}

async function setActive(slug: string, active: boolean, actor: string) {
  const m = meta(slug);
  await AppConfigRepository.set(m.flagKey, active ? 'true' : 'false', '#ffffff', actor);
  flagCache.set(m.flagKey, { value: active, expires: Date.now() + FLAG_TTL_MS });
}

async function motivoBloqueo(slug: string, session: Session): Promise<{ motivo: string | null; ctx?: Ctx }> {
  const m = meta(slug);
  if (!(await isActive(slug))) return { motivo: 'El libro no está disponible por ahora.' };
  const student: any = await resolveStudentFromSession(session);
  if (student.estadoInactivo === true) return { motivo: 'Tu cuenta está inactiva (contrato vencido, en pausa o suspendido).' };
  const login = await queryOne<{ activo: boolean | null }>(
    `SELECT "activo" FROM "USUARIOS_ROLES" WHERE LOWER("email") = LOWER($1) ORDER BY "activo" DESC NULLS LAST LIMIT 1`,
    [session.user?.email || ''],
  );
  if (!login || login.activo === false) return { motivo: 'Tu acceso a la plataforma está inactivo.' };
  const nivel = String(student.nivel || '').replace(/\s*JUMP\s*/i, '').trim().toUpperCase();
  if (getEtapaForNivel(nivel) !== m.etapa) return { motivo: `Este libro es para la etapa ${m.nivel}.` };
  const studentId = student.academicaId || student._id;
  if (!studentId) return { motivo: 'No encontramos tu ficha académica.' };
  const nombre = [student.primerNombre, student.primerApellido].filter(Boolean).join(' ').trim();
  return { motivo: null, ctx: { modo: 'estudiante', studentId, numeroId: student.numeroId ?? null, nombre } };
}

async function autorizar(slug: string, session: Session, escritura = false): Promise<Ctx> {
  meta(slug);
  const role = String((session.user as any)?.role || '').toUpperCase();
  if (ROLES_PREVIEW.includes(role)) {
    if (escritura) throw new ForbiddenError('Vista previa: el avance no se guarda');
    return { modo: 'preview', nombre: String(session.user?.name || 'Vista previa') };
  }
  if (role !== 'ESTUDIANTE') throw new ForbiddenError('No autorizado');
  const { motivo, ctx } = await motivoBloqueo(slug, session);
  if (motivo || !ctx) throw new ForbiddenError(motivo || 'No autorizado');
  return ctx;
}

async function firmar(key: string, disposition?: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: SPACES_BUCKET, Key: key, ...(disposition ? { ResponseContentDisposition: disposition } : {}) });
  return getSignedUrl(spacesClient, cmd, { expiresIn: SIGNED_URL_TTL_V2 });
}

async function avance(slug: SlugLibroV2, studentId: string) {
  const c = contenidoV2(slug);
  const vistas = await queryMany<{ pageId: string }>(
    `SELECT "pageId" FROM "LIBRO_PAGINAS_VISTAS" WHERE "studentId" = $1 AND "bookCode" = $2 AND "contentVersion" = $3`,
    [studentId, c.bookCode, CONTENT_VERSION_V2],
  );
  const intentos = await queryMany<{ assessmentId: string; correctas: number; total: number; aprobado: boolean; creadoEn: string }>(
    `SELECT "assessmentId", "correctas", "total", "aprobado", "creadoEn" FROM "LIBRO_INTENTOS"
      WHERE "studentId" = $1 AND "bookCode" = $2 AND "contentVersion" = $3 ORDER BY "creadoEn" DESC LIMIT 300`,
    [studentId, c.bookCode, CONTENT_VERSION_V2],
  );
  const resp = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM "LIBRO_RESPUESTAS_ABIERTAS" WHERE "studentId" = $1 AND "bookCode" = $2 AND "contentVersion" = $3`,
    [studentId, c.bookCode, CONTENT_VERSION_V2],
  );
  const mejor: Record<string, { mejor: number; total: number; aprobado: boolean; intentos: number }> = {};
  for (const i of intentos) {
    const m = mejor[i.assessmentId] || { mejor: 0, total: i.total, aprobado: false, intentos: 0 };
    m.mejor = Math.max(m.mejor, i.correctas);
    m.aprobado = m.aprobado || i.aprobado;
    m.intentos += 1;
    mejor[i.assessmentId] = m;
  }
  const requeridos = c.checkpoints.filter((x) => x.required);
  const aprobados = requeridos.filter((x) => mejor[x.id]?.aprobado).length;
  const cpPorId = c.checkpointPorId;
  return {
    paginasVistas: vistas.map((v) => v.pageId),
    evaluaciones: mejor,
    aprobados,
    totalRequeridos: requeridos.length,
    completado: aprobados === requeridos.length,
    respuestasGuardadas: resp?.n ?? 0,
    historial: intentos.map((i) => ({
      assessmentId: i.assessmentId,
      step: cpPorId.get(i.assessmentId)?.stepNumber ?? null,
      plus: cpPorId.get(i.assessmentId)?.kind === 'plus',
      correctas: i.correctas,
      total: i.total,
      aprobado: i.aprobado,
      creadoEn: i.creadoEn,
    })),
  };
}

export const libroV2Service = {
  isActive,
  setActive,

  async disponibilidad(slug: string, session: Session) {
    meta(slug);
    const role = String((session.user as any)?.role || '').toUpperCase();
    if (ROLES_PREVIEW.includes(role)) return { disponible: true, preview: true };
    if (role !== 'ESTUDIANTE') return { disponible: false, preview: false };
    try {
      const { motivo } = await motivoBloqueo(slug, session);
      return { disponible: !motivo, preview: false };
    } catch {
      return { disponible: false, preview: false };
    }
  },

  async libro(slug: string, session: Session) {
    const ctx = await autorizar(slug, session);
    const m = meta(slug);
    const c = contenidoV2(m.slug);
    const est = ctx.modo === 'estudiante' ? ctx : null;
    const respuestas = est
      ? Object.fromEntries((await queryMany<{ activityId: string; texto: string; comentarioDocente: string | null }>(
          `SELECT "activityId", "texto", "comentarioDocente" FROM "LIBRO_RESPUESTAS_ABIERTAS"
            WHERE "studentId" = $1 AND "bookCode" = $2 AND "contentVersion" = $3`,
          [est.studentId, c.bookCode, CONTENT_VERSION_V2],
        )).map((r) => [r.activityId, { texto: r.texto, comentarioDocente: r.comentarioDocente }]))
      : {};
    return {
      slug: m.slug,
      bookCode: c.bookCode,
      version: CONTENT_VERSION_V2,
      level: m.nivel,
      headline: m.headline,
      intro: m.intro,
      accent: m.accent,
      secondary: m.secondary,
      paper: m.paper,
      preview: ctx.modo === 'preview',
      flagActivo: await isActive(slug),
      alumno: { nombre: ctx.nombre },
      // Retratos firmados (10 min), igual que las páginas.
      personajes: Object.fromEntries(await Promise.all(PERSONAJES_V2.map(async (n) => [n, await firmar(claveRetrato(c, n))]))),
      ...vistaAlumno(c),
      avance: est ? await avance(m.slug, est.studentId) : null,
      respuestas,
    };
  },

  async urlPagina(slug: string, session: Session, pageId: string) {
    await autorizar(slug, session);
    const p = contenidoV2(meta(slug).slug).paginaPorId.get(String(pageId || ''));
    if (!p) throw new NotFoundError('Página', pageId);
    return { url: await firmar(p.objectKey), expiraEn: SIGNED_URL_TTL_V2 };
  },

  async urlPdf(slug: string, session: Session, descargar: boolean) {
    await autorizar(slug, session);
    const m = meta(slug);
    const c = contenidoV2(m.slug);
    const nombre = `LGS_${m.nivel}.pdf`;
    return { url: await firmar(c.pdfKey, `${descargar ? 'attachment' : 'inline'}; filename="${nombre}"`), expiraEn: SIGNED_URL_TTL_V2 };
  },

  async registrarVista(slug: string, session: Session, pageId: string) {
    const ctx = await autorizar(slug, session, true);
    if (ctx.modo !== 'estudiante') throw new ForbiddenError('No autorizado');
    const c = contenidoV2(meta(slug).slug);
    const p = c.paginaPorId.get(String(pageId || ''));
    if (!p) throw new NotFoundError('Página', pageId);
    await query(
      `INSERT INTO "LIBRO_PAGINAS_VISTAS" ("_id","studentId","numeroId","bookCode","contentVersion","pageId")
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ("studentId","bookCode","contentVersion","pageId") DO NOTHING`,
      [ids.libro(), ctx.studentId, ctx.numeroId, c.bookCode, CONTENT_VERSION_V2, p.id],
    );
    return { pageId: p.id, leida: true };
  },

  async calificar(slug: string, session: Session, body: any) {
    const ctx = await autorizar(slug, session, true);
    if (ctx.modo !== 'estudiante') throw new ForbiddenError('No autorizado');
    const m = meta(slug);
    const c = contenidoV2(m.slug);

    const requestId = String(body?.requestId || '');
    if (!/^[A-Za-z0-9-]{8,64}$/.test(requestId)) throw new ValidationError('requestId inválido');
    if (body?.contentVersion && body.contentVersion !== CONTENT_VERSION_V2) throw new ConflictError('El libro se actualizó: recarga la página');
    const cp = c.checkpointPorId.get(String(body?.checkpointId || ''));
    if (!cp) throw new ValidationError('Checkpoint inválido');

    const answers: any[] = Array.isArray(body?.answers) ? body.answers : [];
    if (answers.length !== cp.activityIds.length) throw new ValidationError('Debes responder todas las preguntas');
    const vistos = new Set<string>();
    const respuestas = answers.map((a) => {
      const activityId = String(a?.activityId || '');
      const optionId = String(a?.optionId || '');
      if (!cp.activityIds.includes(activityId)) throw new ValidationError('Pregunta que no pertenece a este checkpoint');
      if (vistos.has(activityId)) throw new ValidationError('Pregunta repetida');
      vistos.add(activityId);
      const act = c.actividades.get(activityId);
      if (!act || act.type !== 'single_choice') throw new ValidationError('Pregunta inválida');
      if (!(act.options || []).some((o) => o.id === optionId)) throw new ValidationError('Opción inválida');
      return { activityId, optionId, correcta: optionId === act.correctOptionId };
    });
    const correctas = respuestas.filter((r) => r.correcta).length;
    const aprobado = correctas >= cp.minimo;

    const guardado = await transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO "LIBRO_INTENTOS" ("_id","requestId","studentId","numeroId","bookCode","contentVersion",
            "assessmentId","correctas","total","aprobado","respuestas")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT ("requestId") DO NOTHING
         RETURNING "correctas","total","aprobado","respuestas"`,
        [ids.libro(), requestId, ctx.studentId, ctx.numeroId, c.bookCode, CONTENT_VERSION_V2,
         cp.id, correctas, cp.total, aprobado, JSON.stringify(respuestas)],
      );
      if (ins.rows[0]) return ins.rows[0];
      const prev = await client.query(
        `SELECT "correctas","total","aprobado","respuestas","studentId","assessmentId" FROM "LIBRO_INTENTOS" WHERE "requestId" = $1`,
        [requestId],
      );
      const row = prev.rows[0];
      if (!row || row.studentId !== ctx.studentId || row.assessmentId !== cp.id) throw new ConflictError('requestId ya usado');
      return row;
    });

    const resp = typeof guardado.respuestas === 'string' ? JSON.parse(guardado.respuestas) : guardado.respuestas;
    return {
      checkpointId: cp.id,
      correctas: guardado.correctas,
      total: guardado.total,
      aprobado: guardado.aprobado,
      score: Math.round((100 * guardado.correctas) / guardado.total),
      // Como el prototipo: por pregunta solo ✓ / Revisar (nunca la opción correcta).
      detalles: (resp as any[]).map((r) => ({ activityId: r.activityId, correcta: r.correcta })),
      avance: await avance(m.slug, ctx.studentId),
    };
  },

  async guardarRespuesta(slug: string, session: Session, body: any) {
    const ctx = await autorizar(slug, session, true);
    if (ctx.modo !== 'estudiante') throw new ForbiddenError('No autorizado');
    const c = contenidoV2(meta(slug).slug);
    const act = c.actividades.get(String(body?.activityId || ''));
    if (!act || act.type !== 'open_response') throw new ValidationError('Actividad inválida');
    const texto = String(body?.texto ?? '').trim();
    if (!texto) throw new ValidationError('Escribe tu respuesta antes de guardar');
    const max = act.maxLength ?? 6000;
    if (texto.length > max) throw new ValidationError(`La respuesta supera ${max} caracteres`);
    await query(
      `INSERT INTO "LIBRO_RESPUESTAS_ABIERTAS" ("_id","studentId","numeroId","bookCode","contentVersion","activityId","texto")
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT ("studentId","bookCode","contentVersion","activityId")
       DO UPDATE SET "texto" = EXCLUDED."texto", "actualizadoEn" = NOW()`,
      [ids.libro(), ctx.studentId, ctx.numeroId, c.bookCode, CONTENT_VERSION_V2, act.id, texto],
    );
    return { activityId: act.id, guardado: true, respuestasGuardadas: (await avance(meta(slug).slug, ctx.studentId)).respuestasGuardadas };
  },

  slugs: Object.keys(LIBROS_V2) as SlugLibroV2[],
};
