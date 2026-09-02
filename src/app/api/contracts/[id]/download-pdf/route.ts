import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getDriveMode } from '@/lib/contract-drive';
import { findContractFileId, downloadDrivePdf } from '@/lib/google-drive';
import { queryOne, query } from '@/lib/postgres';

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

  // modo 'lgs' — resiliente: intenta el fileId guardado; si falla (id STALE:
  // archivo borrado/movido) o no hay, BUSCA por appProperties antes de rendirse
  // a bsl, y auto-sana el driveFileId guardado. Loguea cada fallo (antes el
  // catch tragaba el error y todo terminaba como "PDF no encontrado" en bsl).
  const row = await queryOne<{ driveFileId: string | null }>(
    `SELECT "driveFileId" FROM "PEOPLE" WHERE "_id" = $1`, [id],
  ).catch(() => null);

  const candidatos: string[] = [];
  if (row?.driveFileId) candidatos.push(row.driveFileId);
  try {
    const found = await findContractFileId(id);          // busca por appProperties (no-trashed)
    if (found && !candidatos.includes(found)) candidatos.push(found);
  } catch (e: any) {
    console.error(`[download-pdf] findContractFileId falló para ${id}:`, e?.message || e);
  }

  for (const fileId of candidatos) {
    try {
      const bytes = await downloadDrivePdf(fileId);
      // Auto-sana: si el que sirvió no es el guardado, actualiza PEOPLE.driveFileId.
      if (fileId !== row?.driveFileId) {
        query(`UPDATE "PEOPLE" SET "driveFileId" = $1 WHERE "_id" = $2`, [fileId, id]).catch(() => null);
      }
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="contrato-${id}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (e: any) {
      console.error(`[download-pdf] downloadDrivePdf falló para ${id} (fileId=${fileId}):`, e?.message || e);
    }
  }

  // No descargable desde LGS Drive (ni el guardado ni por búsqueda) → bsl.
  console.error(`[download-pdf] sin PDF válido en LGS Drive para ${id} (driveFileId guardado=${row?.driveFileId ?? 'null'}) → fallback bsl`);
  return NextResponse.redirect(`${BSL_DOWNLOAD_URL}/${id}?empresa=LGS`);
}
