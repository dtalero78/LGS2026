import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { verificarDocumento, datosPreviosTitular, historialPrevio } from '@/lib/verificacion-documento';

/**
 * GET /api/postgres/contracts/verificar-documento?numeroId=X[&traerDatos=1]
 *
 * Verificación del Crear Contrato: devuelve los registros VIVOS de este
 * documento en otros contratos (rol + situación + n.º de contrato + pagos
 * validados). Con `traerDatos=1` (titular) incluye además:
 *   - datosPrevios: el registro TITULAR más reciente (botón "Traer sus datos")
 *   - previos/academica: contratos anulados/rechazados/devueltos (con pagos
 *     validados) y ficha académica previa — solo INFORMATIVO, no bloquea.
 * Solo lectura. Staff.
 */
export const GET = handlerWithStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const numeroId = (searchParams.get('numeroId') || '').trim();
  if (!numeroId) throw new ValidationError('numeroId requerido');

  const registros = await verificarDocumento(numeroId);
  if (searchParams.get('traerDatos') !== '1') return successResponse({ registros });

  const [datosPrevios, hist] = await Promise.all([datosPreviosTitular(numeroId), historialPrevio(numeroId)]);
  return successResponse({ registros, datosPrevios, previos: hist.previos, academica: hist.academica });
});
