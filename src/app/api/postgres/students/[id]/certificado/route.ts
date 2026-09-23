import 'server-only';
import { NextResponse } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError } from '@/lib/errors';
import { certificadoService } from '@/services/certificado.service';
import type { NivelCertificado } from '@/lib/certificado-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/postgres/students/[id]/certificado
 *   - sin `nivel`  → JSON con el estado por nivel del estudiante (para el dropdown admin).
 *   - `?nivel=...` → PDF del certificado (cifrado con el documento del estudiante).
 * Solo staff (los ESTUDIANTE usan /panel-estudiante/certificado, que solo da el suyo).
 * `id` puede ser ACADEMICA._id o PEOPLE._id (el servicio lo resuelve).
 */
export const GET = handlerWithAuth(async (req, { params }, session) => {
  const role = String((session?.user as any)?.role ?? '');
  if (role === 'ESTUDIANTE') throw new ForbiddenError('No autorizado');

  const id = params.id as string;
  const nivel = new URL(req.url).searchParams.get('nivel') as NivelCertificado | null;
  if (nivel) {
    const { pdf, nombre } = await certificadoService.generar(id, nivel);
    const fname = `certificado-${nivel}-${(nombre || 'lgs').replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fname}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const estado = await certificadoService.getEstado(id);
  return successResponse(estado);
});
