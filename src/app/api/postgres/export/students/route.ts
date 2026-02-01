import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/export/students
 *
 * Export students to CSV
 *
 * Query params:
 * - nivel: string - Filter by level
 * - plataforma: string - Filter by platform (Colombia, Peru, Chile, Ecuador)
 * - estadoInactivo: boolean - Filter by active/inactive status
 * - includeAcademic: boolean - Include academic info (default: false)
 */
export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const nivel = searchParams.get('nivel');
    const plataforma = searchParams.get('plataforma');
    const estadoInactivo = searchParams.get('estadoInactivo');
    const includeAcademic = searchParams.get('includeAcademic') === 'true';

    // Build WHERE clause
    const conditions: string[] = [`"tipoUsuario" = 'BENEFICIARIO'`];
    const values: any[] = [];
    let paramIndex = 1;

    if (nivel) {
      conditions.push(`"nivel" = $${paramIndex}`);
      values.push(nivel);
      paramIndex++;
    }

    if (plataforma) {
      conditions.push(`"plataforma" = $${paramIndex}`);
      values.push(plataforma);
      paramIndex++;
    }

    if (estadoInactivo !== null) {
      conditions.push(`"estadoInactivo" = $${paramIndex}`);
      values.push(estadoInactivo === 'true');
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Base query
    let selectQuery = `
      SELECT
        p."_id",
        p."numeroId",
        p."primerNombre",
        p."segundoNombre",
        p."primerApellido",
        p."segundoApellido",
        p."email",
        p."celular",
        p."ciudad",
        p."plataforma",
        p."nivel",
        p."step",
        p."nivelParalelo",
        p."stepParalelo",
        p."estadoInactivo",
        p."contrato",
        p."vigencia",
        p."finalContrato",
        p."fechaNacimiento",
        p."genero"
    `;

    // Add academic info if requested
    if (includeAcademic) {
      selectQuery += `,
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" WHERE "idEstudiante" = p."_id" AND "asistio" = true) as total_asistencias,
        (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" WHERE "idEstudiante" = p."_id") as total_clases
      `;
    }

    selectQuery += `
      FROM "PEOPLE" p
      ${whereClause}
      ORDER BY p."primerNombre", p."primerApellido"
    `;

    const result = await query(selectQuery, values);

    // Convert to CSV
    const headers = [
      'ID',
      'Numero Documento',
      'Primer Nombre',
      'Segundo Nombre',
      'Primer Apellido',
      'Segundo Apellido',
      'Email',
      'Celular',
      'Ciudad',
      'Plataforma',
      'Nivel',
      'Step',
      'Nivel Paralelo',
      'Step Paralelo',
      'Estado Inactivo',
      'Contrato',
      'Vigencia (dias)',
      'Final Contrato',
      'Fecha Nacimiento',
      'Genero'
    ];

    if (includeAcademic) {
      headers.push('Total Asistencias', 'Total Clases');
    }

    const csvRows = [headers.join(',')];

    for (const row of result.rows) {
      const csvRow = [
        row._id,
        row.numeroId || '',
        `"${(row.primerNombre || '').replace(/"/g, '""')}"`,
        `"${(row.segundoNombre || '').replace(/"/g, '""')}"`,
        `"${(row.primerApellido || '').replace(/"/g, '""')}"`,
        `"${(row.segundoApellido || '').replace(/"/g, '""')}"`,
        row.email || '',
        row.celular || '',
        row.ciudad || '',
        row.plataforma || '',
        row.nivel || '',
        row.step || '',
        row.nivelParalelo || '',
        row.stepParalelo || '',
        row.estadoInactivo ? 'Si' : 'No',
        row.contrato || '',
        row.vigencia || '',
        row.finalContrato ? new Date(row.finalContrato).toISOString().split('T')[0] : '',
        row.fechaNacimiento ? new Date(row.fechaNacimiento).toISOString().split('T')[0] : '',
        row.genero || ''
      ];

      if (includeAcademic) {
        csvRow.push(
          String(row.total_asistencias || 0),
          String(row.total_clases || 0)
        );
      }

      csvRows.push(csvRow.join(','));
    }

    const csv = csvRows.join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="students_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Error exporting students:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
