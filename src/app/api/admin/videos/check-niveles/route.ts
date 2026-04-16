/**
 * POST /api/admin/videos/check-niveles
 *
 * Checks all NIVELES rows with videoUrl set and verifies whether
 * the file actually exists in DO Spaces. Clears videoUrl for stale entries.
 * SUPER_ADMIN / ADMIN only.
 */
import 'server-only'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-postgres'
import { query, queryMany } from '@/lib/postgres'
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces'
import { HeadObjectCommand } from '@aws-sdk/client-s3'

async function requireAdmin(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') return null
  return session
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request)
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Get all rows with a videoUrl set
    const rows = await queryMany<{ _id: string; code: string; step: string; videoUrl: string }>(
      `SELECT "_id", "code", "step", "videoUrl" FROM "NIVELES" WHERE "videoUrl" IS NOT NULL AND "videoUrl" != ''`
    )

    const results: { code: string; step: string; videoUrl: string; exists: boolean; cleared: boolean }[] = []

    for (const row of rows) {
      let exists = false
      try {
        await spacesClient.send(new HeadObjectCommand({ Bucket: SPACES_BUCKET, Key: row.videoUrl }))
        exists = true
      } catch { exists = false }

      let cleared = false
      if (!exists) {
        await query(`UPDATE "NIVELES" SET "videoUrl" = NULL WHERE "_id" = $1`, [row._id])
        cleared = true
      }

      results.push({ code: row.code, step: row.step, videoUrl: row.videoUrl, exists, cleared })
    }

    return NextResponse.json({ success: true, checked: results.length, results })
  } catch (e: any) {
    console.error('[check-niveles]', e)
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 })
  }
}
