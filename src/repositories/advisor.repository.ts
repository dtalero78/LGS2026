/**
 * Advisor Repository
 *
 * All SQL for the ADVISORS table.
 */

import 'server-only';
import { queryOne, queryMany } from '@/lib/postgres';
import { BaseRepository } from './base.repository';

const ADVISOR_COLUMNS = `
  "_id", "email", "primerNombre", "primerApellido", "nombreCompleto",
  "pais", "zoom", "activo", "_createdDate", "_updatedDate"
`;

class AdvisorRepositoryClass extends BaseRepository {
  constructor() {
    super('ADVISORS');
  }

  /**
   * Get all advisors, optionally including inactive ones
   */
  async findAll(includeInactive: boolean = false) {
    const whereClause = includeInactive
      ? ''
      : 'WHERE "activo" = true OR "activo" IS NULL';

    return queryMany(
      `SELECT ${ADVISOR_COLUMNS}
       FROM "ADVISORS"
       ${whereClause}
       ORDER BY "nombreCompleto" ASC NULLS LAST`
    );
  }

  /**
   * Find advisor by email
   */
  async findByEmail(email: string) {
    return queryOne(
      `SELECT ${ADVISOR_COLUMNS} FROM "ADVISORS" WHERE "email" = $1`,
      [email]
    );
  }

  /**
   * Find advisor by _id or email (for flexible lookups from booking data)
   */
  async findByIdOrEmail(idOrEmail: string) {
    return queryOne(
      `SELECT ${ADVISOR_COLUMNS} FROM "ADVISORS" WHERE "_id" = $1 OR "email" = $1`,
      [idOrEmail]
    );
  }

  /**
   * Get advisor name by ID (for display purposes)
   */
  async getNameById(id: string): Promise<string | null> {
    const row = await queryOne<{ nombreCompleto: string }>(
      `SELECT "nombreCompleto" FROM "ADVISORS" WHERE "_id" = $1`,
      [id]
    );
    return row?.nombreCompleto ?? null;
  }
}

export const AdvisorRepository = new AdvisorRepositoryClass();
