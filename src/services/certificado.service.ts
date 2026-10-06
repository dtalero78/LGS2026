import 'server-only';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { generateId } from '@/lib/id-generator';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { BookingRepository } from '@/repositories/booking.repository';
import { buildCertificadoPdf, type NivelCertificado } from '@/lib/certificado-pdf';
import { moraService, type BloqueoMora } from '@/services/mora.service';

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
      if (opts?.incluirGenerado) info.niveles[nivel].yaGenerado = gen.has(nivel);
    }
    const bloqueoMora = opts?.sinMora ? null : await moraService.getBloqueoCertificado(await contratoDelAlumno(info));
    return { nombre: info.nombre, numeroId: info.numeroId, niveles: info.niveles, bloqueoMora };
  },

  /**
   * `soloUna` (panel estudiante): bloquea la 2ª generación del mismo nivel y
   * registra que ya se generó. Sin `soloUna` (panel admin): sin límite, no
   * registra — el staff puede regenerar cuantas veces necesite.
   */
  async generar(id: string, nivel: NivelCertificado, opts?: { soloUna?: boolean }): Promise<{ pdf: Buffer; nombre: string; numeroId: string }> {
    if (!NIVELES_CERT.includes(nivel)) throw new ValidationError('Nivel inválido');
    const info = await loadInfo(id);
    const n = info.niveles[nivel];
    if (!n?.aprobado) throw new ValidationError('El estudiante no ha aprobado el nivel; certificado no disponible.');
    if (!info.numeroId) throw new ValidationError('El estudiante no tiene número de documento; no se puede proteger el PDF.');
    // Bloqueo por mora (solo si el interruptor está encendido y Recaudos no lo desbloqueó).
    const bloqueo = await moraService.getBloqueoCertificado(await contratoDelAlumno(info));
    if (bloqueo) {
      throw new ValidationError(
        `Certificado bloqueado: el contrato ${bloqueo.contrato} tiene ${bloqueo.cuotasAtrasadas} cuota(s) vencida(s) sin pagar. ` +
        'Debe ponerse al día con los pagos o comunicarse con Recaudos.');
    }
    if (opts?.soloUna) {
      const gen = await getGenerados(info.academicaId);
      if (gen.has(nivel)) throw new ValidationError('Este certificado ya fue generado. Solo puedes generarlo una vez.');
    }
    const pdf = await buildCertificadoPdf({ nivel, nombre: info.nombre, horas: HORAS, fecha: n.fecha, password: info.numeroId });
    if (opts?.soloUna) await marcarGenerado(info.academicaId, info.numeroId, nivel, info.nombre);
    return { pdf, nombre: info.nombre, numeroId: info.numeroId };
  },
};
