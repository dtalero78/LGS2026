import 'server-only';
import crypto from 'crypto';

/**
 * reset-token.ts — prueba de que el OTP fue verificado, para el flujo
 * "¿Olvidaste tu contraseña?".
 *
 * POR QUÉ EXISTE: los 4 pasos del modal se encadenaban SOLO en el frontend
 * (`setStep(...)`), y `reset-password` no exigía nada: con solo el email se
 * podía cambiar la contraseña de cualquier cuenta saltándose el OTP. Este token
 * ata el paso 4 (cambiar clave) al paso 3 (OTP verificado).
 *
 * DISEÑO — token FIRMADO (stateless), no estado en memoria:
 *   - Se firma con NEXTAUTH_SECRET → no se puede fabricar sin el secreto.
 *   - Va atado al email → un token de juan@x.com no sirve para admin@x.com.
 *   - `exp` viaja DENTRO de la firma → no se puede extender alterándolo.
 *   - Al ser stateless sobrevive reinicios y funciona con N réplicas (el
 *     otp-store en memoria no: se rompería al escalar a 2 instancias).
 *
 * NO es de un solo uso: dentro de sus 10 min se puede reusar. No es un riesgo —
 * para obtenerlo hay que haber pasado el OTP, y `verifyOtp()` BORRA el código al
 * usarlo (no se puede re-verificar para pedir otro token). Lo peor que alguien
 * puede hacer con su propio token es cambiar su propia clave dos veces.
 *
 * El usuario NUNCA ve este token: se devuelve en el JSON del paso 3 y el
 * navegador lo reenvía en el paso 4. Lo que llega por WhatsApp es el OTP.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutos — igual que el OTP

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET no configurado');
  return s;
}

function sign(email: string, exp: number): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`reset:${email.trim().toLowerCase()}:${exp}`)
    .digest('hex');
}

/** Emite el token tras verificar el OTP. Formato: "<exp>.<hmac>". */
export function issueResetToken(email: string): string {
  const exp = Date.now() + TTL_MS;
  return `${exp}.${sign(email, exp)}`;
}

/**
 * Valida el token contra el email. Devuelve false si falta, está mal formado,
 * expiró o la firma no coincide (comparación time-safe).
 */
export function verifyResetToken(email: string, token: string | null | undefined): boolean {
  const raw = (token ?? '').trim();
  if (!raw) return false;

  const [expStr, hmac] = raw.split('.');
  if (!expStr || !hmac) return false;

  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const expected = sign(email, exp);
  // Longitudes distintas romperían timingSafeEqual → se descarta antes.
  if (expected.length !== hmac.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac));
  } catch {
    return false;
  }
}
