import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { beneficiarioKidsDeRef, exigirClaveKids } from '@/lib/kids-sync-server';
import { extendByDays } from '@/services/contract.service';

/**
 * POST /api/kids-sync/extension — camino de VUELTA desde KIDS2026.
 *
 * Una extensión manual de vigencia hecha en KIDS sobre un niño que viene de
 * LGS se aplica aquí igual que la de la ficha (extendByDays): finalContrato +
 * días, vigencia, extensionCount, extensionHistory, estado 'CON EXTENSION',
 * reactivación (salvo OnHold vigente) y sincronización del titular. Con origen
 * 'KIDS' no se avisa de vuelta (sin eco).
 *
 * Body: { externalRef, dias, motivo, ejecutadoPor }
 */
export const POST = handler(async (request) => {
  exigirClaveKids(request);
  const body = await request.json().catch(() => ({}));
  const externalRef = String(body?.externalRef || '').trim();
  if (!externalRef) throw new ValidationError('externalRef es obligatorio');
  const dias = Math.round(Number(body.dias));
  if (!Number.isFinite(dias) || dias <= 0) throw new ValidationError('dias debe ser un número > 0');

  const personId = await beneficiarioKidsDeRef(externalRef);
  const por = `KIDS: ${String(body.ejecutadoPor || 'coordinación').slice(0, 100)}`;
  const r = await extendByDays({
    studentId: personId,
    diasExtension: dias,
    motivo: String(body.motivo || '').trim().slice(0, 500) || 'Extensión registrada en KIDS',
    ejecutadoPor: por,
    ejecutadoPorEmail: '',
    origen: 'KIDS',
  });
  console.log(`[kids-sync/extension] Extensión desde KIDS en ${personId} (${externalRef}): +${dias} días → ${r.extension.vigenciaNueva}`);
  return successResponse({ aplicado: true, nuevoFinal: r.extension.vigenciaNueva });
});
