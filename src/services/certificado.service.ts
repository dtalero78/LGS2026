import 'server-only';
import { queryOne } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { BookingRepository } from '@/repositories/booking.repository';
import { buildCertificadoPdf, type NivelCertificado } from '@/lib/certificado-pdf';

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
  niveles: Record<NivelCertificado, { aprobado: boolean; fecha: string | null }>;
}

async function loadInfo(id: string): Promise<{ academicaId: string; nombre: string; numeroId: string; niveles: CertificadoEstado['niveles'] }> {
  const SEL = `SELECT "_id","numeroId","primerNombre","segundoNombre","primerApellido","segundoApellido"`;
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
    niveles[nivel] = { aprobado: fechas.length > 0, fecha: fechas[0] ? fechas[0].toISOString() : null };
  }
  return { academicaId, nombre, numeroId: String(acad.numeroId ?? ''), niveles };
}

export const certificadoService = {
  async getEstado(id: string): Promise<CertificadoEstado> {
    const info = await loadInfo(id);
    return { nombre: info.nombre, numeroId: info.numeroId, niveles: info.niveles };
  },

  async generar(id: string, nivel: NivelCertificado): Promise<{ pdf: Buffer; nombre: string; numeroId: string }> {
    if (!NIVELES_CERT.includes(nivel)) throw new ValidationError('Nivel inválido');
    const info = await loadInfo(id);
    const n = info.niveles[nivel];
    if (!n?.aprobado) throw new ValidationError('El estudiante no ha aprobado el nivel; certificado no disponible.');
    if (!info.numeroId) throw new ValidationError('El estudiante no tiene número de documento; no se puede proteger el PDF.');
    const pdf = await buildCertificadoPdf({ nivel, nombre: info.nombre, horas: HORAS, fecha: n.fecha, password: info.numeroId });
    return { pdf, nombre: info.nombre, numeroId: info.numeroId };
  },
};
