import 'server-only'
import { handler, successResponse } from '@/lib/api-helpers'
import { query, queryOne } from '@/lib/postgres'

/**
 * GET /api/postgres/students/[id]/academic-audit
 * Returns the 3 audit fields from ACADEMICA for the student:
 *   - cambioStepHistory (JSONB array)
 *   - inicianivel       (JSONB object)
 *   - clrhistoric       (JSONB object)
 * Columns are created with ADD COLUMN IF NOT EXISTS on first call.
 */
export const GET = handler(async (
  _req: Request,
  { params }: { params: Record<string, string> }
) => {
  const academicaId = params.id

  // Ensure columns exist (idempotent)
  await query(`ALTER TABLE "ACADEMICA" ADD COLUMN IF NOT EXISTS "cambioStepHistory" JSONB`, []).catch(() => null)
  await query(`ALTER TABLE "ACADEMICA" ADD COLUMN IF NOT EXISTS "inicianivel" JSONB`, []).catch(() => null)
  await query(`ALTER TABLE "ACADEMICA" ADD COLUMN IF NOT EXISTS "clrhistoric" JSONB`, []).catch(() => null)

  const row = await queryOne<{
    cambioStepHistory: any
    inicianivel: any
    clrhistoric: any
  }>(
    `SELECT "cambioStepHistory", "inicianivel", "clrhistoric"
     FROM "ACADEMICA"
     WHERE "_id" = $1`,
    [academicaId]
  )

  return successResponse({
    cambioStepHistory: row?.cambioStepHistory ?? null,
    inicianivel:       row?.inicianivel ?? null,
    clrhistoric:       row?.clrhistoric ?? null,
  })
})
