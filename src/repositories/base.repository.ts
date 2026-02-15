/**
 * Base Repository
 *
 * Common query patterns shared across all entity repositories.
 * Each subclass sets its own table name and JSONB fields.
 */

import 'server-only';
import { query, queryOne, queryMany, parseJsonbFields } from '@/lib/postgres';
import { NotFoundError } from '@/lib/errors';

export abstract class BaseRepository<T extends Record<string, any> = any> {
  constructor(
    protected readonly table: string,
    protected readonly jsonbFields: string[] = []
  ) {}

  protected parse(row: T | null): T | null {
    if (!row || this.jsonbFields.length === 0) return row;
    return parseJsonbFields(row, this.jsonbFields) as T | null;
  }

  protected parseMany(rows: T[]): T[] {
    if (this.jsonbFields.length === 0) return rows;
    return rows.map((r) => parseJsonbFields(r, this.jsonbFields) as T);
  }

  async findById(id: string): Promise<T | null> {
    const row = await queryOne<T>(
      `SELECT * FROM "${this.table}" WHERE "_id" = $1`,
      [id]
    );
    return this.parse(row);
  }

  async findByIdOrThrow(id: string, label?: string): Promise<T> {
    const row = await this.findById(id);
    if (!row) throw new NotFoundError(label ?? this.table, id);
    return row;
  }

  async findMany(
    whereClause: string = '',
    params: any[] = [],
    orderBy: string = '',
    limit?: number
  ): Promise<T[]> {
    const parts = [`SELECT * FROM "${this.table}"`];
    if (whereClause) parts.push(whereClause);
    if (orderBy) parts.push(`ORDER BY ${orderBy}`);
    if (limit) parts.push(`LIMIT ${limit}`);

    const rows = await queryMany<T>(parts.join(' '), params);
    return this.parseMany(rows);
  }

  async count(whereClause: string = '', params: any[] = []): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM "${this.table}" ${whereClause}`;
    const row = await queryOne<{ count: string }>(sql, params);
    return parseInt(row?.count ?? '0', 10);
  }

  async exists(whereClause: string, params: any[]): Promise<boolean> {
    const sql = `SELECT 1 FROM "${this.table}" ${whereClause} LIMIT 1`;
    const row = await queryOne(sql, params);
    return row !== null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM "${this.table}" WHERE "_id" = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Run a raw SELECT and parse JSONB fields.
   * Use for JOINs or complex queries that don't fit findMany.
   */
  protected async rawQuery(sql: string, params: any[] = []): Promise<T[]> {
    const rows = await queryMany<T>(sql, params);
    return this.parseMany(rows);
  }

  protected async rawQueryOne(sql: string, params: any[] = []): Promise<T | null> {
    const row = await queryOne<T>(sql, params);
    return this.parse(row);
  }
}
