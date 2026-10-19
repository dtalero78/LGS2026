import 'server-only';
import { query, queryOne } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { kidsIntake, KidsSlot } from '@/lib/kids-intake';

/**
 * Traslado de curso / salón hecho en KIDS2026 → espejo en LGS (KIDS_INSCRIPCIONES).
 *
 * KIDS es la fuente de verdad de la ubicación del niño (curso + salón). Cuando allí
 * se hace un "cambio académico" (otro salón) o un "cambio de curso" (JUNIOR ↔
 * YOUNGSTER con su salón nuevo), KIDS llama a POST /api/kids-sync/matricula y aquí
 * se actualizan tipoCurso, classroomId, salonNombre, horario y campaign con el
 * MISMO catálogo y formato que usa la inscripción (KidsBeneficiarioModal).
 */

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const horarioResumen = (h: KidsSlot[]) => (h || []).map((s) => `${DIAS[s.diaSemana] ?? s.diaSemana} ${s.horaLocal}`).join(' · ');

export interface MatriculaDesdeKids {
  externalRef: string;
  tipoCurso: string;
  /** Salón actual en KIDS; null si el niño quedó sin salón (cambio de curso sin matrícula). */
  classroomId: string | null;
  enrollmentId?: string | null;
}

export async function aplicarMatriculaDesdeKids(m: MatriculaDesdeKids) {
  const tipoCurso = String(m.tipoCurso || '').toUpperCase();
  if (!['JUNIOR', 'YOUNGSTER'].includes(tipoCurso)) throw new ValidationError('tipoCurso inválido');
  const [contrato, doc] = m.externalRef.split('#');
  const insc = await queryOne<any>(
    `SELECT "_id","tipoCurso","classroomId","salonNombre","horario","campaign","kidsEnrollmentId"
       FROM "KIDS_INSCRIPCIONES"
      WHERE "kidsExternalRef" = $1 OR ("contrato" = $2 AND "numeroId" = $3)
      ORDER BY ("kidsExternalRef" = $1) DESC, "_createdDate" DESC LIMIT 1`,
    [m.externalRef, contrato || '', doc || ''],
  );
  if (!insc) throw new NotFoundError('Inscripción Kids en LGS', m.externalRef);

  let salonNombre: string | null = null;
  let horario: string | null = null;
  let campaign: string | null = insc.campaign;
  if (m.classroomId) {
    const cat = await kidsIntake.availability({ incluirLlenos: true, incluirInactivos: true });
    for (const camp of cat.campanias || []) {
      for (const curso of camp.cursos || []) {
        const s = (curso.salones || []).find((x) => x.id === m.classroomId);
        if (s) { salonNombre = s.nombre; horario = horarioResumen(s.horario); campaign = camp.nombre; }
      }
    }
  }

  const despues = {
    tipoCurso,
    classroomId: m.classroomId || null,
    salonNombre,
    horario,
    campaign,
    kidsEnrollmentId: m.enrollmentId || insc.kidsEnrollmentId || null,
  };
  const antes = { tipoCurso: insc.tipoCurso, classroomId: insc.classroomId, salonNombre: insc.salonNombre, horario: insc.horario, campaign: insc.campaign };
  const cambio = antes.tipoCurso !== despues.tipoCurso || antes.classroomId !== despues.classroomId
    || antes.salonNombre !== despues.salonNombre || antes.horario !== despues.horario;
  if (!cambio && insc.kidsEnrollmentId === despues.kidsEnrollmentId) return { aplicado: false, antes, despues };

  await query(
    `UPDATE "KIDS_INSCRIPCIONES"
        SET "tipoCurso" = $2, "classroomId" = $3, "salonNombre" = $4, "horario" = $5, "campaign" = $6,
            "kidsEnrollmentId" = $7, "kidsExternalRef" = COALESCE("kidsExternalRef", $8), "_updatedDate" = NOW()
      WHERE "_id" = $1`,
    [insc._id, despues.tipoCurso, despues.classroomId, despues.salonNombre, despues.horario, despues.campaign,
     despues.kidsEnrollmentId, m.externalRef],
  );
  return { aplicado: true, antes, despues };
}
