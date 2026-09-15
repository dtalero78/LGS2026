import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission } from '@/lib/api-permissions';
import { PersonPermission, Role } from '@/types/permissions';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { extraerReciboDesdeUrl, isLeerReciboActivo } from '@/services/recibo-extract.service';

/**
 * POST /api/postgres/recaudos/inscripcion-recibo/extraer
 * Body: { url }  → extrae los datos del recibo (NO guarda).
 * Gate: PAGOS_VALIDAR o PAGOS_REGISTRAR (el wizard Registrar Pago) + flag
 * leer_recibo_activo (SUPER_ADMIN/ADMIN bypass).
 */
export const POST = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requireAnyPermission(session, [PersonPermission.PAGOS_VALIDAR, PersonPermission.PAGOS_REGISTRAR]);
  const role = ((session?.user as any)?.role ?? '') as string;
  const isAdmin = role === Role.SUPER_ADMIN || role === Role.ADMIN || role === 'admin';
  if (!(await isLeerReciboActivo()) && !isAdmin) {
    throw new ForbiddenError('La lectura de recibos no está habilitada.');
  }
  const body = await req.json();
  const url = String(body?.url || '').trim();
  if (!url) throw new ValidationError('url del recibo es requerida.');
  const extraido = await extraerReciboDesdeUrl(url);
  return successResponse({ extraido });
});
