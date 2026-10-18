/**
 * Book ESS New — libro interactivo ST00-00 (LGS ESSENTIAL) para alumnos ESS.
 *
 * Autorización (se repite en CADA endpoint: abrir, página, PDF, vista, intento, respuesta):
 *   - Interruptor `APP_CONFIG.book_ess_new_activo` (Mantenimiento › New Books › Book ESS New, nace APAGADO).
 *   - ESTUDIANTE: sesión → resolveStudentFromSession (aplica vencimiento/OnHold) →
 *     ficha activa, login activo en USUARIOS_ROLES, nivel ESS y step "Step 0".
 *     La identidad sale SIEMPRE de la sesión, nunca del cuerpo de la solicitud.
 *   - SUPER_ADMIN / ADMIN: vista previa de solo lectura (aunque el interruptor esté
 *     apagado); no registran avance ni intentos.
 *
 * Calificación solo en servidor contra la clave (book-ess-content). Reglas del
 * paquete (data/progress-policy.json): 3/4 aprueba una unidad, 9/12 el reto final,
 * reintentos ilimitados, se guardan todos y se muestra la mejor nota; un intento
 * posterior menor no quita el sello. Libro completo = 12 unidades + final.
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
import {
  BOOK_CODE, CONTENT_VERSION, BOOK_TITLE, BOOK_NIVEL, BOOK_STEP, PDF_KEY, SIGNED_URL_TTL,
  TOTAL_UNIDADES, FINAL_ID, PAGINAS, PAGINAS_REQUERIDAS, EVALUACIONES,
  paginaPorId, evaluacionPorId, actividad, actividadesParaAlumno, unidades, lecciones, claveImagenUnidad,
} from '@/lib/book-ess-content';

export const FLAG_KEY = 'book_ess_new_activo';
const FLAG_TTL_MS = 60 * 1000;
let flagCache: { value: boolean; expires: number } | null = null;

export type BookCtx =
  | { modo: 'estudiante'; studentId: string; numeroId: string | null; nombre: string }
  | { modo: 'preview'; nombre: string };

const ROLES_PREVIEW = ['SUPER_ADMIN', 'ADMIN'];

async function isActive(): Promise<boolean> {
  if (flagCache && flagCache.expires > Date.now()) return flagCache.value;
  const row = await AppConfigRepository.get(FLAG_KEY);
  const value = String(row?.value ?? 'false').toLowerCase() === 'true';
  flagCache = { value, expires: Date.now() + FLAG_TTL_MS };
  return value;
}

async function setActive(active: boolean, actor: string): Promise<void> {
  await AppConfigRepository.set(FLAG_KEY, active ? 'true' : 'false', '#ffffff', actor);
  flagCache = { value: active, expires: Date.now() + FLAG_TTL_MS };
}

/** Motivo legible por el que un estudiante no puede abrir el libro (null = puede). */
async function motivoBloqueo(session: Session): Promise<{ motivo: string | null; ctx?: BookCtx }> {
  if (!(await isActive())) return { motivo: 'El libro no está disponible por ahora.' };
  const student: any = await resolveStudentFromSession(session);
  if (student.estadoInactivo === true) return { motivo: 'Tu cuenta está inactiva (contrato vencido, en pausa o suspendido).' };
  const login = await queryOne<{ activo: boolean | null }>(
    `SELECT "activo" FROM "USUARIOS_ROLES" WHERE LOWER("email") = LOWER($1) ORDER BY "activo" DESC NULLS LAST LIMIT 1`,
    [session.user?.email || ''],
  );
  if (!login || login.activo === false) return { motivo: 'Tu acceso a la plataforma está inactivo.' };
  const nivel = String(student.nivel || '').toUpperCase().trim();
  const step = String(student.step || '').trim();
  if (nivel !== BOOK_NIVEL || step !== BOOK_STEP) {
    return { motivo: `Este libro es para el nivel Essential (${BOOK_NIVEL} · ${BOOK_STEP}).` };
  }
  const studentId = student.academicaId || student._id;
  if (!studentId) return { motivo: 'No encontramos tu ficha académica.' };
  const nombre = [student.primerNombre, student.primerApellido].filter(Boolean).join(' ').trim();
  return { motivo: null, ctx: { modo: 'estudiante', studentId, numeroId: student.numeroId ?? null, nombre } };
}

