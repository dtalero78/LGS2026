import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { verifyOtp } from '@/lib/otp-store';

/**
 * POST /api/auth/forgot-password/verify-otp
 * Verifies the OTP code sent via WhatsApp.
 */
export const POST = handler(async (request) => {
  const { email, code } = await request.json();

  if (!email?.trim()) throw new ValidationError('Email requerido');
  if (!code?.trim())  throw new ValidationError('Código requerido');

  const normalizedEmail = email.trim().toLowerCase();
  const result = verifyOtp(normalizedEmail, code.trim());

  if (!result.valid) {
    return new Response(
      JSON.stringify({ success: false, error: 'Código inválido o expirado' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return successResponse({ message: 'Código verificado correctamente' });
});
