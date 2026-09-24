import 'server-only';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  REGLAMENTO_KEY,
  REGLAMENTO_ESTATICO,
  REGLAMENTO_FILENAME,
  getReglamentoPersonalizado,
} from '@/lib/reglamento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/postgres/reglamento[?download=1]
 *
 * Entrega el Reglamento de Participantes al usuario logueado: redirige a la
 * versión cargada en Spaces (URL firmada, 10 min) o, si no hay ninguna, al PDF
 * de respaldo del repo. Es la URL que consume la opción "Reglamentos" del panel
 * del estudiante.
 *
 * Requiere sesión (cualquier rol). El documento es interno — dice "reproducción
 * prohibida" — así que no se expone sin autenticar.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const descargar = new URL(req.url).searchParams.get('download') === '1';
  const personalizado = await getReglamentoPersonalizado();

  const destino = personalizado
    ? await getSignedUrl(
        spacesClient,
        new GetObjectCommand({
          Bucket: SPACES_BUCKET,
          Key: REGLAMENTO_KEY,
          ResponseContentType: 'application/pdf',
          // El atributo `download` de un <a> se ignora al cruzar a otro origen,
          // así que la descarga se fuerza desde la propia URL firmada.
          ...(descargar
            ? { ResponseContentDisposition: `attachment; filename="${REGLAMENTO_FILENAME}"` }
            : {}),
        }),
        { expiresIn: 600 },
      )
    : new URL(REGLAMENTO_ESTATICO, req.url).toString();

  const res = NextResponse.redirect(destino);
  // Sin no-store el navegador puede quedarse con el redirect viejo y seguir
  // mostrando la versión anterior del reglamento tras una actualización.
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
