import { NextResponse } from 'next/server';

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';

/**
 * GET /api/postgres/roles
 * Proxy para obtener todos los roles desde Wix ROL_PERMISOS
 */
export async function GET() {
  try {
    console.log('🔄 Proxy: Solicitando todos los roles desde Wix');

    const response = await fetch(`${WIX_API_BASE_URL}/allRoles`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Wix API error: ${response.status}`);
    }

    const data = await response.json();

    console.log(`✅ Proxy: Recibidos ${data.roles?.length || 0} roles desde Wix`);

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error en proxy all-roles:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener roles desde Wix',
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
