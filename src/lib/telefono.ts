/**
 * Regla única para guardar teléfonos con indicativo de país (client-safe).
 *
 * Los teléfonos se guardan como solo dígitos CON el indicativo (p. ej. 573001234567),
 * que es lo que espera el envío por WhatsApp (formatPhoneNumber no agrega indicativo).
 * Si el número llega sin indicativo, se le antepone el del país del registro.
 *
 * Misma lógica en scripts/normalizar-telefonos.js — mantener ambas iguales.
 */

/** Indicativo y largo del número nacional (sin indicativo ni 0 inicial) por país. */
const PAISES: Record<string, { cc: string; local: number }> = {
  chile: { cc: '56', local: 9 },
  colombia: { cc: '57', local: 10 },
  ecuador: { cc: '593', local: 9 },
  peru: { cc: '51', local: 9 },
};

function clavePais(pais?: string | null): string {
  return String(pais || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Indicativo del país ('56', '57', '593', '51') o null si no es un país LGS. */
export function indicativoDePais(pais?: string | null): string | null {
  return PAISES[clavePais(pais)]?.cc ?? null;
}

/** true si los dígitos ya traen el indicativo completo de algún país LGS. */
function traeIndicativo(d: string): boolean {
  return Object.values(PAISES).some(p => d.startsWith(p.cc) && d.length === p.cc.length + p.local);
}

/**
 * Normaliza un teléfono: solo dígitos y con indicativo.
 * - Vacío → null.
 * - Ya trae el indicativo de un país LGS (con el largo correcto) → se deja.
 * - Prefijo internacional "00" → se quita.
 * - Número nacional del país del registro (quitando ceros iniciales) → se antepone el indicativo.
 * - Cualquier otro caso (país desconocido, número extranjero, largo raro) → solo dígitos, sin inventar.
 */
export function normalizarTelefono(raw: unknown, pais?: string | null): string | null {
  if (raw === null || raw === undefined) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (traeIndicativo(d)) return d;

  const p = PAISES[clavePais(pais)];
  if (!p) return d;
  const local = d.replace(/^0+/, '');
  if (local.length === p.local) return p.cc + local;
  return d;
}

/**
 * Igual que normalizarTelefono pero respeta `undefined` (campo no enviado en un PATCH)
 * y deja '' / null como null.
 */
export function normalizarTelefonoOpcional(raw: unknown, pais?: string | null): string | null | undefined {
  if (raw === undefined) return undefined;
  return normalizarTelefono(raw, pais);
}
