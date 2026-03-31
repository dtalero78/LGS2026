import { NextRequest } from 'next/server';

/**
 * POST /api/admin/sync-plataforma-bookings
 *
 * @deprecated Use POST /api/admin/sync-field instead.
 * Kept for backwards compatibility — delegates to the generic endpoint
 * with fixed parameters for plataforma sync.
 */
export async function POST(request: NextRequest, context: any) {
  const { POST: syncField } = await import('@/app/api/admin/sync-field/route');

  // Rebuild request with fixed body
  const fixedBody = JSON.stringify({
    sourceTable: 'ACADEMICA',
    targetTable: 'ACADEMICA_BOOKINGS',
    field: 'plataforma',
    sourceKey: '_id',
    targetKeys: ['studentId', 'idEstudiante'],
  });

  const fixedRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: fixedBody,
  });

  return syncField(fixedRequest, context);
}
