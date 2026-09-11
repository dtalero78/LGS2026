import 'server-only';
import { queryOne, queryMany } from '@/lib/postgres';

/**
 * proteccion-historial.service.ts — snapshot del historial académico de un
 * estudiante (por numeroId) para archivarlo como documento antes de re-matricular.
 *
 * Solo LECTURA acá: arma los datos del informe (KPIs + tabla de agendamientos,
 * lo que se ve en InfoAcademic User). La parte destructiva (limpiar ACADEMICA +
 * bookings) vive en el endpoint, no acá.
 */

export interface AcademicBookingRow {
  fecha: string | null;
  tipo: string | null;
  advisor: string | null;
  nivel: string | null;
  step: string | null;
  asistio: boolean;
  participo: boolean | null;
  cancelo: boolean | null;
  noAprobo: boolean | null;
}

export interface AcademicSnapshot {
  student: {
    academicaId: string;
    nombre: string;
    numeroId: string;
    nivel: string | null;
    step: string | null;
    plataforma: string | null;
    contrato: string | null;
  };
  kpis: { total: number; asistidas: number; noAsistidas: number; canceladas: number; jumpsAprobados: number };
  bookings: AcademicBookingRow[];
}

const isJumpStep = (step: string | null): boolean => {
  const n = parseInt(String(step || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 && n % 5 === 0;
};

/**
 * Devuelve el snapshot académico por numeroId, o null si no hay ACADEMICA.
 * `contratoViejo` (opcional) fija qué contrato mostrar en el encabezado; si no,
 * se resuelve por el LATERAL (prefiere BENEFICIARIO).
 */
export async function getAcademicSnapshot(
  numeroId: string,
  contratoViejo?: string | null,
): Promise<AcademicSnapshot | null> {
  const aca = await queryOne<any>(
    `SELECT a."_id", a."primerNombre", a."primerApellido", a."nivel", a."step",
            a."numeroId", a."plataforma",
            COALESCE($2, p."contrato") AS "contrato"
       FROM "ACADEMICA" a
       LEFT JOIN LATERAL (
         SELECT p2."contrato" FROM "PEOPLE" p2 WHERE p2."numeroId" = a."numeroId"
         ORDER BY CASE WHEN p2."tipoUsuario"='BENEFICIARIO' THEN 0 ELSE 1 END LIMIT 1
       ) p ON true
      WHERE a."numeroId" = $1 LIMIT 1`,
    [numeroId, contratoViejo ?? null],
  );
  if (!aca) return null;

  const studentId = aca._id;

  // Misma resolución de tipo/advisor/nivel/step que el informe InfoAcademic
  // (JOIN a CALENDARIO para el step real del evento, JOIN a ADVISORS para el nombre).
  const rows = await queryMany<any>(
    `SELECT b."fechaEvento" AS fecha, b."cancelo",
            COALESCE(c."tipo", b."tipo", b."tipoEvento") AS tipo,
            COALESCE(a2."nombreCompleto", b."advisor") AS advisor,
            COALESCE(c."nivel", b."nivel") AS nivel,
            CASE WHEN COALESCE(c."step", b."step",'') LIKE 'TRAINING%'
              THEN COALESCE(c."nombreEvento", b."nombreEvento", c."step", b."step")
              ELSE COALESCE(c."step", b."step")
            END AS step,
            b."asistio", b."asistencia", b."participacion" AS participo, b."noAprobo"
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "CALENDARIO" c ON c."_id" = COALESCE(b."eventoId", b."idEvento")
       LEFT JOIN "ADVISORS" a2 ON a2."_id" = b."advisor"
      WHERE b."idEstudiante" = $1 OR b."studentId" = $1
      ORDER BY b."fechaEvento" DESC NULLS LAST`,
    [studentId],
  );

  const bookings: AcademicBookingRow[] = rows.map(r => ({
    fecha: r.fecha,
    tipo: r.tipo,
    advisor: r.advisor,
    nivel: r.nivel,
    step: r.step,
    asistio: r.asistio === true || r.asistencia === true,
    participo: r.participo,
    cancelo: r.cancelo,
    noAprobo: r.noAprobo,
  }));

  const noCancel = bookings.filter(b => !b.cancelo);
  const kpis = {
    total: bookings.length,
    asistidas: noCancel.filter(b => b.asistio).length,
    noAsistidas: noCancel.filter(b => !b.asistio).length,
    canceladas: bookings.filter(b => b.cancelo === true).length,
    jumpsAprobados: noCancel.filter(b => isJumpStep(b.step) && b.asistio && b.noAprobo !== true).length,
  };

  return {
    student: {
      academicaId: studentId,
      nombre: `${aca.primerNombre || ''} ${aca.primerApellido || ''}`.trim(),
      numeroId: aca.numeroId,
      nivel: aca.nivel,
      step: aca.step,
      plataforma: aca.plataforma,
      contrato: aca.contrato,
    },
    kpis,
    bookings,
  };
}
