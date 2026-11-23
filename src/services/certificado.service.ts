import 'server-only';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { generateId } from '@/lib/id-generator';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { BookingRepository } from '@/repositories/booking.repository';
import { buildCertificadoPdf, type NivelCertificado } from '@/lib/certificado-pdf';
import { moraService, type BloqueoMora } from '@/services/mora.service';
import { AppConfigRepository } from '@/repositories/config.repository';

// Interruptor: ¿el PDF sale con clave (= número de documento)? Default APAGADO (sin clave).
const CLAVE_KEY = 'certificado_clave_activo';
let claveCache: { value: boolean; expires: number } | null = null;
export async function certificadoClaveActiva(): Promise<boolean> {
  const now = Date.now();
  if (claveCache && claveCache.expires > now) return claveCache.value;
  const row = await AppConfigRepository.get(CLAVE_KEY);
  const value = row?.value === 'true';
  claveCache = { value, expires: now + 60_000 };
  return value;
}
export async function setCertificadoClaveActiva(active: boolean, actor: string): Promise<void> {
  await AppConfigRepository.set(CLAVE_KEY, active ? 'true' : 'false', '#ffffff', actor);
  claveCache = null;
}

/**
 * Certificados de finalización de nivel del estudiante.
 *
 * Nivel ↔ Jump: Beginner = Jump 15, Practical = Jump 30, Functional = Jump 45.
 * "Aprobado" = existe la SESIÓN del jump (no un club) que cumple la regla dura
 * `asistió + participó + no reprobó + no canceló` (misma de la promoción). La
 * fecha del certificado = fecha del PRIMER jump aprobado (fechaEvento).
 *
 * OJO: se miran TODOS los bookings del alumno (el jump de un nivel ya superado
 * no está en el "nivel actual"), no solo los del nivel en curso.
 */

const JUMP_BY_NIVEL: Record<NivelCertificado, number> = { beginner: 15, practical: 30, functional: 45 };
const HORAS = 60;
export const NIVELES_CERT: NivelCertificado[] = ['beginner', 'practical', 'functional'];

