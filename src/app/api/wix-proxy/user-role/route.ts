/**
 * API Route: Get user role from Wix
 * Queries USUARIOS_ROLES table to verify user and get their role
 */

import { NextResponse } from 'next/server';

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json(
      { success: false, error: 'Email es requerido' },
      { status: 400 }
    );
  }

  try {
    console.log('🔍 Consultando rol del usuario en Wix:', email);

    const response = await fetch(`${WIX_API_BASE_URL}/userRole?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Error en respuesta de Wix:', response.status);
      return NextResponse.json(
        { success: false, error: 'Error al consultar Wix' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.success) {
      console.log('⚠️ Usuario no encontrado o inactivo:', email);
      return NextResponse.json(data, { status: 404 });
    }

    console.log('✅ Usuario encontrado en Wix:', {
      email: data.email,
      rol: data.rol,
      activo: data.activo
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Error al consultar rol del usuario:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
