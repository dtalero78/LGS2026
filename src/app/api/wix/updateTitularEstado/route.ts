import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-postgres'
import { query, queryOne } from '@/lib/postgres'
import { registrarCambioAprobacion, nombreDe } from '@/lib/aprobacion-audit'

/**
 * POST /api/wix/updateTitularEstado  (LEGACY — ninguna pantalla del panel lo usa)
 *
 * Cambia PEOPLE.aprobacion. Endurecido: solo `x-wix-secret` o sesión de STAFF
 * (nunca ESTUDIANTE); no permite sacar de 'Aprobado' (eso solo se hace en la
 * ficha del titular, con advertencia y motivo) y registra el cambio en
 * APROBACION_AUDIT.
 */
async function getActor(request: NextRequest): Promise<{ ok: boolean; session: any }> {
  const wixSecret = request.headers.get('x-wix-secret');
  if (process.env.WIX_SECRET && wixSecret === process.env.WIX_SECRET) return { ok: true, session: null };
  const session = await getServerSession(authOptions);
  if (!session) return { ok: false, session: null };
  const role = String((session.user as any)?.role ?? '').toUpperCase();
  if (role === 'ESTUDIANTE') return { ok: false, session };
  return { ok: true, session };
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request)
  if (!actor.ok) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json()
    const { personId, nuevoEstado } = body

    if (!personId || !nuevoEstado) {
      return NextResponse.json(
        { success: false, error: 'personId and nuevoEstado are required' },
        { status: 400 }
      )
    }

    const actual = await queryOne<any>(
      `SELECT "_id","contrato","aprobacion","tipoUsuario","primerNombre","primerApellido" FROM "PEOPLE" WHERE "_id" = $1`,
      [personId]
    )
    if (!actual) {
      return NextResponse.json({ success: false, error: 'Titular not found' }, { status: 404 })
    }
    if (actual.aprobacion === 'Aprobado' && nuevoEstado !== 'Aprobado') {
      return NextResponse.json(
        { success: false, error: 'El contrato ya está aprobado: cambia su estado desde la ficha del titular.' },
        { status: 400 }
      )
    }

    const result = await query(
      `UPDATE "PEOPLE"
       SET "aprobacion" = $2, "_updatedDate" = NOW()
       WHERE "_id" = $1
       RETURNING *`,
      [personId, nuevoEstado]
    )

    await registrarCambioAprobacion({
      personId,
      contrato: actual.contrato,
      tipoUsuario: actual.tipoUsuario,
      nombre: nombreDe(actual),
      estadoAnterior: actual.aprobacion,
      estadoNuevo: nuevoEstado,
      origen: 'WIX_LEGACY',
      session: actor.session,
      actor: actor.session ? null : 'wix-secret',
    })

    return NextResponse.json({
      success: true,
      message: 'Titular estado updated successfully',
      person: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ Error in updateTitularEstado:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update titular estado', details: error.message },
      { status: 500 }
    )
  }
}
