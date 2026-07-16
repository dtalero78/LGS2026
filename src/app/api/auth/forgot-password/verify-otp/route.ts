import 'server-only';
import { NextResponse } from 'next/server';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { verifyOtp } from '@/lib/otp-store';
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
  const result = verifyOtp(normalizedEmail, code.trim());

  if (!result.valid) {
    return NextResponse.json(
      { success: false, error: 'Código inválido o expirado' },
      { status: 400 }
    );
  }

  return successResponse({
    message: 'Código verificado correctamente',
    resetToken: issueResetToken(normalizedEmail),
  });
});
