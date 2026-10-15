import 'server-only';
import { queryOne } from '@/lib/postgres';
import { kidsIntake, KidsIntakeError } from '@/lib/kids-intake';
import { ValidationError } from '@/lib/errors';

/**
 * OnHold de un beneficiario KIDS sincronizado con KIDS2026 (camino de IDA).
 * El de VUELTA (OnHold hecho en KIDS) entra por POST /api/kids-sync/onhold.
 *
 * Resultado:
 *  - SINCRONIZADO   KIDS quedó igual.
 *  - NO_APLICA      KIDS no tenía nada que hacer (reserva sin aprobar, ya estaba así, no existe allá).
 *  - SIN_RESERVA    el kid no tiene reserva enviada a KIDS.
 *  - SIN_CONFIGURAR integración apagada (faltan KIDS_API_URL / KIDS_INTAKE_API_KEY).
 *  - ERROR          KIDS no respondió (solo en modo no estricto, p. ej. el cron).
 */
export type ResultadoKidsOnhold = 'SINCRONIZADO' | 'NO_APLICA' | 'SIN_RESERVA' | 'SIN_CONFIGURAR' | 'ERROR';

export function esBeneficiarioKids(person: any): boolean {
  return person?.kids === true && person?.tipoUsuario === 'BENEFICIARIO';
}

/** N° de reserva en KIDS ("contrato#documento") del beneficiario, o null. */
export async function refKidsDe(personId: string): Promise<string | null> {
  const row = await queryOne<{ ref: string | null }>(
    `SELECT "kidsExternalRef" AS ref FROM "KIDS_INSCRIPCIONES"
      WHERE "beneficiarioId" = $1 AND "enviadoAKids" = true AND "kidsExternalRef" IS NOT NULL
      ORDER BY "_createdDate" DESC LIMIT 1`,
    [personId],
  );
  return row?.ref ?? null;
}

const fechaISO = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
};

/**
 * Llama a KIDS. Estricto (acción manual): si KIDS rechaza o no responde, LANZA
 * y la operación en LGS no se hace — así nunca quedan distintos. No estricto
 * (cron): registra el error y sigue (KIDS cierra la pausa con su propio worker).
 */
async function llamar(
  fn: () => Promise<{ aplicado: boolean }>,
  estricto: boolean,
  que: string,
): Promise<ResultadoKidsOnhold> {
  try {
    const r = await fn();
    return r.aplicado === false ? 'NO_APLICA' : 'SINCRONIZADO';
  } catch (e: any) {
    if (e instanceof KidsIntakeError && e.status === 404) return 'NO_APLICA';
    console.error(`[kids-onhold] ${que} falló:`, e?.status, e?.message);
    if (!estricto) return 'ERROR';
    if (e instanceof KidsIntakeError && e.status && e.status >= 400 && e.status < 500) {
      throw new ValidationError(`KIDS rechazó el ${que}: ${e.message}`);
    }
    throw new ValidationError(`No se pudo confirmar el ${que} con KIDS (no respondió). Intente de nuevo en unos minutos.`);
  }
}

/** OnHold abierto en LGS → la misma pausa en KIDS. */
export async function pausarEnKids(
  person: any,
  datos: { fechaOnHold: any; fechaFinOnHold: any; motivo?: string; activadoPor: string },
  estricto = true,
): Promise<ResultadoKidsOnhold> {
  if (!esBeneficiarioKids(person)) return 'NO_APLICA';
  if (!kidsIntake.isConfigured()) return 'SIN_CONFIGURAR';
  const ref = await refKidsDe(person._id);
  if (!ref) return 'SIN_RESERVA';
  return llamar(() => kidsIntake.pauseReservation(ref, {
    desde: fechaISO(datos.fechaOnHold),
    hasta: fechaISO(datos.fechaFinOnHold),
    // KIDS exige motivo (≥5): si en LGS quedó vacío, se rotula.
    motivo: (datos.motivo || '').trim().length >= 5 ? (datos.motivo as string).trim() : 'OnHold registrado en LGS',
    activadoPor: datos.activadoPor || null,
  }), estricto, 'OnHold');
}

/** Fin del OnHold en LGS → KIDS cierra la pausa con los MISMOS días. */
export async function finPausaEnKids(person: any, dias: number, estricto = true): Promise<ResultadoKidsOnhold> {
  if (!esBeneficiarioKids(person)) return 'NO_APLICA';
  if (!kidsIntake.isConfigured()) return 'SIN_CONFIGURAR';
  const ref = await refKidsDe(person._id);
  if (!ref) return 'SIN_RESERVA';
  return llamar(() => kidsIntake.endPauseReservation(ref, Math.max(0, Math.round(dias))), estricto, 'fin del OnHold');
}
