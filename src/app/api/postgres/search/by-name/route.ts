import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/postgres';

/**
 * GET /api/postgres/search/by-name?query=juan
 * Search students by name (first/last name partial match)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query || query.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query must be at least 2 characters',
        },
        { status: 400 }
      );
    }

    const results = await queryMany(
      `SELECT
        "_id",
        "numeroId",
        "primerNombre",
        "segundoNombre",
        "primerApellido",
        "segundoApellido",
        "tipoUsuario",
        "email",
        "contrato",
        "nivel",
        "step",
        "nivelParalelo",
        "stepParalelo",
        "estadoInactivo",
        "vigencia",
        "finalContrato",
        "_createdDate"
       FROM "PEOPLE"
       WHERE
         (LOWER("primerNombre") LIKE LOWER($1) OR
          LOWER("segundoNombre") LIKE LOWER($1) OR
          LOWER("primerApellido") LIKE LOWER($1) OR
          LOWER("segundoApellido") LIKE LOWER($1))
       ORDER BY "primerNombre", "primerApellido"
       LIMIT 100`,
      [`%${query}%`]
    );

    return NextResponse.json({
      success: true,
      items: results,
      total: results.length,
    });
  } catch (error: any) {
    console.error('❌ Error searching by name:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