/** Autoriza la solicitud o lanza 403. `escritura` excluye la vista previa de admin. */
async function autorizar(session: Session, escritura = false): Promise<BookCtx> {
  const role = String((session.user as any)?.role || '').toUpperCase();
  if (ROLES_PREVIEW.includes(role)) {
    if (escritura) throw new ForbiddenError('Vista previa: el avance no se guarda');
    return { modo: 'preview', nombre: String(session.user?.name || 'Vista previa') };
  }
  if (role !== 'ESTUDIANTE') throw new ForbiddenError('No autorizado');
  const { motivo, ctx } = await motivoBloqueo(session);
  if (motivo || !ctx) throw new ForbiddenError(motivo || 'No autorizado');
  return ctx;
}

async function firmar(key: string, disposition?: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: SPACES_BUCKET, Key: key,
    ...(disposition ? { ResponseContentDisposition: disposition } : {}),
  });
  return getSignedUrl(spacesClient, cmd, { expiresIn: SIGNED_URL_TTL });
}

async function avance(studentId: string) {
  const vistas = await queryMany<{ pageId: string }>(
    `SELECT "pageId" FROM "LIBRO_PAGINAS_VISTAS"
      WHERE "studentId" = $1 AND "bookCode" = $2 AND "contentVersion" = $3`,
    [studentId, BOOK_CODE, CONTENT_VERSION],
  );
  const vistasSet = new Set(vistas.map((v) => v.pageId));
  const requeridasVistas = PAGINAS.filter((p) => p.requerida && vistasSet.has(p.id)).length;

  const intentos = await queryMany<{ assessmentId: string; mejor: number; total: number; aprobado: boolean; intentos: number; ultimo: string }>(
    `SELECT "assessmentId", MAX("correctas")::int AS mejor, MAX("total")::int AS total,
            BOOL_OR("aprobado") AS aprobado, COUNT(*)::int AS intentos, MAX("creadoEn") AS ultimo
       FROM "LIBRO_INTENTOS"
      WHERE "studentId" = $1 AND "bookCode" = $2 AND "contentVersion" = $3
      GROUP BY "assessmentId"`,
    [studentId, BOOK_CODE, CONTENT_VERSION],
  );
  const porEval: Record<string, { mejor: number; total: number; aprobado: boolean; intentos: number; ultimo: string }> = {};
  for (const i of intentos) porEval[i.assessmentId] = { mejor: i.mejor, total: i.total, aprobado: i.aprobado, intentos: i.intentos, ultimo: i.ultimo };

  const unidadesAprobadas = EVALUACIONES.filter((e) => e.id !== FINAL_ID && porEval[e.id]?.aprobado).length;
  const finalAprobado = !!porEval[FINAL_ID]?.aprobado;
  return {
    paginasVistas: Array.from(vistasSet),
    lectura: { vistas: requeridasVistas, total: PAGINAS_REQUERIDAS, porcentaje: Math.floor((100 * requeridasVistas) / PAGINAS_REQUERIDAS) },
    evaluaciones: porEval,
    unidadesAprobadas,
    totalUnidades: TOTAL_UNIDADES,
    finalAprobado,
    completado: unidadesAprobadas === TOTAL_UNIDADES && finalAprobado,
  };
}

async function respuestasAbiertas(studentId: string) {
  const rows = await queryMany<{ activityId: string; texto: string; actualizadoEn: string; comentarioDocente: string | null }>(
    `SELECT "activityId", "texto", "actualizadoEn", "comentarioDocente" FROM "LIBRO_RESPUESTAS_ABIERTAS"
      WHERE "studentId" = $1 AND "bookCode" = $2 AND "contentVersion" = $3`,
    [studentId, BOOK_CODE, CONTENT_VERSION],
  );
  return Object.fromEntries(rows.map((r) => [r.activityId, { texto: r.texto, actualizadoEn: r.actualizadoEn, comentarioDocente: r.comentarioDocente }]));
}

