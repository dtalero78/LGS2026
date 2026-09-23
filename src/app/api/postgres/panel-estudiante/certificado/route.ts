import 'server-only';
import { NextResponse } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { certificadoService } from '@/services/certificado.service';
import type { NivelCertificado } from '@/lib/certificado-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/postgres/panel-estudiante/certificado
 *   - sin `nivel`  → JSON con el estado por nivel (aprobado + fecha) del alumno logueado.
 *   - `?nivel=beginner|practical|functional` → PDF del certificado (cifrado con su documento).
 * El alumno se resuelve desde la sesión (nunca de un parámetro) → solo el suyo.
 */
export const GET = handlerWithAuth(async (req, _ctx, session) => {
  const student = await resolveStudentFromSession(session);
  const academicaId = (student as any).academicaId || (student as any)._id;

  const nivel = new URL(req.url).searchParams.get('nivel') as NivelCertificado | null;
  if (nivel) {
    // Panel estudiante: cada certificado se genera UNA sola vez (soloUna).
    const { pdf, nombre } = await certificadoService.generar(academicaId, nivel, { soloUna: true });
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

  const estado = await certificadoService.getEstado(academicaId, { incluirGenerado: true });
  return successResponse(estado);
});
