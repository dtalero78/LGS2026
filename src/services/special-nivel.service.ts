/**
 * Special Niveles Service
 *
 * Handles auto-advance logic for the 4 end-of-program niveles:
 * MASTER, IELTS, B2FIRST, TOEFL.
 *
 * Each of these niveles has a single step (46, 47, 48, 49 respectively).
 * Students reach these niveles after passing F3 Step 45 (Jump) based on
 * their selection in ACADEMICA.pruebainter:
 *   - NULL    → MASTER  (Step 46)
 *   - 'IELTS' → IELTS   (Step 47)
 *   - 'B2F'   → B2FIRST (Step 48)
 *   - 'TOEF'  → TOEFL   (Step 49)
 *
 * Promotion to DONE Step 50 (ALL 4 niveles, same rule):
 *   ONLY when finalContrato < today (the gracia +1 day rule from
 *   contract-expiry.ts applies — see CONTRACT_EXPIRED helpers).
 *
 * That means a student who passes the F3 Jump stays in their assigned
 * special nivel until the contract expires — no 100-day timer, no other
 * automatic advancement. Manual admin promotion to Step 50 via changeStep()
 * is the only other path (handled separately in student.service.ts).
 *
 * When promoted to Step 50, the student is blocked:
 * USUARIOS_ROLES.activo=false + estadoInactivo=true in ACADEMICA + PEOPLE.
 */

import 'server-only';
import { query, queryOne } from '@/lib/postgres';
import { isContractExpired } from '@/lib/contract-expiry';

export const SPECIAL_NIVELES = ['MASTER', 'IELTS', 'B2FIRST', 'TOEFL'] as const;
export type SpecialNivel = (typeof SPECIAL_NIVELES)[number];

export function isSpecialNivel(nivel: string | null | undefined): nivel is SpecialNivel {
  return !!nivel && (SPECIAL_NIVELES as readonly string[]).includes(nivel);
}

/**
 * Map pruebainter value to target nivel/step.
 * Used when promoting from F3 Step 45 (Jump approved).
 */
export function resolvePruebaInterTarget(pruebainter: string | null | undefined): {
  nivel: SpecialNivel;
  step: string;
} {
  switch ((pruebainter || '').toUpperCase()) {
    case 'IELTS': return { nivel: 'IELTS',    step: 'Step 47' };
    case 'B2F':  return { nivel: 'B2FIRST', step: 'Step 48' };
    case 'TOEF': return { nivel: 'TOEFL',   step: 'Step 49' };
    default:     return { nivel: 'MASTER',  step: 'Step 46' };
  }
}

export interface AdvanceResult {
  advanced:   boolean;
  graduated?: boolean;
  from?:      { nivel: string; step: string };
  to?:        { nivel: string; step: string };
  message?:   string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lookup PEOPLE.finalContrato by ACADEMICA's numeroId (where the field lives).
 */
async function getFinalContrato(student: any): Promise<string | null> {
  if (student.finalContrato) return student.finalContrato;
  if (!student.numeroId) return null;
  const row = await queryOne<{ finalContrato: string | null }>(
    `SELECT "finalContrato" FROM "PEOPLE"
     WHERE "numeroId" = $1
     ORDER BY CASE WHEN "tipoUsuario" IN ('BENEFICIARIO','BENEFICIARIA') THEN 0 ELSE 1 END
     LIMIT 1`,
    [student.numeroId]
  ).catch(() => null);
  return row?.finalContrato ?? null;
}

/**
 * Promote student to DONE Step 50 and block their platform access.
 * Updates ACADEMICA + PEOPLE (matched by numeroId) + USUARIOS_ROLES (by email).
 * Used by promoteFromX() functions AND by changeStep() when admin manually
 * moves a student to Step 50.
 */
export async function promoteToDoneAndBlock(
  student: any,
  reason: string = 'auto-promoted to DONE'
): Promise<AdvanceResult> {
  const fromNivel = student.nivel ?? '';
  const fromStep  = student.step  ?? '';

  // 1. ACADEMICA: nivel=DONE, step=Step 50, estadoInactivo=true
  if (student._id) {
    await query(
      `UPDATE "ACADEMICA"
       SET "nivel" = 'DONE', "step" = 'Step 50',
           "estadoInactivo" = true, "_updatedDate" = NOW()
       WHERE "_id" = $1`,
      [student._id]
    ).catch(err => console.warn('[special-nivel] ACADEMICA update failed:', err.message));
  }

  // 2. PEOPLE: nivel/step + estadoInactivo + aprobacion (matched by numeroId, prefer BENEFICIARIO)
  if (student.numeroId) {
    await query(
      `UPDATE "PEOPLE"
       SET "nivel" = 'DONE', "step" = 'Step 50',
           "estadoInactivo" = true, "aprobacion" = 'FINALIZADA',
           "_updatedDate" = NOW()
       WHERE "_id" = (
         SELECT "_id" FROM "PEOPLE"
         WHERE "numeroId" = $1
         ORDER BY CASE WHEN "tipoUsuario" IN ('BENEFICIARIO','BENEFICIARIA') THEN 0 ELSE 1 END
         LIMIT 1
       )`,
      [student.numeroId]
    ).catch(err => console.warn('[special-nivel] PEOPLE update failed:', err.message));
  }

  // 3. USUARIOS_ROLES: block login
  if (student.email) {
    await query(
      `UPDATE "USUARIOS_ROLES" SET "activo" = false, "_updatedDate" = NOW()
       WHERE LOWER("email") = LOWER($1)`,
      [student.email]
    ).catch(err => console.warn('[special-nivel] USUARIOS_ROLES block failed:', err.message));
  }

  console.log(`🎓 [special-nivel] ${fromNivel} ${fromStep} → DONE Step 50 (${reason})`);

  return {
    advanced:  true,
    graduated: true,
    from: { nivel: fromNivel, step: fromStep },
    to:   { nivel: 'DONE', step: 'Step 50' },
    message: `Promovido a DONE Step 50: ${reason}. Acceso a la plataforma bloqueado.`,
  };
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Auto-advance for the 4 special niveles. Single rule: promote to DONE Step 50
 * (with full inactivation + login block) if and only if finalContrato has
 * expired. Otherwise the student stays in their current special nivel.
 *
 * The previous 100-day timer for IELTS/B2FIRST/TOEFL was removed by business
 * decision — students keep access in the special nivel for the full duration
 * of their contract regardless of how long ago they entered it.
 */
export async function autoAdvanceSpecialNivel(
  student: any,
  _booking: any
): Promise<AdvanceResult | null> {
  if (!isSpecialNivel(student.nivel)) return null;

  const finalContrato = await getFinalContrato(student);
  if (!isContractExpired(finalContrato)) return null;

  return promoteToDoneAndBlock(student, `contrato vencido (${finalContrato})`);
}
