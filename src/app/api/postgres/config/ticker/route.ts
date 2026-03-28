/**
 * API Route: /api/postgres/config/ticker
 * GET  - Obtiene el mensaje y color actual del ticker (cualquier usuario autenticado)
 * POST - Actualiza el ticker (solo SUPER_ADMIN)
 */

import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { Role } from '@/types/permissions';
import { AppConfigRepository } from '@/repositories/config.repository';

const TICKER_KEY = 'ticker_message';
const DEFAULT_MESSAGE =
  '📢 Usuarios Ecuador 🇪🇨 y Chile 🇨🇱: viernes 3 y sábado 4 de abril no habra sesiones por Semana Santa ✝️. ¡Disfruten su descanso! 🌿✨ | Usuarios Colombia 🇨🇴: sábado 4 de abril habrán sesiones normales 👍';
const DEFAULT_COLOR = '#ffffff';

export const GET = handlerWithAuth(async () => {
  const config = await AppConfigRepository.get(TICKER_KEY);

  return successResponse({
    message: config?.value ?? DEFAULT_MESSAGE,
    color: config?.color ?? DEFAULT_COLOR,
    updatedBy: config?.updatedBy ?? null,
    updatedAt: config?._updatedDate ?? null,
  });
});

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const userRole = (session.user as any).role as Role;

  if (userRole !== Role.SUPER_ADMIN) {
    throw new ForbiddenError('Solo SUPER_ADMIN puede editar el ticker');
  }

  const body = await req.json();
  const { message, color } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new ValidationError('El mensaje no puede estar vacío');
  }
  if (message.trim().length > 1000) {
    throw new ValidationError('El mensaje no puede superar 1000 caracteres');
  }

  const updatedBy = (session.user as any).email ?? 'admin';
  const saved = await AppConfigRepository.set(
    TICKER_KEY,
    message.trim(),
    color ?? DEFAULT_COLOR,
    updatedBy
  );

  console.log(`✅ Ticker actualizado por ${updatedBy}`);

  return successResponse({
    message: saved?.value,
    color: saved?.color,
    updatedBy: saved?.updatedBy,
  });
});
