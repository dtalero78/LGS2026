import 'server-only';
import { NextResponse } from 'next/server';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { queryOne } from '@/lib/postgres';
import { generateOtp, saveOtp } from '@/lib/otp-store';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

/**
 * POST /api/auth/forgot-password/verify-identity
 * Verifica los últimos 4 dígitos del numeroId + el celular COMPLETO.
 * Si coinciden → envía el OTP por WhatsApp.
 *
 * Rate-limit: 5 intentos / 15 min por email.
 * If no match → returns 400 (caller shows mismatch modal).
 */
/**
 * Mínimo de dígitos del celular. Los números nacionales de la región tienen
 * 9-10 dígitos (Chile 9, Colombia 10, Ecuador 9, Perú 9), así que 8 es un piso
 * seguro que acepta cualquier número real y rechaza sufijos cortos.
 */
const MIN_PHONE_DIGITS = 8;

export const POST = handler(async (request) => {
  const { email, lastFourId, lastFourPhone } = await request.json();

  if (!email?.trim())        throw new ValidationError('Email requerido');
  if (!lastFourId?.trim())   throw new ValidationError('Últimos 4 dígitos del ID requeridos');
  if (!lastFourPhone?.trim()) throw new ValidationError('El celular completo es requerido');

  const normalizedEmail = email.trim().toLowerCase();

  // Rate-limit por email: frena la fuerza bruta de los 4 dígitos del numeroId
  // (10.000 combinaciones) y evita spamear WhatsApp con OTPs.
  const rl = rateLimit(`fp-identity:${normalizedEmail}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: `Demasiados intentos. Espera ${Math.ceil(rl.retryAfterSec / 60)} minuto(s) antes de reintentar.` },
      { status: 429 },
    );
  }
  const cleanId    = lastFourId.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(-4);
  const cleanPhone = lastFourPhone.replace(/\D/g, '');  // full number, no signs

  // Get ACADEMICA record — also check PEOPLE for celular fallback
  const academica = await queryOne<{ _id: string; celular: string | null; numeroId: string | null }>(
    `SELECT a."_id", a."celular", a."numeroId"
     FROM "ACADEMICA" a WHERE LOWER(a."email") = $1 LIMIT 1`,
    [normalizedEmail]
  );
  if (!academica) throw new NotFoundError('Registro académico', normalizedEmail);

  // Verify last 4 of ID
  const storedId = (academica.numeroId || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  const idMatches = storedId.endsWith(cleanId);

  // Verify phone — exige el número COMPLETO (mínimo 8 dígitos).
  //
  // ANTES: con `endsWith` bastaban los ÚLTIMOS 4 dígitos... que son justo los
  // que /check-email revelaba con solo el email. O sea, el factor "celular" se
  // regalaba y el único obstáculo real eran los 4 del numeroId.
  //
  // AHORA: el mínimo de 8 dígitos hace que un sufijo corto no pase. Se conserva
  // la flexibilidad del indicativo (56XXXXXXXXX vs XXXXXXXXX) porque el dato
  // guardado a veces lo trae y a veces no; ambos lados deben cumplir el mínimo.
  const storedPhone = (academica.celular || '').replace(/\D/g, '');
  const phoneMatches =
    storedPhone.length >= MIN_PHONE_DIGITS &&
    cleanPhone.length >= MIN_PHONE_DIGITS && (
      storedPhone === cleanPhone ||
      storedPhone.endsWith(cleanPhone) ||
      cleanPhone.endsWith(storedPhone)
    );

  if (!idMatches || !phoneMatches) {
    // Return mismatch — client will show modal
    return NextResponse.json(
      { success: false, mismatch: true, error: 'Los datos no coinciden con nuestros registros' },
      { status: 400 }
    );
  }

  // Generate and send OTP
  const celular = academica.celular!;
  const code = generateOtp();
  saveOtp(normalizedEmail, code, celular);

  const maskedPhone = celular.length >= 4 ? '********' + celular.slice(-4) : celular;
  const message = `Tu código de verificación LetsGoSpeak para restablecer tu contraseña es: *${code}*\n\nEste código expira en 10 minutos. No lo compartas con nadie.`;

  await sendWhatsAppMessage(celular, message);

  return successResponse({ maskedPhone, message: 'Código enviado por WhatsApp' });
});