export const bookEssService = {
  isActive,
  setActive,

  /** Para el botón del panel: ¿este alumno ve "Book ESS New"? Nunca lanza por nivel/flag. */
  async disponibilidad(session: Session): Promise<{ disponible: boolean; preview: boolean }> {
    const role = String((session.user as any)?.role || '').toUpperCase();
    if (ROLES_PREVIEW.includes(role)) return { disponible: true, preview: true };
    if (role !== 'ESTUDIANTE') return { disponible: false, preview: false };
    try {
      const { motivo } = await motivoBloqueo(session);
      return { disponible: !motivo, preview: false };
    } catch {
      return { disponible: false, preview: false };
    }
  },

  /** Estructura del libro + actividades (sin clave) + avance del alumno. */
  async libro(session: Session) {
    const ctx = await autorizar(session);
    const est = ctx.modo === 'estudiante' ? ctx : null;
    return {
      bookCode: BOOK_CODE,
      version: CONTENT_VERSION,
      titulo: BOOK_TITLE,
      preview: ctx.modo === 'preview',
      flagActivo: await isActive(),
      alumno: { nombre: ctx.nombre },
      paginas: PAGINAS.map(({ objectKey, ...p }) => p),
      lecciones: lecciones(),
      // Fotos de unidad: URL firmada (10 min), igual que las páginas.
      imagenes: Object.fromEntries(
        await Promise.all(Array.from({ length: TOTAL_UNIDADES }, async (_, i) => [i + 1, await firmar(claveImagenUnidad(i + 1))])),
      ),
      unidades: unidades(),
      actividades: actividadesParaAlumno(),
      evaluaciones: EVALUACIONES,
      avance: est ? await avance(est.studentId) : null,
      respuestas: est ? await respuestasAbiertas(est.studentId) : {},
    };
  },

  /** URL firmada (10 min) de una página. Solo IDs del manifiesto. */
  async urlPagina(session: Session, pageId: string) {
    await autorizar(session);
    const p = paginaPorId(String(pageId || ''));
    if (!p) throw new NotFoundError('Página', pageId);
    return { url: await firmar(p.objectKey), expiraEn: SIGNED_URL_TTL };
  },

  async urlPdf(session: Session, descargar: boolean) {
    await autorizar(session);
    const disp = `${descargar ? 'attachment' : 'inline'}; filename="LGS_ESSENTIAL.pdf"`;
    return { url: await firmar(PDF_KEY, disp), expiraEn: SIGNED_URL_TTL };
  },

  /** Página vista (el cliente la avisa tras ≥5 s visible). Deduplicada por alumno/página. */
  async registrarVista(session: Session, pageId: string) {
    const ctx = await autorizar(session, true);
    if (ctx.modo !== 'estudiante') throw new ForbiddenError('No autorizado');
    const p = paginaPorId(String(pageId || ''));
    if (!p) throw new NotFoundError('Página', pageId);
    await query(
      `INSERT INTO "LIBRO_PAGINAS_VISTAS" ("_id","studentId","numeroId","bookCode","contentVersion","pageId")
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ("studentId","bookCode","contentVersion","pageId") DO NOTHING`,
      [ids.libro(), ctx.studentId, ctx.numeroId, BOOK_CODE, CONTENT_VERSION, p.id],
    );
    return { lectura: (await avance(ctx.studentId)).lectura };
  },

  /** Califica un intento completo de una evaluación. Idempotente por requestId. */
  async calificar(session: Session, body: any) {
    const ctx = await autorizar(session, true);
    if (ctx.modo !== 'estudiante') throw new ForbiddenError('No autorizado');

    const requestId = String(body?.requestId || '');
    if (!/^[A-Za-z0-9-]{8,64}$/.test(requestId)) throw new ValidationError('requestId inválido');
    if (body?.bookCode && body.bookCode !== BOOK_CODE) throw new ValidationError('Libro inválido');
    if (body?.contentVersion && body.contentVersion !== CONTENT_VERSION) {
      throw new ConflictError('El libro se actualizó: recarga la página');
    }
    const ev = evaluacionPorId(String(body?.assessmentId || ''));
    if (!ev) throw new ValidationError('Evaluación inválida');

    const answers: any[] = Array.isArray(body?.answers) ? body.answers : [];
    if (answers.length !== ev.activityIds.length) throw new ValidationError('Debes responder todas las preguntas');
    const vistos = new Set<string>();
    const respuestas = answers.map((a) => {
      const activityId = String(a?.activityId || '');
      const optionId = String(a?.optionId || '');
      if (!ev.activityIds.includes(activityId)) throw new ValidationError('Pregunta que no pertenece a esta evaluación');
      if (vistos.has(activityId)) throw new ValidationError('Pregunta repetida');
      vistos.add(activityId);
      const act = actividad(activityId);
      if (!act || act.type !== 'single_choice') throw new ValidationError('Pregunta inválida');
      if (!(act.options || []).some((o) => o.id === optionId)) throw new ValidationError('Opción inválida');
      return { activityId, optionId, correcta: optionId === act.correct_option_id };
    });
    const correctas = respuestas.filter((r) => r.correcta).length;
    const aprobado = correctas >= ev.aprobarCon;

    const guardado = await transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO "LIBRO_INTENTOS" ("_id","requestId","studentId","numeroId","bookCode","contentVersion",
            "assessmentId","correctas","total","aprobado","respuestas")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT ("requestId") DO NOTHING
         RETURNING "correctas","total","aprobado","respuestas"`,
        [ids.libro(), requestId, ctx.studentId, ctx.numeroId, BOOK_CODE, CONTENT_VERSION,
         ev.id, correctas, ev.activityIds.length, aprobado, JSON.stringify(respuestas)],
      );
      if (ins.rows[0]) return ins.rows[0];
      // Reintento de red con el mismo requestId: devolver el intento ya guardado (solo si es suyo).
      const prev = await client.query(
        `SELECT "correctas","total","aprobado","respuestas","studentId","assessmentId" FROM "LIBRO_INTENTOS" WHERE "requestId" = $1`,
        [requestId],
      );
      const row = prev.rows[0];
      if (!row || row.studentId !== ctx.studentId || row.assessmentId !== ev.id) throw new ConflictError('requestId ya usado');
      return row;
    });

    const resp = typeof guardado.respuestas === 'string' ? JSON.parse(guardado.respuestas) : guardado.respuestas;
    return {
      assessmentId: ev.id,
      correctas: guardado.correctas,
      total: guardado.total,
      aprobado: guardado.aprobado,
      aprobarCon: ev.aprobarCon,
      // Retroalimentación tras enviar: si acertó y la explicación; nunca la opción correcta.
      resultados: (resp as any[]).map((r) => ({
        activityId: r.activityId,
        correcta: r.correcta,
        explicacion: actividad(r.activityId)?.explanation ?? null,
      })),
      avance: await avance(ctx.studentId),
    };
  },

  /** Guarda (o actualiza) una respuesta escrita. Sin nota automática. */
  async guardarRespuesta(session: Session, body: any) {
    const ctx = await autorizar(session, true);
    if (ctx.modo !== 'estudiante') throw new ForbiddenError('No autorizado');
    const act = actividad(String(body?.activityId || ''));
    if (!act || act.type !== 'open_response') throw new ValidationError('Actividad inválida');
    const texto = String(body?.texto ?? '').trim();
    if (!texto) throw new ValidationError('Escribe tu respuesta antes de guardar');
    const max = act.max_length ?? 4000;
    if (texto.length > max) throw new ValidationError(`La respuesta supera ${max} caracteres`);
    await query(
      `INSERT INTO "LIBRO_RESPUESTAS_ABIERTAS" ("_id","studentId","numeroId","bookCode","contentVersion","activityId","texto")
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT ("studentId","bookCode","contentVersion","activityId")
       DO UPDATE SET "texto" = EXCLUDED."texto", "actualizadoEn" = NOW()`,
      [ids.libro(), ctx.studentId, ctx.numeroId, BOOK_CODE, CONTENT_VERSION, act.id, texto],
    );
    return { activityId: act.id, guardado: true };
  },
};
