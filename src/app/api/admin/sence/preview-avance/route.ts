/**
 * API Route: GET /api/admin/sence/preview-avance
 *
 * Endpoint de diagnóstico para revisar qué payload arma `obtenerCursosParaEnviar()`
 * (árbol Curso→Alumno→Módulo) SIN enviarlo a SENCE. Útil mientras no exista un
 * ambiente de pruebas de SENCE: permite validar el JSON contra el instructivo
 * antes de conectar el envío real (`senceService.enviarAvanceNocturno`).
 *
 * Solo lectura de PostgreSQL — no llama a `SenceApiService` ni hace requests
 * salientes a SENCE. Restringido a SUPER_ADMIN/ADMIN (herramienta interna de
 * debug, sin permiso propio en /admin/permissions).
 */

import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError } from '@/lib/errors';
import { Role } from '@/types/permissions';
import { senceService } from '@/services/sence.service';

export const dynamic = 'force-dynamic';

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  const role = (session.user as any)?.role;
  if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
    throw new ForbiddenError('Solo SUPER_ADMIN/ADMIN pueden previsualizar el envío SENCE');
  }

  const cursos = await senceService.obtenerCursosParaEnviar();

  return successResponse({
    cursos,
    total: cursos.length,
    generatedAt: new Date().toISOString(),
  });
});
