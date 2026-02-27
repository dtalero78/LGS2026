import 'server-only';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const spacesClient = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT || 'https://sfo3.digitaloceanspaces.com',
  region: process.env.DO_SPACES_REGION || 'sfo3',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || '',
    secretAccessKey: process.env.DO_SPACES_SECRET || '',
  },
  forcePathStyle: false,
});

export const SPACES_BUCKET = process.env.DO_SPACES_BUCKET || 'lgs-bucket';
export const SPACES_CDN = `https://${SPACES_BUCKET}.${process.env.DO_SPACES_REGION || 'sfo3'}.digitaloceanspaces.com`;

/**
 * Generate a presigned URL for a private video file.
 * @param key - Object key in the bucket, e.g. "videos/bn1-step1.mp4"
 * @param expiresInSeconds - URL validity (default: 2 hours)
 */
export async function getPresignedVideoUrl(
  key: string,
  expiresInSeconds = 7200
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: SPACES_BUCKET, Key: key });
  return getSignedUrl(spacesClient, command, { expiresIn: expiresInSeconds });
}
