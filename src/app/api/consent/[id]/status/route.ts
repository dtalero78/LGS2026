import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { getConsentStatus } from '@/services/consent.service';

export const GET = handler(async (_request, { params }) => {
  const result = await getConsentStatus(params.id);
  return successResponse(result);
});
