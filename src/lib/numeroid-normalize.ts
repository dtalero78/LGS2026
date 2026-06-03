/**
 * Normalización canónica de `numeroId` para lookups consistentes.
 *
 * Estándar del proyecto (ver CLAUDE.md → "Scripts de normalización numeroId"):
 *   - Quita puntos, espacios y dashes
 *   - Uppercase (preserva la K final de RUTs chilenos)
 *   - Trim
 *
 *   normalizeNumeroId('12.345.678-K')  → '12345678K'
 *   normalizeNumeroId(' 18.201.897-k') → '18201897K'
 *   normalizeNumeroId('CC 1.070.780')  → 'CC1070780'
 *   normalizeNumeroId(null/undefined)  → ''
 *
 * Cliente Y servidor (no `'server-only'`).
 */
export function normalizeNumeroId(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[.\s\-_]/g, '');
}

/**
 * Aplica `normalizeNumeroId` a un array de strings y filtra vacíos
 * + deduplica preservando el orden de primera aparición.
 */
export function normalizeNumeroIdList(raw: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const n = normalizeNumeroId(r);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
