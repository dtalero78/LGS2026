import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MessageTemplatesRepository } from '@/repositories/message-templates.repository'
import { fillTemplate } from '@/lib/message-template-filler'
import { query } from '@/lib/postgres'

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const wixSecret = request.headers.get('x-wix-secret');
  if (process.env.WIX_SECRET && wixSecret === process.env.WIX_SECRET) return true;
  const session = await getServerSession(authOptions);
  return !!session;
}

// Fallback si la plantilla 'reagendarbienvenida' no existe / está inactiva.
const fallbackMessage = (nombre: string) =>
  `Hola ${nombre || ''} 👋, te extrañamos en tu Sesión Welcome. Es muy importante que asistas. Reagenda tu sesión aquí:`;

/**
 * POST /api/wix/sendReagendarWhatsApp
 * Body: { celular, beneficiarioId (=ACADEMICA._id), nombre }
 *
 * Envía el mensaje de la plantilla `reagendarbienvenida` (rellena {{nombre}})
 * + el link a la página pública de reagendar Welcome.
 */
export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json()
    const { celular, beneficiarioId, nombre } = body

    if (!celular || !beneficiarioId) {
      return NextResponse.json(
        { success: false, error: 'Phone number and beneficiario ID are required' },
        { status: 400 }
      )
    }

    const formattedNumber = celular.toString().replace(/\D/g, '')
    if (formattedNumber.length < 10) {
      return NextResponse.json({ success: false, error: 'Invalid phone number format' }, { status: 400 })
    }

    const reagendarUrl = `https://lgs-plataforma.com/reagendar-welcome/${beneficiarioId}`

    // Base = plantilla reagendarbienvenida (fill {{nombre}}), con fallback.
    let base = fallbackMessage(nombre || '')
    try {
      const tpl = await MessageTemplatesRepository.findBySlug('reagendarbienvenida')
      if (tpl && tpl.activo && tpl.contenido?.trim()) {
        base = fillTemplate(tpl.contenido, { nombre: nombre || '' })
      }
    } catch {
      // usa fallback
    }

    const message = `${base}\n\n${reagendarUrl}`

    const whatsappResponse = await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${process.env.WHAPI_TOKEN || 'I1s8u9FihgMttIDRvRDoMpOJB1LzPgtx'}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ typing_time: 0, to: formattedNumber, body: message })
    })

    const responseText = await whatsappResponse.text()

    if (!whatsappResponse.ok) {
      let errorDetails = responseText
      try {
        const errorJson = JSON.parse(responseText)
        errorDetails = errorJson.message || errorJson.error || responseText
      } catch { /* keep text */ }
      return NextResponse.json(
        { success: false, error: `WhatsApp API error: ${errorDetails}` },
        { status: 500 }
      )
    }

    let whatsappData
    try { whatsappData = JSON.parse(responseText) } catch { whatsappData = { response: responseText } }

    // Incrementa el contador de "Reagendar Welcome" en ACADEMICA (por beneficiarioId = ACADEMICA._id).
    let contador: number | null = null
    try {
      const r = await query(
        `UPDATE "ACADEMICA" SET "msgReagendarCount" = COALESCE("msgReagendarCount",0)+1, "_updatedDate"=NOW() WHERE "_id"=$1 RETURNING "msgReagendarCount" AS n`,
        [beneficiarioId]
      )
      contador = (r.rows[0] as any)?.n ?? null
    } catch (e) {
      console.error('⚠️ No se pudo incrementar el contador de reagendar:', e)
    }

    return NextResponse.json({ success: true, message: 'Reagendar WhatsApp message sent successfully', contador, data: whatsappData })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send Reagendar WhatsApp message' },
      { status: 500 }
    )
  }
}
