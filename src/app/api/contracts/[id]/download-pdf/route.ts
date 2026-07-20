import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getDriveMode } from '@/lib/contract-drive';
import { findContractFileId, downloadDrivePdf } from '@/lib/google-drive';

const BSL_DOWNLOAD_URL = 'https://bsl-utilidades-yp78a.ondigitalocean.app/descargar-pdf-drive';

/**
 * GET /api/contracts/[id]/download-pdf
 *
 * Descarga el PDF del contrato respetando el mismo interruptor que la subida:
 *   modo 'bsl' → redirige a bsl-utilidades (comportamiento previo).
 *   modo 'lgs' → busca el archivo en la Unidad compartida por documento=id y lo
 *                sirve directo desde LGS.
 *
 * Público (se abre con window.open desde el panel), igual que la descarga previa.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const mode = await getDriveMode();

  if (mode === 'bsl') {
    return NextResponse.redirect(`${BSL_DOWNLOAD_URL}/${id}?empresa=LGS`);
  }

  // modo 'lgs': buscar en la Unidad compartida. Si el contrato NO está ahí
  // (p.ej. contratos que solo existen en bsl y aún no se subieron/regeneraron),
  // se cae de vuelta a bsl para no dejar la descarga en 404.
  try {
    const fileId = await findContractFileId(id);
    if (!fileId) {
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
