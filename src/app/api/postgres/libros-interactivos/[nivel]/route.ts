/**
 * GET /api/postgres/libros-interactivos/[nivel]?preview=1
 *
 * Metadata del libro asociado al nivel:
 *   - libroCodigo, libroTitulo
 *   - totalPaginas   (las que ve el estudiante: dentro del rango)
 *   - paginasConAudio (lista de páginas locales con audio)
 *   - featureActive  (flag global)
 *
 * Si el flag está OFF o el nivel no tiene libro asignado, devuelve
 * `available: false` (sin error) para que la UI muestre el botón clásico (Wix).
 *
 * `?preview=1` + rol SUPER_ADMIN/ADMIN: bypass del flag global. Permite a un
 * admin validar el visor antes de activar la feature para todos los
 * estudiantes. Si el rol no es admin el preview se ignora silenciosamente.
 */
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { LibrosInteractivosService } from '@/services/libros-interactivos.service';
import { NotFoundError } from '@/lib/errors';

export const GET = handlerWithAuth(async (req, ctx, session) => {
  // clasicoActivo: controla si la UI muestra el botón "Material Interactivo
  // (clásico)" (Wix). Se devuelve en TODAS las respuestas para que MaterialsList
  // lo conozca aunque el visor v2 no esté disponible para el nivel.
  const clasicoActivo = await LibrosInteractivosService.isClasicoActive();
  // ejerciciosActivo (Fase 2): la UI muestra la tarjeta de práctica cuando está ON.
  const ejerciciosActivo = await LibrosInteractivosService.isEjerciciosActive();

  const nivel = decodeURIComponent(ctx.params.nivel || '').toUpperCase().trim();
  if (!nivel) return successResponse({ available: false, clasicoActivo, ejerciciosActivo });

  const role = (session.user as any)?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const preview = new URL(req.url).searchParams.get('preview') === '1' && isAdmin;

  const featureActive = await LibrosInteractivosService.isFeatureActive();
  if (!featureActive && !preview) {
    return successResponse({ available: false, featureActive: false, clasicoActivo, ejerciciosActivo });
  }

  try {
    const metadata = await LibrosInteractivosService.getMetadataForNivel(nivel);
    return successResponse({
      available: true,
      featureActive,
      clasicoActivo,
      ejerciciosActivo,
      previewMode: preview && !featureActive,
      ...metadata,
    });
  } catch (err: any) {
    // Si el libro no existe o no tiene páginas, no es un error de aplicación:
    // simplemente la feature no está disponible para ese nivel todavía.
    if (err instanceof NotFoundError) {
      return successResponse({ available: false, featureActive, clasicoActivo, ejerciciosActivo });
    }
    throw err;
  }
});
