/**
 * Financial Repository
 *
 * All SQL for the FINANCIEROS table.
 */

import 'server-only';
import { queryOne } from '@/lib/postgres';
import { BaseRepository } from './base.repository';

class FinancialRepositoryClass extends BaseRepository {
  constructor() {
    super('FINANCIEROS');
  }

  /**
   * Get most recent financial record for a contract
   */
  async findByContrato(contrato: string) {
    return queryOne(
      `SELECT * FROM "FINANCIEROS"
       WHERE "contrato" = $1
       ORDER BY "_createdDate" DESC
       LIMIT 1`,
      [contrato]
    );
  }
}

export const FinancialRepository = new FinancialRepositoryClass();
