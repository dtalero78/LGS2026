import { NextRequest, NextResponse } from 'next/server';

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';

/**
 * POST /api/postgres/roles
 * Proxy para crear un nuevo rol en Wix ROL_PERMISOS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔄 Proxy: Creando rol en Wix:', body.rol);

    const response = await fetch(`${WIX_API_BASE_URL}/createRole`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Wix API error: ${response.status}`);
    }

    const data = await response.json();

    console.log(`✅ Proxy: Rol creado en Wix`);

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error en proxy create-role:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear rol en Wix',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
