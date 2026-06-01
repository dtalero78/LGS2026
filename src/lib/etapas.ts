/**
 * Etapas del programa LGS — agrupa los 14 niveles en 5 etapas pedagógicas.
 *
 *   ESSENTIAL   → ESS                                  (entrada — 30 días auto-promueve a BN1)
 *   BEGINNER    → BN1, BN2, BN3                        (Etapa 1)
 *   PRACTICAL   → P1,  P2,  P3                         (Etapa 2)
 *   FUNCTIONAL  → F1,  F2,  F3                         (Etapa 3)
 *   FINAL       → MASTER, IELTS, B2FIRST, TOEFL, DONE  (certificación / cierre)
 *
 * Las 3 etapas centrales (Beginner/Practical/Functional) son las "Etapas" pedagógicas
 * que el equipo usa al hablar del progreso macro del estudiante.
 *
 * WELCOME no entra — es onboarding previo a ESS.
 */

export type Etapa = 'ESSENTIAL' | 'BEGINNER' | 'PRACTICAL' | 'FUNCTIONAL' | 'FINAL';

const NIVEL_TO_ETAPA: Record<string, Etapa> = {
  ESS:     'ESSENTIAL',
  BN1:     'BEGINNER',
  BN2:     'BEGINNER',
  BN3:     'BEGINNER',
  P1:      'PRACTICAL',
  P2:      'PRACTICAL',
  P3:      'PRACTICAL',
  F1:      'FUNCTIONAL',
  F2:      'FUNCTIONAL',
  F3:      'FUNCTIONAL',
  MASTER:  'FINAL',
  IELTS:   'FINAL',
  B2FIRST: 'FINAL',
  TOEFL:   'FINAL',
  DONE:    'FINAL',
};

/**
 * Devuelve la etapa del nivel, o `null` si el nivel no está mapeado
 * (ej. WELCOME, o un valor vacío / desconocido).
 */
export function getEtapaForNivel(nivel: string | null | undefined): Etapa | null {
  if (!nivel) return null;
  return NIVEL_TO_ETAPA[String(nivel).trim().toUpperCase()] ?? null;
}

/**
 * Formatea "ETAPA - NIVEL" para badges/UI. Si el nivel no tiene etapa
 * mapeada (WELCOME, vacío) devuelve solo el nivel.
 *
 *   formatEtapaNivel('BN2')     → 'BEGINNER - BN2'
 *   formatEtapaNivel('ESS')     → 'ESSENTIAL - ESS'
 *   formatEtapaNivel('MASTER')  → 'FINAL - MASTER'
 *   formatEtapaNivel('WELCOME') → 'WELCOME'
 *   formatEtapaNivel('')        → ''
 */
export function formatEtapaNivel(nivel: string | null | undefined): string {
  if (!nivel) return '';
  const n = String(nivel).trim();
  const etapa = getEtapaForNivel(n);
  return etapa ? `${etapa} - ${n.toUpperCase()}` : n;
}

/**
 * Formatea "ETAPA - NIVEL - STEP" para vistas admin que quieren ver las
 * 3 dimensiones juntas. Si falta el step, devuelve solo "ETAPA - NIVEL".
 *
 *   formatEtapaNivelStep('BN2', 'Step 7') → 'BEGINNER - BN2 - Step 7'
 *   formatEtapaNivelStep('BN2', '')       → 'BEGINNER - BN2'
 *   formatEtapaNivelStep('', 'Step 7')    → ''
 */
export function formatEtapaNivelStep(
  nivel: string | null | undefined,
  step: string | null | undefined,
): string {
  const base = formatEtapaNivel(nivel);
  if (!base) return '';
  const s = step ? String(step).trim() : '';
  return s ? `${base} - ${s}` : base;
}
