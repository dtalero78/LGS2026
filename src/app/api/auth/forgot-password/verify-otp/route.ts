import 'server-only';
import { NextResponse } from 'next/server';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { verifyOtp } from '@/lib/otp-store';
import { rateLimit, rateLimitReset } from '@/lib/rate-limit';
import { issueResetToken } from '@/lib/reset-token';

/**
 * POST /api/auth/forgot-password/verify-otp
 * Verifies the OTP code sent via WhatsApp.
 *
 * Al verificar OK emite un `resetToken` firmado (10 min) que
 * /reset-password EXIGE. Sin esto, el paso 4 se podía llamar directo saltándose
 * el OTP. El token no se envía al usuario: va en el JSON y el navegador lo
 * reenvía en el paso 4.
 */
export const POST = handler(async (request) => {
  const { email, code } = await request.json();

  if (!email?.trim()) throw new ValidationError('Email requerido');
  if (!code?.trim())  throw new ValidationError('Código requerido');

  const normalizedEmail = email.trim().toLowerCase();

  // Rate-limit por email: el OTP es de 6 dígitos (1.000.000 de combinaciones);
  // sin límite se puede reventar por fuerza bruta.
  const rl = rateLimit(`fp-otp:${normalizedEmail}`, 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: `Demasiados intentos. Espera ${Math.ceil(rl.retryAfterSec / 60)} minuto(s) antes de reintentar.` },
      { status: 429 },
    );
  }

  const result = verifyOtp(normalizedEmail, code.trim());

  if (!result.valid) {
    return NextResponse.json(
      { success: false, error: 'Código inválido o expirado' },
      { status: 400 }
    );
  }

  // OTP correcto → libera el contador (que un acierto no deje al usuario
  // bloqueado por los intentos fallidos previos).
  rateLimitReset(`fp-otp:${normalizedEmail}`);

  return successResponse({
    message: 'Código verificado correctamente',
    resetToken: issueResetToken(normalizedEmail),
  });
});
