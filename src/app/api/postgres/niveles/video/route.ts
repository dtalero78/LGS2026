import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';
import { NivelesRepository } from '@/repositories/niveles.repository';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * GET /api/postgres/niveles/video?nivel=BN1&step=Step%201
 *
 * Streams the video file from DO Spaces through the server.
 * Avoids CORS issues by proxying the video (browser requests localhost, server fetches S3).
 * Requires authentication.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const nivel = searchParams.get('nivel');
  const step  = searchParams.get('step');
  const key   = searchParams.get('key');   // direct DO Spaces key (instructivos)

  // Mode 1: direct key (instructivos or any Spaces path)
  if (key) {
    if (!key.startsWith('videos/')) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }
    const rangeHeader = request.headers.get('range');
    const command = new GetObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    });
    try {
      const s3Response = await spacesClient.send(command);
      const body = s3Response.Body as any;
      const headers: Record<string, string> = {
        'Content-Type': s3Response.ContentType || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      };
      if (s3Response.ContentLength) headers['Content-Length'] = String(s3Response.ContentLength);
      if (s3Response.ContentRange) headers['Content-Range'] = s3Response.ContentRange;
      return new NextResponse(body as ReadableStream, { status: rangeHeader ? 206 : 200, headers });
    } catch {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
  }

  // Mode 2: lookup by nivel + step
  if (!nivel || !step) {
    return NextResponse.json({ error: 'nivel and step (or key) are required' }, { status: 400 });
  }

  const row = await NivelesRepository.findVideoByNivelAndStep(nivel, step);
  if (!row || !row.videoUrl) {
    return NextResponse.json({ error: 'No hay video para este step' }, { status: 404 });
  }

  // Stream from DO Spaces through the server (avoids browser CORS)
  const rangeHeader = request.headers.get('range');
  const command = new GetObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: row.videoUrl,
    ...(rangeHeader ? { Range: rangeHeader } : {}),
  });

  try {
    const s3Response = await spacesClient.send(command);
    const body = s3Response.Body as any;

    const headers: Record<string, string> = {
      'Content-Type': s3Response.ContentType || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    };
    if (s3Response.ContentLength) headers['Content-Length'] = String(s3Response.ContentLength);
    if (s3Response.ContentRange) headers['Content-Range'] = s3Response.ContentRange;

    const status = rangeHeader ? 206 : 200;
    return new NextResponse(body as ReadableStream, { status, headers });
  } catch {
    return NextResponse.json({ error: 'Archivo de video no encontrado en almacenamiento' }, { status: 404 });
  }
}
