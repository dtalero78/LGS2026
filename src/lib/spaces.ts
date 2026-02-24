import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';

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
