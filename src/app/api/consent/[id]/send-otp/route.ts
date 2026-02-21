import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { sendConsentOtp } from '@/services/consent.service';
import { ValidationError } from '@/lib/errors';

export const POST = handler(async (request, { params }) => {
  const body = await request.json();
  const { numeroDocumento } = body;

  if (!numeroDocumento?.trim()) {
    throw new ValidationError('numeroDocumento es requerido');
  }

  const result = await sendConsentOtp(params.id, numeroDocumento.trim());

  return successResponse({
    message: 'Codigo OTP enviado por WhatsApp',
    celularMasked: result.celularMasked,
  });
});
