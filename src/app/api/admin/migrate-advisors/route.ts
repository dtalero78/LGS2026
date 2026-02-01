import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

const WIX_API_URL = 'https://www.lgsplataforma.com/_functions/advisors'

/**
 * POST /api/admin/migrate-advisors
 * Migra la tabla ADVISORS desde Wix a PostgreSQL
 *
 * NOTA: Este endpoint debe eliminarse después de la migración
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting ADVISORS migration...')

    // 1. Fetch advisors from Wix
    console.log('📥 Fetching advisors from Wix...')
    const wixResponse = await fetch(WIX_API_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!wixResponse.ok) {
      throw new Error(`Wix API error: ${wixResponse.status}`)
    }

    const wixData = await wixResponse.json()

    if (!wixData.success || !wixData.advisors) {
      throw new Error('Invalid response from Wix')
    }

    const advisors = wixData.advisors
    console.log(`✅ Fetched ${advisors.length} advisors from Wix`)

    // 2. Create table if not exists
    console.log('📋 Creating ADVISORS table...')
    await query(`
      CREATE TABLE IF NOT EXISTS "ADVISORS" (
        "_id" VARCHAR(255) PRIMARY KEY,
        "primerNombre" VARCHAR(255),
        "primerApellido" VARCHAR(255),
        "nombreCompleto" VARCHAR(255),
        "email" VARCHAR(255),
        "zoom" TEXT,
        "telefono" VARCHAR(50),
        "pais" VARCHAR(100),
        "activo" BOOLEAN DEFAULT true,
        "_createdDate" TIMESTAMP DEFAULT NOW(),
        "_updatedDate" TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('✅ ADVISORS table created/verified')

    // 3. Insert advisors
    console.log('📝 Inserting advisors...')
    let inserted = 0
    let updated = 0
    let errors = 0

    for (const advisor of advisors) {
      try {
        const result = await query(
          `INSERT INTO "ADVISORS" (
            "_id", "primerNombre", "primerApellido", "nombreCompleto",
            "email", "zoom", "activo", "_createdDate", "_updatedDate"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT ("_id") DO UPDATE SET
            "primerNombre" = EXCLUDED."primerNombre",
            "primerApellido" = EXCLUDED."primerApellido",
            "nombreCompleto" = EXCLUDED."nombreCompleto",
            "email" = EXCLUDED."email",
            "zoom" = EXCLUDED."zoom",
            "_updatedDate" = NOW()
          RETURNING (xmax = 0) AS inserted`,
          [
            advisor._id,
            advisor.primerNombre || null,
            advisor.primerApellido || null,
            advisor.nombreCompleto || null,
            advisor.email || null,
            advisor.zoom || null,
            true,
          ]
        )

        if (result.rows[0]?.inserted) {
          inserted++
        } else {
          updated++
        }
      } catch (error: any) {
        console.error(`❌ Error with advisor ${advisor._id}:`, error.message)
        errors++
      }
    }

    // 4. Verify
    const countResult = await query('SELECT COUNT(*) as total FROM "ADVISORS"')
    const totalInDb = countResult.rows[0].total

    console.log('✅ Migration completed!')

    return NextResponse.json({
      success: true,
      message: 'ADVISORS migration completed',
      stats: {
        fetchedFromWix: advisors.length,
        inserted,
        updated,
        errors,
        totalInPostgreSQL: totalInDb,
      },
    })
  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Migration failed',
      },
      { status: 500 }
    )
  }
}

// GET para verificar el estado actual
export async function GET() {
  try {
    const result = await query('SELECT COUNT(*) as total FROM "ADVISORS"')
    return NextResponse.json({
      success: true,
      totalAdvisors: result.rows[0].total,
    })
  } catch (error: any) {
    // Table might not exist yet
    return NextResponse.json({
      success: false,
      error: error.message,
      note: 'Table may not exist yet. Use POST to migrate.',
    })
  }
}
