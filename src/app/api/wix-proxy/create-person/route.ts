import { NextRequest, NextResponse } from 'next/server';

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Call Wix backend function to create person
    const response = await fetch(`${WIX_API_BASE_URL}/createPerson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from Wix:', errorText);
      return NextResponse.json(
        { error: 'Error creating person in Wix' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creating person' },
      { status: 500 }
    );
  }
}