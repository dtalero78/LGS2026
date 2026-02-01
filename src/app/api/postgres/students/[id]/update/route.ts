import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * PUT /api/postgres/students/[id]/update
 *
 * Update student information
 *
 * Body:
 * {
 *   primerNombre?: string,
 *   segundoNombre?: string,
 *   primerApellido?: string,
 *   segundoApellido?: string,
 *   email?: string,
 *   celular?: string,
 *   numeroId?: string,
 *   tipoDocumento?: string,
 *   nivel?: string,
 *   step?: string,
 *   nivelParalelo?: string,
 *   stepParalelo?: string,
 *   estadoInactivo?: boolean,
 *   vigencia?: number,
 *   finalContrato?: string,
 *   contrato?: string,
 *   tipoUsuario?: string
 * }
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Allowed fields to update (matching actual PEOPLE table schema)
    const allowedFields = [
      'primerNombre',
      'segundoNombre',
      'primerApellido',
      'segundoApellido',
      'email',
      'celular',
      'numeroId',
      'telefono',
      'nivel',
      'step',
      'nivelParalelo',
      'stepParalelo',
      'estadoInactivo',
      'vigencia',
      'finalContrato',
      'contrato',
      'tipoUsuario',
      'fechaNacimiento',
      'genero',
      'ciudad',
      'domicilio',
      'empresa',
      'cargo',
      'ingresos',
      'asesor',
      'agenteAsignado',
      'asesorAsignado',
      'comentarios',
      'comentariosAdministrativo',
      'observacionesContrato',
      'plataforma',
      'plan',
      'medioPago',
      'estado'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add _updatedDate
    updates.push(`"_updatedDate" = NOW()`);

    // Add student ID as last parameter
    values.push(params.id);

    const result = await query(
      `UPDATE "PEOPLE"
       SET ${updates.join(', ')}
       WHERE "_id" = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Parse JSONB fields if they're strings
    const student = result.rows[0];
    if (typeof student.onHoldHistory === 'string') {
      student.onHoldHistory = JSON.parse(student.onHoldHistory || '[]');
    }
    if (typeof student.extensionHistory === 'string') {
      student.extensionHistory = JSON.parse(student.extensionHistory || '[]');
    }
    if (typeof student.documentacion === 'string') {
      student.documentacion = JSON.parse(student.documentacion || '[]');
    }

    return NextResponse.json({
      success: true,
      student,
      updated: updates.length - 1, // Exclude _updatedDate from count
    });
  } catch (error: any) {
    console.error('❌ Error updating student:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
