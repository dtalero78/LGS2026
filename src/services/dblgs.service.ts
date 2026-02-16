/**
 * DBLGS Service - Business Logic Layer
 *
 * Validates table/column names against whitelists from information_schema,
 * builds dynamic filters, handles type coercion, and delegates to repository.
 */

import 'server-only';
import { DblgsRepository, ColumnMeta } from '@/repositories/dblgs.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';

// ── Types ──────────────────────────────────────────────────────────

export interface ReadOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, string>;
}

export interface PaginatedResult {
  table: string;
  rows: Record<string, any>[];
  columns: ColumnMeta[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SchemaResult {
  table: string;
  columns: ColumnMeta[];
  rowCount: number;
}

// ── Table whitelist cache ──────────────────────────────────────────

let validTablesCache: { tables: string[]; timestamp: number } = { tables: [], timestamp: 0 };
const TABLES_CACHE_TTL = 60_000; // 1 minute

// ── Service ────────────────────────────────────────────────────────

class DblgsServiceClass {

  // ── Validation helpers ─────────────────────────────────────────

  private async getValidTables(): Promise<string[]> {
    if (Date.now() - validTablesCache.timestamp < TABLES_CACHE_TTL && validTablesCache.tables.length > 0) {
      return validTablesCache.tables;
    }
    const tables = await DblgsRepository.listTables();
    validTablesCache = { tables, timestamp: Date.now() };
    return tables;
  }

  private async assertValidTable(name: string): Promise<void> {
    const valid = await this.getValidTables();
    if (!valid.includes(name)) {
      throw new ValidationError(`Tabla inválida: ${name}`);
    }
  }

  private assertValidColumn(columnName: string, schema: ColumnMeta[]): ColumnMeta {
    const col = schema.find(c => c.name === columnName);
    if (!col) {
      throw new ValidationError(`Columna inválida: ${columnName}`);
    }
    return col;
  }

  // ── Filter builder ─────────────────────────────────────────────

  private buildWhereClause(
    schema: ColumnMeta[],
    filters?: Record<string, string>,
    search?: string
  ): { whereClause: string; values: any[] } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    // Column-specific filters
    if (filters) {
      for (const [colName, filterVal] of Object.entries(filters)) {
        if (!filterVal || filterVal.trim() === '') continue;

        const col = schema.find(c => c.name === colName);
        if (!col) continue; // skip invalid columns silently in filters

        if (col.type === 'text') {
          conditions.push(`"${col.name}" ILIKE $${paramIdx}`);
          values.push(`%${filterVal}%`);
        } else if (col.type === 'boolean') {
          conditions.push(`"${col.name}" = $${paramIdx}`);
          values.push(filterVal.toLowerCase() === 'true');
        } else if (col.type === 'number') {
          conditions.push(`"${col.name}"::text ILIKE $${paramIdx}`);
          values.push(`%${filterVal}%`);
        } else {
          conditions.push(`"${col.name}"::text ILIKE $${paramIdx}`);
          values.push(`%${filterVal}%`);
        }
        paramIdx++;
      }
    }

    // Global search across text columns
    if (search && search.trim() !== '') {
      const textCols = schema.filter(c => c.type === 'text');
      if (textCols.length > 0) {
        const orParts = textCols.map(c => `"${c.name}" ILIKE $${paramIdx}`);
        conditions.push(`(${orParts.join(' OR ')})`);
        values.push(`%${search}%`);
        paramIdx++;
      }
    }

    return {
      whereClause: conditions.length > 0 ? conditions.join(' AND ') : '',
      values,
    };
  }

  // ── Type coercion ──────────────────────────────────────────────

  private coerceValue(value: any, col: ColumnMeta): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const strVal = String(value);

    switch (col.pgType) {
      case 'jsonb':
      case 'json': {
        if (typeof value === 'object') return JSON.stringify(value);
        try {
          JSON.parse(strVal); // validate
          return strVal;
        } catch {
          throw new ValidationError(`JSON inválido para columna "${col.name}"`);
        }
      }
      case 'bool': {
        return strVal.toLowerCase() === 'true';
      }
      case 'int2':
      case 'int4':
      case 'int8':
      case 'serial':
      case 'bigserial': {
        const n = parseInt(strVal, 10);
        if (isNaN(n)) throw new ValidationError(`Número inválido para columna "${col.name}"`);
        return n;
      }
      case 'float4':
      case 'float8':
      case 'numeric': {
        const f = parseFloat(strVal);
        if (isNaN(f)) throw new ValidationError(`Número inválido para columna "${col.name}"`);
        return f;
      }
      default:
        return value;
    }
  }

