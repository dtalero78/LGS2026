/**
 * gen-password.ts — genera una clave temporal segura para cuentas nuevas
 * creadas desde el panel admin (Administrativo / Advisor / Comercial).
 *
 * La clave se muestra UNA sola vez en la card de éxito para que el admin la
 * copie; el usuario la cambia en su primer ingreso. Se guarda en texto plano
 * (convención del sistema: el auth acepta bcrypt y plano).
 */
import 'server-only';
import crypto from 'crypto';

// Sin caracteres ambiguos (0/O, 1/l/I) para dictado/copia sin errores.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Genera una clave temporal de `len` caracteres (default 10). */
export function generateTempPassword(len = 10): string {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
