/**
 * Comments Repository
 *
 * All SQL for the COMENTARIOS table.
 */

import 'server-only';
import { queryOne, queryMany } from '@/lib/postgres';
import { BaseRepository } from './base.repository';

class CommentsRepositoryClass extends BaseRepository {
  constructor() {
    super('COMENTARIOS');
  }

  /**
   * Get comments for a person (by personId or numeroId) with pagination
   */
  async findByPersonId(personId: string, numeroId: string, limit: number = 50, offset: number = 0) {
    return queryMany(
      `SELECT "_id", "personId", "numeroId", "comentario", "tipo",
              "creadoPor", "creadoPorEmail", "creadoPorRol",
              "_createdDate", "_updatedDate"
       FROM "COMENTARIOS"
       WHERE "personId" = $1 OR "numeroId" = $2
       ORDER BY "_createdDate" DESC
       LIMIT $3 OFFSET $4`,
      [personId, numeroId, limit, offset]
    );
  }

  /**
   * Count total comments for a person
   */
  async countByPersonId(personId: string, numeroId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM "COMENTARIOS"
       WHERE "personId" = $1 OR "numeroId" = $2`,
      [personId, numeroId]
    );
    return parseInt(row?.count ?? '0', 10);
  }

  /**
   * Add a comment
   */
  async create(data: {
    _id: string;
    personId: string;
    numeroId: string;
    comentario: string;
    tipo: string;
    creadoPor: string;
    creadoPorEmail: string;
    creadoPorRol: string;
  }) {
    return queryOne(
      `INSERT INTO "COMENTARIOS" (
        "_id", "personId", "numeroId", "comentario", "tipo",
        "creadoPor", "creadoPorEmail", "creadoPorRol",
        "_createdDate", "_updatedDate"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        data._id, data.personId, data.numeroId, data.comentario, data.tipo,
        data.creadoPor, data.creadoPorEmail, data.creadoPorRol,
      ]
    );
  }
}

export const CommentsRepository = new CommentsRepositoryClass();
