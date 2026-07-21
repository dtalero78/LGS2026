import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getDriveMode } from '@/lib/contract-drive';
import { findContractFileId, downloadDrivePdf } from '@/lib/google-drive';
import { queryOne } from '@/lib/postgres';

const BSL_DOWNLOAD_URL = 'https://bsl-utilidades-yp78a.ondigitalocean.app/descargar-pdf-drive';

/**
 * GET /api/contracts/[id]/download-pdf
 *
 * Descarga el PDF del contrato respetando el interruptor de archivado:
 *   modo 'bsl' → redirige a bsl-utilidades (comportamiento previo).
 *   modo 'lgs' → sirve el PDF desde la Unidad compartida. Resuelve el fileId así:
 *       1) PEOPLE.driveFileId (guardado al generar) — DIRECTO por id, consistencia
 *          fuerte, sin la latencia del índice de búsqueda de Drive.
 *       2) fallback: findContractFileId (búsqueda por appProperties) para contratos
 *          que aún no tienen driveFileId guardado.
 *       3) fallback final: bsl (si no está en la unidad compartida o el Drive falla).
 *
 * Público (se abre con window.open desde el panel), igual que la descarga previa.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const mode = await getDriveMode();

  if (mode === 'bsl') {
    return NextResponse.redirect(`${BSL_DOWNLOAD_URL}/${id}?empresa=LGS`);
  }

  // modo 'lgs'
  try {
    // 1) fileId guardado en la BD (fuente de verdad, consistencia fuerte).
    const row = await queryOne<{ driveFileId: string | null }>(
      `SELECT "driveFileId" FROM "PEOPLE" WHERE "_id" = $1`, [id],
    );
    // 2) fallback: búsqueda por appProperties si no hay fileId guardado.
    const fileId = row?.driveFileId || (await findContractFileId(id));
    if (!fileId) {
      // 3) no está en la unidad compartida → bsl.
      return NextResponse.redirect(`${BSL_DOWNLOAD_URL}/${id}?empresa=LGS`);
    }
    const bytes = await downloadDrivePdf(fileId);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contrato-${id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    // Ante cualquier error del Drive, no dejar sin descarga: fallback a bsl.
    return NextResponse.redirect(`${BSL_DOWNLOAD_URL}/${id}?empresa=LGS`);
  }
}
