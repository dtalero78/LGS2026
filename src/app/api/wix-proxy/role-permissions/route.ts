/**
 * API Route: Get role permissions from Wix
 * Queries ROL_PERMISOS table to get permissions for a specific role
 */

import { NextResponse } from 'next/server';

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rol = searchParams.get('rol');

  if (!rol) {
    return NextResponse.json(
      { success: false, error: 'Parámetro rol es requerido', permisos: [] },
      { status: 400 }
    );
  }

  try {
    console.log(`🔍 [API] Consultando permisos para rol: ${rol}`);

    const response = await fetch(`${WIX_API_BASE_URL}/rolePermissions?rol=${encodeURIComponent(rol)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // No cachear para obtener datos frescos
    });

    if (!response.ok) {
      console.error(`❌ [API] Error en respuesta de Wix: ${response.status}`);
      return NextResponse.json(
        { success: false, error: 'Error al consultar Wix', permisos: [] },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.success) {
      console.log(`⚠️ [API] Rol no encontrado en Wix: ${rol}`);
      return NextResponse.json(data, { status: 404 });
    }

    console.log(`✅ [API] Permisos encontrados para ${rol}: ${data.permisos.length} permisos`);

    return NextResponse.json(data);

  } catch (error) {
    console.error(`❌ [API] Error al consultar permisos del rol:`, error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', permisos: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rol, permisos } = body;

    if (!rol || !permisos) {
      return NextResponse.json(
        { success: false, error: 'Parámetros rol y permisos son requeridos' },
        { status: 400 }
      );
    }

    console.log(`🔄 [API] Actualizando permisos para rol: ${rol}, total: ${permisos.length} permisos`);

    const response = await fetch(`${WIX_API_BASE_URL}/updateRolePermissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rol, permisos }),
    });

    if (!response.ok) {
      console.error(`❌ [API] Error actualizando en Wix: ${response.status}`);
      return NextResponse.json(
        { success: false, error: 'Error al actualizar en Wix' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.success) {
      console.log(`⚠️ [API] No se pudieron actualizar permisos: ${data.error}`);
      return NextResponse.json(data, { status: 400 });
    }

    console.log(`✅ [API] Permisos actualizados exitosamente para ${rol}`);

    return NextResponse.json(data);

  } catch (error) {
    console.error(`❌ [API] Error al actualizar permisos:`, error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
