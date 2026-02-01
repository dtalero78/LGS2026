import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/contracts/search
 *
 * Search for contracts by pattern (checks PEOPLE.contrato field)
 *
 * Query params:
 * - pattern: string - Pattern to search for (e.g., "LGS-2025-" finds "LGS-2025-001", "LGS-2025-002", etc.)
 * - exact: boolean (default: false) - If true, searches for exact match; otherwise uses LIKE pattern
 *
 * Returns all PEOPLE records matching the contract pattern (both TITULAR and BENEFICIARIO)
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
    const pattern = searchParams.get('pattern');
    const exact = searchParams.get('exact') === 'true';

    if (!pattern) {
      return NextResponse.json(
        { error: 'pattern query parameter is required' },
        { status: 400 }
      );
    }

    let queryText: string;
    let queryParams: any[];

    if (exact) {
      // Exact match
      queryText = `
        SELECT * FROM "PEOPLE"
        WHERE "contrato" = $1
        ORDER BY "tipoUsuario" DESC, "primerApellido", "primerNombre"
      `;
      queryParams = [pattern];
    } else {
      // Pattern match with LIKE
      queryText = `
        SELECT * FROM "PEOPLE"
        WHERE "contrato" LIKE $1
        ORDER BY "tipoUsuario" DESC, "primerApellido", "primerNombre"
      `;
      queryParams = [`${pattern}%`];
    }

    const result = await query(queryText, queryParams);

    // Group results by contract number
    const byContract: { [key: string]: any } = {};

    result.rows.forEach((person) => {
      const contrato = person.contrato;
      if (!contrato) return;

      if (!byContract[contrato]) {
        byContract[contrato] = {
          contrato,
          titular: null,
          beneficiarios: [],
        };
      }

      if (person.tipoUsuario === 'TITULAR') {
        byContract[contrato].titular = person;
      } else if (person.tipoUsuario === 'BENEFICIARIO') {
        byContract[contrato].beneficiarios.push(person);
      }
    });

    const contracts = Object.values(byContract);

    return NextResponse.json({
      success: true,
      pattern,
      exact,
      contracts,
      totalContracts: contracts.length,
      totalPeople: result.rowCount || 0,
    });
  } catch (error: any) {
    console.error('❌ Error searching contracts:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
