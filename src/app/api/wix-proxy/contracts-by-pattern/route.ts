import { NextRequest, NextResponse } from 'next/server';

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pattern, year } = body;

    // Call Wix backend function to get contracts by pattern
    const response = await fetch(`${WIX_API_BASE_URL}/getContractsByPattern`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pattern, year })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from Wix:', errorText);
      return NextResponse.json(
        { error: 'Error fetching contracts from Wix' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching contracts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching contracts' },
      { status: 500 }
    );
  }
}