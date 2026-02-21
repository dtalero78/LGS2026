import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { verifyAndSaveConsent } from '@/services/consent.service';
import { ValidationError } from '@/lib/errors';

export const POST = handler(async (request, { params }) => {
  const body = await request.json();
  const { otpCode } = body;

  if (!otpCode?.trim() || otpCode.trim().length !== 6) {
    throw new ValidationError('Codigo OTP de 6 digitos es requerido');
  }

  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';

  const result = await verifyAndSaveConsent(params.id, otpCode.trim(), ip, ua);

  return successResponse({
    message: 'Consentimiento declarativo registrado exitosamente',
    hash: result.hash,
  });
});