function extractStepNumber(s: any): number | null {
  const m = String(s ?? '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function aproboElJump(b: any): boolean {
  const asistio = b.asistio === true || b.asistencia === true;
  return asistio && b.participacion === true && b.noAprobo !== true && b.cancelo !== true;
}
// El jump es una SESIÓN (ej. "Step 15"), no un club ("TRAINING - Step 15").
function esSesionJump(b: any, jump: number): boolean {
  if (extractStepNumber(b?.step) !== jump) return false;
  if (/[A-Za-z]+\s*-\s*step/i.test(String(b?.step ?? ''))) return false; // club de training
  if (b?.tipo === 'CLUB') return false;
  return true;
}

export interface CertificadoEstado {
  nombre: string;
  numeroId: string;
  // `yaGenerado` = el alumno ya generó ese certificado desde el panel estudiante
  // (límite de UNA sola vez). En el panel admin siempre viene false (sin límite).
  // `generadoEn` = fecha/hora en que el ALUMNO lo generó desde su panel (informativo; se
  // muestra en ambos paneles, pero solo bloquea en el del estudiante vía `yaGenerado`).
  niveles: Record<NivelCertificado, { aprobado: boolean; fecha: string | null; yaGenerado: boolean; generadoEn: string | null }>;
  // Causa del bloqueo por mora (null = puede generar). Ver moraService.getBloqueoCertificado.
  bloqueoMora?: BloqueoMora | null;
  // ¿El PDF sale con clave? (interruptor APP_CONFIG `certificado_clave_activo`, default apagado)
  claveActiva?: boolean;
}

// ── Registro "certificado ya generado por el alumno" (límite de una vez) ──────
// Solo se escribe/consulta desde el panel del estudiante. El panel admin no lo
// consume ni lo respeta (staff puede regenerar).
let ensureGeneradosPromise: Promise<void> | null = null;
function ensureTablaGenerados(): Promise<void> {
  if (!ensureGeneradosPromise) {
    ensureGeneradosPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS "CERTIFICADOS_GENERADOS" (
          "_id"        TEXT PRIMARY KEY,
          "studentId"  TEXT NOT NULL,
          "numeroId"   TEXT,
          "nivel"      TEXT NOT NULL,
          "nombre"     TEXT,
          "generadoEn" TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "CERTIFICADOS_GENERADOS_student_nivel_uidx"
          ON "CERTIFICADOS_GENERADOS" ("studentId","nivel")
      `);
    })().catch((e) => { ensureGeneradosPromise = null; throw e; });
  }
  return ensureGeneradosPromise;
}

// nivel → fecha/hora (ISO) en que el alumno lo generó desde su panel.
async function getGenerados(studentId: string): Promise<Map<NivelCertificado, string>> {
  await ensureTablaGenerados();
  const rows = await queryMany<any>(
    `SELECT "nivel", "generadoEn" FROM "CERTIFICADOS_GENERADOS" WHERE "studentId" = $1`, [studentId]);
  const m = new Map<NivelCertificado, string>();
  for (const r of rows) {
    if (!NIVELES_CERT.includes(r.nivel)) continue;
    const f = r.generadoEn instanceof Date ? r.generadoEn : new Date(r.generadoEn);
    m.set(r.nivel as NivelCertificado, isNaN(f.getTime()) ? '' : f.toISOString());
  }
  return m;
}

// Historial de CADA generación (estudiante y admin) → informe Académica › Certificados.
// Tabla creada por scripts/create-certificados-log.js. Best-effort: nunca rompe la descarga.
async function registrarLog(studentId: string, numeroId: string, nivel: NivelCertificado, nombre: string,
                            origen: 'ESTUDIANTE' | 'ADMIN', generadoPor: string | null): Promise<void> {
  try {
    await query(
      `INSERT INTO "CERTIFICADOS_LOG" ("_id","studentId","numeroId","nivel","nombre","origen","generadoPor","generadoEn")
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [generateId('clog'), studentId, numeroId || null, nivel, nombre || null, origen, generadoPor]);
  } catch (e: any) {
    console.error('[certificado] no se pudo registrar CERTIFICADOS_LOG:', e?.message || e);
  }
}

async function marcarGenerado(studentId: string, numeroId: string, nivel: NivelCertificado, nombre: string): Promise<void> {
  await ensureTablaGenerados();
  await query(
    `INSERT INTO "CERTIFICADOS_GENERADOS" ("_id","studentId","numeroId","nivel","nombre","generadoEn")
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT ("studentId","nivel") DO NOTHING`,
    [generateId('cert'), studentId, numeroId || null, nivel, nombre || null]);
}

async function loadInfo(id: string): Promise<{ academicaId: string; contrato: string | null; nombre: string; numeroId: string; niveles: CertificadoEstado['niveles'] }> {
  const SEL = `SELECT "_id","numeroId","contrato","primerNombre","segundoNombre","primerApellido","segundoApellido"`;
  let acad = await queryOne<any>(`${SEL} FROM "ACADEMICA" WHERE "_id" = $1`, [id]);
  if (!acad) {
    // El id puede venir como PEOPLE._id (detalle admin) → resolver por numeroId.
    const person = await queryOne<any>(`SELECT "numeroId" FROM "PEOPLE" WHERE "_id" = $1`, [id]);
    if (person?.numeroId) acad = await queryOne<any>(`${SEL} FROM "ACADEMICA" WHERE "numeroId" = $1 LIMIT 1`, [person.numeroId]);
  }
  if (!acad) throw new NotFoundError('ACADEMICA', id);

  const academicaId = acad._id as string;
  const nombre = [acad.primerNombre, acad.segundoNombre, acad.primerApellido, acad.segundoApellido]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const bookings = await BookingRepository.findByStudentId(academicaId, 1000);
  const niveles = {} as CertificadoEstado['niveles'];
  for (const nivel of NIVELES_CERT) {
    const jump = JUMP_BY_NIVEL[nivel];
    const fechas = bookings
      .filter((b: any) => esSesionJump(b, jump) && aproboElJump(b))
      .map((b: any) => b.fechaEvento)
      .filter(Boolean)
      .map((f: any) => (f instanceof Date ? f : new Date(f)))
      .filter((d: Date) => !isNaN(d.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    niveles[nivel] = { aprobado: fechas.length > 0, fecha: fechas[0] ? fechas[0].toISOString() : null, yaGenerado: false, generadoEn: null };
  }
  return { academicaId, contrato: acad.contrato || null, nombre, numeroId: String(acad.numeroId ?? ''), niveles };
}

// Contrato del alumno para evaluar la mora: el de su ficha académica y, si no
// lo tiene, el de su fila de beneficiario más reciente en PEOPLE.
async function contratoDelAlumno(info: { contrato: string | null; numeroId: string }): Promise<string | null> {
  if (info.contrato) return info.contrato;
  if (!info.numeroId) return null;
  const p = await queryOne<any>(
    `SELECT "contrato" FROM "PEOPLE" WHERE "numeroId" = $1 AND "tipoUsuario" <> 'TITULAR' AND COALESCE("contrato",'') <> ''
      ORDER BY ("aprobacion" = 'Aprobado') DESC, "_createdDate" DESC LIMIT 1`, [info.numeroId]);
  return p?.contrato || null;
}

export const certificadoService = {
  /**
   * `incluirGenerado` (solo panel estudiante) agrega el flag `yaGenerado` por nivel.
   * `sinMora` omite el cálculo del bloqueo por mora (lo usa el informe de Recaudos,
   * que solo necesita los niveles aprobados).
   */
  async getEstado(id: string, opts?: { incluirGenerado?: boolean; sinMora?: boolean }): Promise<CertificadoEstado> {
    const info = await loadInfo(id);
    // La fecha de generación por el alumno se informa siempre; solo bloquea (yaGenerado)
    // cuando lo pide el panel del estudiante.
    const gen = await getGenerados(info.academicaId);
    for (const nivel of NIVELES_CERT) {
      info.niveles[nivel].generadoEn = gen.get(nivel) || null;
      // Sin límite de generaciones: `yaGenerado` ya no bloquea (siempre false).
    }
    const bloqueoMora = opts?.sinMora ? null : await moraService.getBloqueoCertificado(await contratoDelAlumno(info));
    return { nombre: info.nombre, numeroId: info.numeroId, niveles: info.niveles, bloqueoMora, claveActiva: await certificadoClaveActiva() };
  },

  /**
   * Sin límite de generaciones (panel estudiante y admin). Condiciones: nivel aprobado (Jump) y contrato
   * al día (o desbloqueado por Recaudos). `soloUna` se conserva solo para marcar el ORIGEN en el log
   * (ESTUDIANTE vs ADMIN); ya no bloquea ni registra "generado".
   */
  async generar(id: string, nivel: NivelCertificado, opts?: { soloUna?: boolean; actor?: string | null }): Promise<{ pdf: Buffer; nombre: string; numeroId: string }> {
    if (!NIVELES_CERT.includes(nivel)) throw new ValidationError('Nivel inválido');
    const info = await loadInfo(id);
    const n = info.niveles[nivel];
    if (!n?.aprobado) throw new ValidationError('El estudiante no ha aprobado el nivel; certificado no disponible.');
    // Bloqueo por mora (solo si el interruptor está encendido y Recaudos no lo desbloqueó).
    const bloqueo = await moraService.getBloqueoCertificado(await contratoDelAlumno(info));
    if (bloqueo) {
      throw new ValidationError(
        `Certificado bloqueado: el contrato ${bloqueo.contrato} tiene ${bloqueo.cuotasAtrasadas} cuota(s) vencida(s) sin pagar. ` +
        'Debe ponerse al día con los pagos o comunicarse con Recaudos.');
    }
    const conClave = await certificadoClaveActiva();
    const pdf = await buildCertificadoPdf({ nivel, nombre: info.nombre, horas: HORAS, fecha: n.fecha, password: conClave ? info.numeroId : '' });
    await registrarLog(info.academicaId, info.numeroId, nivel, info.nombre, opts?.soloUna ? 'ESTUDIANTE' : 'ADMIN', opts?.actor ?? null);
    return { pdf, nombre: info.nombre, numeroId: info.numeroId };
  },
};
