import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    const eventData = await request.json()

    console.log('➕ [PostgreSQL] Creating calendar event:', eventData)

    // Generate new ID
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Extract date and hora from dia timestamp
    const diaDate = new Date(eventData.dia)
    const fecha = diaDate.toISOString().split('T')[0] // YYYY-MM-DD
    const hora = eventData.hora || `${diaDate.getHours().toString().padStart(2, '0')}:${diaDate.getMinutes().toString().padStart(2, '0')}`

    // Build tituloONivel
    let tituloONivel = eventData.titulo || eventData.nombreEvento || ''
    if (eventData.nivel) {
      tituloONivel = eventData.nivel + (eventData.step ? ` - ${eventData.step}` : '')
    }

    // Insert event
    const result = await query(
      `INSERT INTO "CALENDARIO" (
        "_id", "dia", "fecha", "hora", "advisor", "nivel", "step", "tipo",
        "titulo", "nombreEvento", "tituloONivel", "linkZoom", "limiteUsuarios",
        "club", "observaciones", "inscritos", "origen", "_createdDate", "_updatedDate"
      ) VALUES (
        $1, $2::timestamp with time zone, $3::date, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, 0, 'POSTGRES', NOW(), NOW()
      )
      RETURNING *`,
      [
        eventId,
        eventData.dia,
        fecha,
        hora,
        eventData.advisor,
        eventData.nivel || null,
        eventData.step || null,
        eventData.tipo || eventData.evento || 'SESSION',
        eventData.titulo || eventData.tituloONivel || null,
        eventData.nombreEvento || null,
        tituloONivel || eventData.tituloONivel || '',
        eventData.linkZoom || null,
        eventData.limiteUsuarios || 30,
        eventData.club || null,
        eventData.observaciones || null
      ]
    )

    console.log('✅ [PostgreSQL] Calendario event created:', eventId)

    return NextResponse.json({
      success: true,
      event: result.rows[0],
      message: 'Evento creado exitosamente en CALENDARIO'
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in create-calendario-event API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}