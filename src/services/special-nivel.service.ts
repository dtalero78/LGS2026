/**
 * Special Niveles Service
 *
 * Handles auto-advance logic for special end-of-program niveles:
 * MASTER, IELS, B2FIRST, TOEFL.
 *
 * Each of these niveles has a single step (46, 47, 48, 49 respectively).
 * Students reach these niveles after passing F3 Step 45 (Jump) based on
 * their selection in ACADEMICA.pruebainter:
 *   - NULL  → MASTER  (Step 46)
 *   - 'IELS' → IELS    (Step 47)
 *   - 'B2F'  → B2FIRST (Step 48)
 *   - 'TOEF' → TOEFL   (Step 49)
 *
 * Promotion to Step 50 (graduation) from these niveles is NOT automatic.
 * Each promote* function below currently returns null — actual promotion
 * conditions will be implemented per-nivel as business rules are defined.
 */

import 'server-only';

export const SPECIAL_NIVELES = ['MASTER', 'IELS', 'B2FIRST', 'TOEFL'] as const;
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
    case 'IELS': return { nivel: 'IELS',    step: 'Step 47' };
    case 'B2F':  return { nivel: 'B2FIRST', step: 'Step 48' };
    case 'TOEF': return { nivel: 'TOEFL',   step: 'Step 49' };
    default:     return { nivel: 'MASTER',  step: 'Step 46' };
  }
}

interface AdvanceResult {
  advanced:  boolean;
  graduated?: boolean;
  from?:     { nivel: string; step: string };
  to?:       { nivel: string; step: string };
  message?:  string;
}

/**
 * Dispatcher: routes auto-advance to the matching promoteFromX function.
 * Returns null if no promotion conditions are met (student stays in place).
 */
export async function autoAdvanceSpecialNivel(
  student: any,
  booking: any
): Promise<AdvanceResult | null> {
  switch (student.nivel as SpecialNivel) {
    case 'MASTER':  return promoteFromMaster(student, booking);
    case 'IELS':    return promoteFromIels(student, booking);
    case 'B2FIRST': return promoteFromB2First(student, booking);
    case 'TOEFL':   return promoteFromToefl(student, booking);
    default:        return null;
  }
}

// ── Promotion functions per nivel ────────────────────────────────────────────
// Each returns null until business conditions are defined.
// When conditions are met, return AdvanceResult with the target (typically Step 50).

async function promoteFromMaster(_student: any, _booking: any): Promise<AdvanceResult | null> {
  // TODO: define MASTER → Step 50 promotion conditions
  return null;
}

async function promoteFromIels(_student: any, _booking: any): Promise<AdvanceResult | null> {
  // TODO: define IELS → Step 50 promotion conditions (likely external exam result)
  return null;
}

async function promoteFromB2First(_student: any, _booking: any): Promise<AdvanceResult | null> {
  // TODO: define B2FIRST → Step 50 promotion conditions (Cambridge B2 First exam result)
  return null;
}

async function promoteFromToefl(_student: any, _booking: any): Promise<AdvanceResult | null> {
  // TODO: define TOEFL → Step 50 promotion conditions (TOEFL exam result)
  return null;
}