  // ── Public methods ─────────────────────────────────────────────

  async listTables(): Promise<string[]> {
    return this.getValidTables();
  }

  async getTableSchema(table: string): Promise<SchemaResult> {
    await this.assertValidTable(table);
    const [columns, rowCount] = await Promise.all([
      DblgsRepository.getTableSchema(table),
      DblgsRepository.getRowCount(table),
    ]);
    return { table, columns, rowCount };
  }

  async readRows(table: string, options: ReadOptions): Promise<PaginatedResult> {
    await this.assertValidTable(table);

    const schema = await DblgsRepository.getTableSchema(table);

    // Validate sortBy column
    const sortCol = options.sortBy && schema.find(c => c.name === options.sortBy)
      ? options.sortBy
      : (schema.find(c => c.isPrimaryKey)?.name || schema[0]?.name || '_id');

    const sortDir = options.sortDir === 'desc' ? 'DESC' : 'ASC';
    const page = Math.max(1, options.page);
    const pageSize = Math.min(Math.max(1, options.pageSize), 200);
    const offset = (page - 1) * pageSize;

    // Build filters
    const { whereClause, values } = this.buildWhereClause(schema, options.filters, options.search);

    // Execute queries in parallel
    const [rows, total] = await Promise.all([
      DblgsRepository.readRows(table, whereClause, values, sortCol, sortDir as 'ASC' | 'DESC', pageSize, offset),
      DblgsRepository.countFilteredRows(table, whereClause, values),
    ]);

    return {
      table,
      rows,
      columns: schema,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async insertRow(table: string, data: Record<string, any>): Promise<any> {
    await this.assertValidTable(table);

    const schema = await DblgsRepository.getTableSchema(table);
    const schemaColNames = new Set(schema.map(c => c.name));

    // Filter to valid columns only and coerce types
    const columns: string[] = [];
    const values: any[] = [];

    for (const [key, val] of Object.entries(data)) {
      if (!schemaColNames.has(key)) continue;
      // Skip auto-managed columns
      if (key === '_createdDate' || key === '_updatedDate') continue;

      const col = schema.find(c => c.name === key)!;
      columns.push(key);
      values.push(this.coerceValue(val, col));
    }

    // Auto-generate _id if missing and column exists
    if (schemaColNames.has('_id') && !columns.includes('_id')) {
      columns.push('_id');
      values.push(`dblgs_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
    }

    // Add timestamps if columns exist
    if (schemaColNames.has('_createdDate') && !columns.includes('_createdDate')) {
      columns.push('_createdDate');
      values.push(new Date().toISOString());
    }
    if (schemaColNames.has('_updatedDate') && !columns.includes('_updatedDate')) {
      columns.push('_updatedDate');
      values.push(new Date().toISOString());
    }

    if (columns.length === 0) {
      throw new ValidationError('No hay columnas válidas para insertar');
    }

    return DblgsRepository.insertRow(table, columns, values);
  }

  async updateCell(table: string, rowId: string, column: string, value: any): Promise<any> {
    await this.assertValidTable(table);

    const schema = await DblgsRepository.getTableSchema(table);
    const col = this.assertValidColumn(column, schema);
    const hasUpdatedDateCol = schema.some(c => c.name === '_updatedDate');

    const coerced = this.coerceValue(value, col);
    const result = await DblgsRepository.updateCell(table, rowId, column, coerced, hasUpdatedDateCol);

    if (!result) {
      throw new NotFoundError(table, rowId);
    }

    return result;
  }

  async deleteRows(table: string, ids: string[]): Promise<number> {
    await this.assertValidTable(table);

    if (ids.length === 0) {
      throw new ValidationError('No se proporcionaron IDs');
    }
    if (ids.length > 100) {
      throw new ValidationError('No se pueden eliminar más de 100 filas a la vez');
    }

    return DblgsRepository.deleteRows(table, ids);
  }
}

export const DblgsService = new DblgsServiceClass();
