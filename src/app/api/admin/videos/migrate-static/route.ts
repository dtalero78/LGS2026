/**
 * POST /api/admin/videos/migrate-static
 *
 * One-time migration: reads public/instructivo{n}.mp4 files from the filesystem
 * and uploads them to DO Spaces, then updates APP_CONFIG.instructivos_config.
 * Only runs for instructivos that do NOT yet have a videoKey set.
 */
import 'server-only'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-postgres'
import { query, queryOne } from '@/lib/postgres'
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { readFile } from 'fs/promises'
import path from 'path'

const CONFIG_KEY = 'instructivos_config'

const DEFAULT_INSTRUCTIVOS = [
  { id: 1, title: 'Instructivo 1', description: 'Cómo agendar tus clases',     videoKey: null },
  { id: 2, title: 'Instructivo 2', description: 'Cómo funciona la plataforma', videoKey: null },
]

interface Instructivo {
  id: number; title: string; description: string; videoKey: string | null
}

async function requireAdmin(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') return null
  return session
}

async function loadInstructivos(): Promise<Instructivo[]> {
  const row = await queryOne<{ value: string }>(
    `SELECT "value" FROM "APP_CONFIG" WHERE "key" = $1`, [CONFIG_KEY]
  )
  if (!row?.value) return DEFAULT_INSTRUCTIVOS
  try {
    const parsed = JSON.parse(row.value)
    return Array.isArray(parsed) ? parsed : DEFAULT_INSTRUCTIVOS
  } catch { return DEFAULT_INSTRUCTIVOS }
}

async function saveInstructivos(list: Instructivo[], updatedBy: string) {
  await query(
    `INSERT INTO "APP_CONFIG" ("key","value","color","updatedBy","_updatedDate")
     VALUES ($1,$2,'#ffffff',$3,NOW())
     ON CONFLICT ("key") DO UPDATE SET "value"=EXCLUDED."value","updatedBy"=EXCLUDED."updatedBy","_updatedDate"=NOW()`,
    [CONFIG_KEY, JSON.stringify(list), updatedBy]
  )
}

export async function POST(request: Request) {
  const session = await requireAdmin(request)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const userEmail = (session.user as any).email ?? 'admin'

  const list = await loadInstructivos()
  const results: { id: number; status: string; message: string }[] = []

  for (const item of list) {
    if (item.videoKey) {
      results.push({ id: item.id, status: 'skipped', message: 'Ya tiene video en Spaces' })
      continue
    }

    const staticPath = path.join(process.cwd(), 'public', `instructivo${item.id}.mp4`)
    let buffer: Buffer
    try {
      buffer = await readFile(staticPath)
    } catch {
      results.push({ id: item.id, status: 'not_found', message: `No existe public/instructivo${item.id}.mp4` })
      continue
    }

    const key = `videos/instructivos/instructivo-${item.id}.mp4`
    try {
      await spacesClient.send(new PutObjectCommand({
        Bucket: SPACES_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4',
        ACL: 'private',
      }))
      // Update videoKey in list
      const idx = list.findIndex(i => i.id === item.id)
      if (idx >= 0) list[idx].videoKey = key
      results.push({ id: item.id, status: 'uploaded', message: `Subido a ${key}` })
    } catch (e: any) {
      results.push({ id: item.id, status: 'error', message: e.message || 'Error al subir' })
    }
  }

  // Save updated list only if at least one was uploaded
  if (results.some(r => r.status === 'uploaded')) {
    await saveInstructivos(list, userEmail)
  }

  return NextResponse.json({ success: true, results })
}
