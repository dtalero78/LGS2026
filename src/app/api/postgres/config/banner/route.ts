/**
 * API Route: /api/postgres/config/banner
 * GET  - Obtiene imagen y estado activo del banner (público, lo necesita el login sin auth)
 * POST - Actualiza imagen y/o estado activo (solo SUPER_ADMIN)
 */

import { handler, handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { Role } from '@/types/permissions';
import { AppConfigRepository } from '@/repositories/config.repository';

const BANNER_IMAGE_KEY = 'banner_image';
const BANNER_ACTIVE_KEY = 'banner_active';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB en base64

export const GET = handler(async () => {
  const [imageRow, activeRow] = await Promise.all([
    AppConfigRepository.get(BANNER_IMAGE_KEY),
    AppConfigRepository.get(BANNER_ACTIVE_KEY),
  ]);

  return successResponse({
    image: imageRow?.value ?? null,
    active: activeRow?.value === 'true',
    updatedBy: imageRow?.updatedBy ?? null,
    updatedAt: imageRow?._updatedDate ?? null,
  });
});

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const userRole = (session.user as any).role as Role;

  if (userRole !== Role.SUPER_ADMIN) {
    throw new ForbiddenError('Solo SUPER_ADMIN puede editar el banner');
  }

  const body = await req.json();
  const { image, active } = body;

  const updatedBy = (session.user as any).email ?? 'admin';

  if (image !== undefined) {
    if (typeof image !== 'string') {
      throw new ValidationError('La imagen debe ser una cadena base64');
    }
    if (image.length > 0 && !image.startsWith('data:image/')) {
      throw new ValidationError('El formato de imagen no es válido');
    }
    if (image.length > MAX_IMAGE_BYTES) {
      throw new ValidationError('La imagen supera el tamaño máximo de 10 MB');
    }
    await AppConfigRepository.set(BANNER_IMAGE_KEY, image, '#ffffff', updatedBy);
    console.log(`✅ Banner imagen actualizada por ${updatedBy}`);
  }

  if (active !== undefined) {
    if (typeof active !== 'boolean') {
      throw new ValidationError('El campo active debe ser booleano');
    }
    await AppConfigRepository.set(BANNER_ACTIVE_KEY, String(active), '#ffffff', updatedBy);
    console.log(`✅ Banner estado actualizado a ${active} por ${updatedBy}`);
  }

  // Devolver estado actual
  const [imageRow, activeRow] = await Promise.all([
    AppConfigRepository.get(BANNER_IMAGE_KEY),
    AppConfigRepository.get(BANNER_ACTIVE_KEY),
  ]);

  return successResponse({
    image: imageRow?.value ?? null,
    active: activeRow?.value === 'true',
    updatedBy,
  });
});
