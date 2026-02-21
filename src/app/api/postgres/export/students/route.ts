/**
 * GET /api/postgres/export/students
 * Export students (beneficiarios) as CSV with optional filters
 */

import { NextResponse } from 'next/server';
import { handlerWithAuth } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';

export const GET = handlerWithAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const nivel = searchParams.get('nivel');
  const plataforma = searchParams.get('plataforma');
  const estadoInactivo = searchParams.get('estadoInactivo');
  const includeAcademic = searchParams.get('includeAcademic') === 'true';

  const conditions: string[] = [`"tipoUsuario" = 'BENEFICIARIO'`];
  const values: any[] = [];
  let pi = 1;

  if (nivel) { conditions.push(`"nivel" = $${pi}`); values.push(nivel); pi++; }
  if (plataforma) { conditions.push(`"plataforma" = $${pi}`); values.push(plataforma); pi++; }
  if (estadoInactivo !== null) { conditions.push(`"estadoInactivo" = $${pi}`); values.push(estadoInactivo === 'true'); pi++; }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  let selectQuery = `SELECT p."_id", p."numeroId", p."primerNombre", p."segundoNombre", p."primerApellido",
    p."segundoApellido", p."email", p."celular", p."ciudad", p."plataforma", p."nivel", p."step",
    p."nivelParalelo", p."stepParalelo", p."estadoInactivo", p."contrato", p."vigencia",
    p."finalContrato", p."fechaNacimiento", p."genero"`;

  if (includeAcademic) {
    selectQuery += `,
      (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" WHERE "idEstudiante" = p."_id" AND "asistio" = true) as total_asistencias,
      (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" WHERE "idEstudiante" = p."_id") as total_clases`;
  }

  selectQuery += ` FROM "PEOPLE" p ${whereClause} ORDER BY p."primerNombre", p."primerApellido"`;

  const result = await query(selectQuery, values);

  const headers = ['ID','Numero Documento','Primer Nombre','Segundo Nombre','Primer Apellido','Segundo Apellido',
    'Email','Celular','Ciudad','Plataforma','Nivel','Step','Nivel Paralelo','Step Paralelo',
    'Estado Inactivo','Contrato','Vigencia (dias)','Final Contrato','Fecha Nacimiento','Genero'];
  if (includeAcademic) headers.push('Total Asistencias', 'Total Clases');

  const csvRows = [headers.join(',')];

  for (const row of result.rows) {
    const csvRow: any[] = [
      row._id, row.numeroId || '',
      `"${(row.primerNombre || '').replace(/"/g, '""')}"`, `"${(row.segundoNombre || '').replace(/"/g, '""')}"`,
      `"${(row.primerApellido || '').replace(/"/g, '""')}"`, `"${(row.segundoApellido || '').replace(/"/g, '""')}"`,
      row.email || '', row.celular || '', row.ciudad || '', row.plataforma || '',
      row.nivel || '', row.step || '', row.nivelParalelo || '', row.stepParalelo || '',
      row.estadoInactivo ? 'Si' : 'No', row.contrato || '', row.vigencia || '',
      row.finalContrato ? new Date(row.finalContrato).toISOString().split('T')[0] : '',
      row.fechaNacimiento ? new Date(row.fechaNacimiento).toISOString().split('T')[0] : '',
      row.genero || '',
    ];
    if (includeAcademic) csvRow.push(String(row.total_asistencias || 0), String(row.total_clases || 0));
    csvRows.push(csvRow.join(','));
  }

  return new NextResponse(csvRows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="students_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
});
