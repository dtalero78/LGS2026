/**
 * Formatea un número de identificación al formato de RUT chileno que exige
 * SENCE: "xxxxxxxx-x" (sin puntos, con guión antes del dígito verificador).
 *
 * No valida el dígito verificador — solo re-formatea. Si el valor ya trae
 * guión, puntos o espacios, se limpian antes de reinsertar el guión, así el
 * resultado es idempotente sin importar el formato de entrada.
 */
export function toSenceRutFormat(numeroId: string | null | undefined): string {
  const clean = String(numeroId || '')
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();
  if (clean.length < 2) return clean;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

/**
 * Divide un número de identificación en las dos partes que exige la API de
 * avance de SENCE: `rutAlumno` (numérico, sin dígito verificador) y
 * `dvAlumno` (el DV, puede ser 'K'). Misma limpieza que `toSenceRutFormat`
 * pero devuelto separado en vez de con guión.
 */
export function splitRutForSence(numeroId: string | null | undefined): { rutAlumno: number; dvAlumno: string } {
  const clean = String(numeroId || '')
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();
  if (clean.length < 2) return { rutAlumno: Number(clean) || 0, dvAlumno: '' };
  return { rutAlumno: Number(clean.slice(0, -1)) || 0, dvAlumno: clean.slice(-1) };
}
