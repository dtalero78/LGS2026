/**
 * API Route: /api/wix-proxy/student-progress
 * Proxy para obtener el diagnóstico académico "¿Cómo voy?" del estudiante
 */

import { NextRequest, NextResponse } from 'next/server';

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';

/**
 * GET /api/wix-proxy/student-progress?id=studentId
 * Obtiene el diagnóstico académico del estudiante
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const studentId = searchParams.get('id');

    if (!studentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de estudiante requerido'
        },
        { status: 400 }
      );
    }

    console.log(`📊 Obteniendo diagnóstico académico para estudiante: ${studentId}`);

    const wixUrl = `${WIX_API_BASE_URL}/studentProgress?id=${encodeURIComponent(studentId)}`;

    const response = await fetch(wixUrl, {
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

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('❌ Error en /api/wix-proxy/student-progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error obteniendo diagnóstico académico',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
