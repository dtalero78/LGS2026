import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { generarYArchivarContratoPdf } from '@/lib/contract-pdf-generate';

/**
 * POST /api/contracts/[id]/regenerate-drive
 *
 * Regenera el PDF del contrato (mismo flujo que /send-pdf — API2PDF) y lo
 * archiva en el Drive (interruptor bsl/lgs), guardando PEOPLE.driveFileId.
 * NO envía WhatsApp.
 *
 * Útil para casos donde se detecta un error en un contrato ya entregado:
 *   - bug que dejó valores financieros vacíos
 *   - corrección de datos del titular tras envío
 *   - ajuste de template
 *
 * Acceso: roles con `MANTENIMIENTO.USUARIOS.GENERAR_CONTRATO` o
 *         SUPER_ADMIN / ADMIN (bypass).
 */
export const POST = handlerWithAuth(async (_request, { params }, session) => {
  await requirePermission(session, MantenimientoPermission.GENERAR_CONTRATO);

  const { pdfUrl, driveUpload, titular } = await generarYArchivarContratoPdf(params.id);

  return successResponse({
    pdfUrl,
    driveUpload,
    contrato: titular.contrato,
    titular: {
      _id: titular._id,
      primerNombre: titular.primerNombre,
      primerApellido: titular.primerApellido,
      numeroId: titular.numeroId,
    },
  });
});
