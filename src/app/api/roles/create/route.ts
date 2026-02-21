/**
 * API Route: /api/roles/create
 * POST - Crea un nuevo rol en PostgreSQL ROL_PERMISOS
 * Solo disponible para SUPER_ADMIN
 */

import { NextResponse } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError, ConflictError } from '@/lib/errors';
import { Role } from '@/types/permissions';
import { invalidatePermissionsCache } from '@/config/roles';

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const userRole = (session.user as any).role as Role;

  if (userRole !== Role.SUPER_ADMIN && userRole !== 'admin') {
    throw new ForbiddenError('Solo SUPER_ADMIN puede crear roles');
  }

  const body = await req.json();
  const { rol, descripcion, permisos } = body;

  if (!rol || !descripcion) {
    throw new ValidationError('Faltan parámetros: rol y descripcion son requeridos');
  }

  // Validar que el rol no exista ya
  const checkResponse = await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/postgres/roles?rol=${encodeURIComponent(rol)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    }
  );

  const checkResult = await checkResponse.json();

  if (checkResult.success && checkResult.rol) {
    throw new ConflictError('El rol ya existe');
  }

  console.log(`🔄 Creando nuevo rol ${rol}`);

  const response = await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/postgres/roles`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rol,
        descripcion,
        permisos: permisos || [],
        activo: true,
      }),
    }
  );

  const result = await response.json();

  if (!result.success) {
    console.error('❌ Error al crear rol:', result.error);
    return NextResponse.json(
      { error: 'Error al crear rol', details: result.error },
      { status: 500 }
    );
  }

  invalidatePermissionsCache();
  console.log(`✅ Rol ${rol} creado. Cache invalidado.`);

  return successResponse({
    message: `Rol ${rol} creado exitosamente`,
    data: {
      rol,
      descripcion,
      permisos: permisos || [],
      activo: true,
    },
  });
});
