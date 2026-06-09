/**
 * POST /api/admin/libros-interactivos/[codigo]/audios/presign
 *
 * Body: { pagina: number, titulo?: string, contentType?: string }
 *
 * Devuelve presigned PUT URL para subir el MP3 directo a Spaces sin pasar
 * por el server. La key se construye así:
 *
 *   audio/page-NNN[-{slug}].mp3
 *
 * donde {slug} es el título normalizado (a-z 0-9 -). Si no se pasa título,
 * la key queda como audio/page-NNN.mp3 (caso "1 audio por página", legacy).
 *
 * Esto permite que una misma página tenga múltiples audios distinguidos por
 * título (ej. "dialogo", "maria", "john"), todos coexistentes.
 *
 * El cliente debe llamar a POST /audios DESPUÉS de hacer el PUT, pasando
 * el mismo `key` que se devuelve aquí.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requirePermission } from '@/lib/api-permissions';
import { AcademicoPermission } from '@/types/permissions';

/** Normaliza un título a slug seguro: minúsculas, sin acentos, [a-z0-9-] solamente. */
function slugify(input: string): string {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function POST(
  request: Request,
  { params }: { params: { codigo: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await requirePermission(session, AcademicoPermission.ACTUALIZAR_MATERIAL);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 403 });
  }

  const codigo = String(params.codigo || '').toUpperCase().trim();
  const body = await request.json().catch(() => ({}));
  const pagina = Number(body?.pagina);
  const tituloRaw = typeof body?.titulo === 'string' ? body.titulo.trim() : '';
  const contentType = body?.contentType || 'audio/mpeg';

  if (!codigo) {
    return NextResponse.json({ success: false, error: 'codigo requerido' }, { status: 400 });
  }
  if (!Number.isInteger(pagina) || pagina < 1) {
    return NextResponse.json(
      { success: false, error: 'pagina debe ser entero >= 1' },
      { status: 400 }
    );
  }

  // Construye la key: audio/page-NNN.mp3 si no hay título,
  //                   audio/page-NNN-{slug}.mp3 si hay título.
  const slug = tituloRaw ? slugify(tituloRaw) : '';
  const paginaPadded = String(pagina).padStart(3, '0');
  const relKey = slug
    ? `audio/page-${paginaPadded}-${slug}.mp3`
    : `audio/page-${paginaPadded}.mp3`;
  const fullKey = `materials/interactive/${codigo}/${relKey}`;

  const command = new PutObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: fullKey,
    ContentType: contentType,
    ACL: 'private',
  });

  const presignedUrl = await getSignedUrl(spacesClient, command, { expiresIn: 600 });
  return NextResponse.json({
    success: true,
    presignedUrl,
    key: relKey,    // ← el cliente lo envía al POST /audios para registrar
    fullKey,         // informativo
    titulo: tituloRaw || null,
  });
}
