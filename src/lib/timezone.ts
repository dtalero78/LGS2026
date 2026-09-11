import 'server-only';

/**
 * Zona horaria del estudiante por plataforma (país).
 *
 * Los timestamps se guardan en UTC. Para evaluar "mismo día" o "misma semana"
 * en la hora LOCAL del estudiante (no en UTC) — y así evitar que un evento de la
 * tarde-noche cruce al día UTC siguiente — se usa la TZ IANA de su país.
 *
 * Es DST-correcto porque tanto PostgreSQL (`AT TIME ZONE`) como JS (`Intl`)
 * resuelven el offset real según la fecha. Se deriva del campo `plataforma`
 * del estudiante (server-side, no manipulable desde el cliente).
 */
const PLATAFORMA_TZ: Record<string, string> = {
  chile: 'America/Santiago',
  colombia: 'America/Bogota',
  ecuador: 'America/Guayaquil',
  peru: 'America/Lima',
  'perú': 'America/Lima',
};

export const DEFAULT_TZ = 'America/Bogota';

/** Resuelve la TZ IANA del estudiante a partir de su `plataforma`. Fallback: Bogotá. */
export function tzForPlataforma(plataforma?: string | null): string {
  const key = (plataforma || '').trim().toLowerCase();
  return PLATAFORMA_TZ[key] || DEFAULT_TZ;
}
