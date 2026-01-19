import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toNumber, messageBody } = body

    console.log('📱 WhatsApp API Request:', { toNumber, messageBody: messageBody?.substring(0, 50) + '...' })

    if (!toNumber || !messageBody) {
      console.error('❌ Missing required fields:', { toNumber: !!toNumber, messageBody: !!messageBody })
      return NextResponse.json(
        { success: false, error: 'Phone number and message are required' },
        { status: 400 }
      )
    }

    // Format phone number for WhatsApp - remove ALL non-digit characters (including invisible Unicode)
    let formattedNumber = toNumber.toString().replace(/\D/g, '')

    // Ensure the number starts with a valid country code
    if (formattedNumber.length < 10) {
      console.error('❌ Phone number too short:', formattedNumber)
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    console.log('📤 Sending WhatsApp to:', formattedNumber, `(original: ${toNumber})`)

    // Send WhatsApp message using the same API as Wix
    const whatsappResponse = await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': 'Bearer VSyDX4j7ooAJ7UGOhz8lGplUVDDs2EYj',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        typing_time: 0,
        to: formattedNumber,
        body: messageBody
      })
    })

    const responseText = await whatsappResponse.text()
    console.log('📨 WhatsApp API Response:', whatsappResponse.status, responseText.substring(0, 200))

    if (!whatsappResponse.ok) {
      console.error('❌ WhatsApp API error:', whatsappResponse.status, responseText)

      // Try to parse error details
      let errorDetails = responseText
      try {
        const errorJson = JSON.parse(responseText)
        errorDetails = errorJson.message || errorJson.error || responseText
      } catch (e) {
        // Keep original text if not JSON
      }

      return NextResponse.json(
        {
          success: false,
          error: `WhatsApp API error: ${errorDetails}`,
          details: {
            status: whatsappResponse.status,
            message: errorDetails
          }
        },
        { status: 500 }
      )
    }

    let whatsappData
    try {
      whatsappData = JSON.parse(responseText)
    } catch (e) {
      console.error('⚠️ Could not parse WhatsApp response as JSON')
      whatsappData = { response: responseText }
    }

    console.log('✅ WhatsApp sent successfully')

    return NextResponse.json({
      success: true,
      message: 'WhatsApp message sent successfully',
      data: whatsappData
    })

  } catch (error: any) {
    console.error('❌ Error sending WhatsApp message:', error)
    console.error('Error details:', error.message, error.stack)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send WhatsApp message',
        details: error.toString()
      },
      { status: 500 }
    )
  }
}