import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { getDriveMode, setDriveMode, DriveMode } from '@/lib/contract-drive';
import { isDriveDirectConfigured } from '@/lib/google-drive';

/**
 * GET/PATCH /api/admin/drive-mode — interruptor de archivado de contratos en Drive.
 *   GET   → { mode: 'bsl'|'lgs', configured } (configured = hay cuenta de servicio)
 *   PATCH → body { mode: 'bsl'|'lgs' }
 * Solo SUPER_ADMIN / ADMIN.
 */

function assertAdmin(session: any) {
  const role = session?.user?.role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    throw new ForbiddenError('Solo SUPER_ADMIN/ADMIN pueden cambiar el modo de Drive');
  }
}

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  assertAdmin(session);
  return successResponse({ mode: await getDriveMode(), configured: isDriveDirectConfigured() });
});

export const PATCH = handlerWithAuth(async (req, _ctx, session) => {
  assertAdmin(session);
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode as DriveMode;
  if (mode !== 'bsl' && mode !== 'lgs') {
    throw new ValidationError("mode debe ser 'bsl' o 'lgs'");
  }
  const actor = (session.user as any)?.email || 'admin';
  await setDriveMode(mode, actor); // lanza si mode='lgs' y no hay cuenta de servicio
  return successResponse({ mode, configured: isDriveDirectConfigured() });
});
