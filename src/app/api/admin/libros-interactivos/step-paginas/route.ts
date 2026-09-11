/**
 * GET   /api/admin/libros-interactivos/step-paginas?nivel=BN1
 *   → lista los steps del nivel con su libroPaginaStep (página LOCAL de inicio).
 * PATCH /api/admin/libros-interactivos/step-paginas
 *   Body: { nivelCode, step, pagina: number|null }
 *   → setea la página LOCAL donde empieza ese step en el libro interactivo.
 *     Esta página alimenta el botón "Ir a mi Step de esta semana" del visor.
 *
 * Gateado por ACADEMICO.MATERIAL.ACTUALIZAR.
 */
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { NivelLibroBindingRepository } from '@/repositories/libros-interactivos.repository';
import { LibrosInteractivosService } from '@/services/libros-interactivos.service';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';

export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, AcademicoPermission.ACTUALIZAR_MATERIAL);
  const { searchParams } = new URL(req.url);
  const nivel = String(searchParams.get('nivel') || '').toUpperCase().trim();
  if (!nivel) throw new ValidationError('nivel requerido');
  const steps = await NivelLibroBindingRepository.getStepsForNivel(nivel);
  return successResponse({ nivel, steps });
});

export const PATCH = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, AcademicoPermission.ACTUALIZAR_MATERIAL);
  const body = await req.json().catch(() => ({}));

  const nivelCode = String(body?.nivelCode || '').toUpperCase().trim();
  const step = String(body?.step || '').trim();
  if (!nivelCode) throw new ValidationError('nivelCode requerido');
  if (!step) throw new ValidationError('step requerido');

  let pagina: number | null = null;
  if (body?.pagina != null && body?.pagina !== '') {
    pagina = Number(body.pagina);
    if (!Number.isInteger(pagina) || pagina < 1) {
      throw new ValidationError('pagina debe ser un entero >= 1 (o vacío para limpiar)');
    }
  }

  const affected = await NivelLibroBindingRepository.setStepPagina(nivelCode, step, pagina);
  LibrosInteractivosService.invalidateNivelCache(nivelCode);
  return successResponse({ affected, nivelCode, step, pagina });
});
