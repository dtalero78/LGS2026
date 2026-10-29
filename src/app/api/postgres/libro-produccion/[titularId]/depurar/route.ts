import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { withTransaction } from '@/lib/postgres';
import { purgarContrato } from '@/lib/purgar-contrato';
import { liberarReservasKids } from '@/lib/kids-baja';
import { previsualizarDepuracion, SIN_ESTADO_SQL } from '@/lib/libro-depuracion';

/**
 * POST /api/postgres/libro-produccion/[titularId]/depurar
 *   Body: { motivo, documentosDescargados: true, confirmarOtros?: boolean }
 * Borra definitivamente un contrato FIRMADO y SIN APROBAR creado por error, con la
 * regla de la Limpieza de Anulados (lib/purgar-contrato: copia en PURGE_LOG tipo
 * LIBRO_DEPURACION, conserva ficha académica/login compartidos, bloquea con pagos
 * validados). Antes libera en KIDS las reservas de sus beneficiarios kids.
 * Gate: staff + APROBACION.LIBRO_PRODUCCION.DEPURAR.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, ctx, session) => {
  await requirePermission(session, AprobacionPermission.LIBRO_PRODUCCION_DEPURAR);
  const body = await req.json().catch(() => ({}));
  const motivo = String(body?.motivo || '').trim();
  if (motivo.length < 10) throw new ValidationError('Escribe el motivo de la depuración (mínimo 10 caracteres)');
  if (body?.documentosDescargados !== true) throw new ValidationError('Descarga primero los documentos y recibos del contrato');

  const prev = await previsualizarDepuracion(ctx.params.titularId);
  if (!prev.depurable) throw new ValidationError(prev.motivoNoDepurable || 'Este contrato no se puede depurar');
  if (prev.otrosContratos.length && body?.confirmarOtros !== true) {
    throw new ValidationError('El titular tiene otros contratos: confirma la depuración');
  }
  const contrato = prev.titular.contrato;

  // KIDS: liberar los cupos reservados antes de borrar KIDS_INSCRIPCIONES.
  const kids = await liberarReservasKids({ contrato }, 'ANULADO', `Depurado desde el Libro de Producción: ${motivo}`);
  if (kids.errores > 0) {
    throw new ValidationError('KIDS no respondió al liberar las reservas de los niños; no se depuró. Intenta de nuevo.');
  }

  const res = await withTransaction((client) => purgarContrato(client, contrato, {
    tipoPurga: 'LIBRO_DEPURACION',
    motivo: `[Libro de Producción] ${motivo}`,
    actorEmail: (session?.user as any)?.email ?? 'desconocido',
    actorNombre: (session?.user as any)?.name ?? null,
    ip: (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim().slice(0, 45),
    userAgent: req.headers.get('user-agent') || '',
    // Re-verifica con la fila bloqueada: sigue firmado y sin estado.
    verificar: async (c, titular) => !!(await c.query(
      `SELECT 1 FROM "PEOPLE" p WHERE p."_id" = $1 AND COALESCE(p."hashConsentimiento",'') <> '' AND ${SIN_ESTADO_SQL}`,
      [titular._id])).rowCount,
  }));

  if (res.status === 'con_pagos_validados') throw new ValidationError('Tiene pagos validados por Recaudos; no se depura desde aquí');
  if (res.status !== 'ok') throw new ValidationError('El contrato cambió de estado mientras se depuraba; no se borró');
  return successResponse({ contrato, borrados: res.borrados, conservados: res.conservados, kidsLiberadas: kids.liberadas });
});
