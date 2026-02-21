import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { autoApproveConsent } from '@/services/consent.service';

export const POST = handlerWithAuth(async (request, { params }, session) => {
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'admin';
  const ua = request.headers.get('user-agent') || 'admin';

  const result = await autoApproveConsent(
    params.id,
    session.user?.email || 'system@lgs.com',
    session.user?.name || 'System',
    ip,
    ua
  );

  return successResponse({
    message: 'Consentimiento automatico registrado exitosamente',
    hash: result.hash,
  });
});
