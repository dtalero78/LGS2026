import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * GET /api/postgres/niveles/material?key=materials/Beginner%20(BN1)...pdf
 *
 * Streams a PDF material file from DO Spaces through the server.
 * Avoids CORS issues — browser requests localhost, server fetches S3.
 * Requires authentication.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key || !key.startsWith('materials/')) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  const command = new GetObjectCommand({ Bucket: SPACES_BUCKET, Key: key });
  const s3Response = await spacesClient.send(command);
  const body = s3Response.Body as any;

  // Extract filename for Content-Disposition header
  const filename = key.split('/').pop() || 'document.pdf';

  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Cache-Control': 'private, max-age=3600',
  };
  if (s3Response.ContentLength) headers['Content-Length'] = String(s3Response.ContentLength);

  return new NextResponse(body as ReadableStream, { status: 200, headers });
}
