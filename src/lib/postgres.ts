/**
 * PostgreSQL Database Client
 * Connection pooling and query utilities for LGS Admin Panel
 *
 * IMPORTANT: All PostgreSQL table/column names use camelCase with double quotes
 * Example: SELECT "primerNombre" FROM "PEOPLE" WHERE "numeroId" = $1
 *
 * SERVER-ONLY: This module must only be imported in server-side code
 */

import 'server-only';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Connection pool configuration
// Supports both DATABASE_URL (Digital Ocean) and individual POSTGRES_* variables
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'lgs_admin',
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

// Log which connection method is being used
console.log(`🔌 PostgreSQL using ${process.env.DATABASE_URL ? 'DATABASE_URL' : 'individual POSTGRES_* variables'}`);

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err);
  process.exit(-1);
});

// Log successful connection
pool.on('connect', () => {
  console.log('✅ PostgreSQL client connected');
});

/**
 * Execute a SQL query with optional parameters
 * @param text SQL query string (use $1, $2, etc. for parameters)
 * @param params Array of parameter values
 * @returns Query result
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 1 second)
    if (duration > 1000) {
      console.warn(`⚠️ Slow query (${duration}ms):`, {
        query: text.substring(0, 100) + '...',
        rows: result.rowCount,
      });
    } else {
      console.log(`✅ Query executed in ${duration}ms (${result.rowCount} rows)`);
    }

    return result;
  } catch (error: any) {
    console.error('❌ PostgreSQL query error:', {
      query: text.substring(0, 100) + '...',
      error: error.message,
      params,
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * Remember to call client.release() when done
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Execute multiple queries in a transaction
 * Automatically handles BEGIN, COMMIT, and ROLLBACK
 *
 * @param callback Function that receives a client and executes queries
 * @returns Result of the callback function
 *
 * @example
 * await transaction(async (client) => {
 *   await client.query('INSERT INTO "PEOPLE" ...');
 *   await client.query('INSERT INTO "ACADEMICA" ...');
 *   return { success: true };
 * });
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🔄 Transaction started');

    const result = await callback(client);

    await client.query('COMMIT');
    console.log('✅ Transaction committed');

    return result;
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a query and return the first row
 * Returns null if no rows found
 */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Execute a query and return all rows
 */
export async function queryMany<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now, version() as version');
    console.log('✅ PostgreSQL connection successful:', {
      time: result.rows[0].now,
      version: result.rows[0].version.substring(0, 50) + '...',
    });
    return true;
  } catch (error: any) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
}

/**
 * Close all connections in the pool
 * Call this when shutting down the application
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('🔌 PostgreSQL pool closed');
}

/**
 * Helper: Build UPSERT query for migration scripts
 *
 * @param tableName Table name (with quotes: "PEOPLE")
 * @param data Object with column names as keys
 * @param conflictColumn Column to check for conflicts (usually "_id")
 * @returns { query, values } ready for pool.query()
 *
 * @example
 * const { query, values } = buildUpsert('"PEOPLE"', personData, '"_id"');
 * await pool.query(query, values);
 */
export function buildUpsert(
  tableName: string,
  data: Record<string, any>,
  conflictColumn: string = '"_id"'
): { query: string; values: any[] } {
  const columns = Object.keys(data);
  const values = Object.values(data);

  // Build column list: "col1", "col2", "col3"
  const columnList = columns.map(col => `"${col}"`).join(', ');

  // Build placeholders: $1, $2, $3
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  // Build update list: "col1" = EXCLUDED."col1", "col2" = EXCLUDED."col2"
  const updateList = columns
    .filter(col => col !== conflictColumn.replace(/"/g, '')) // Don't update conflict column
    .map(col => `"${col}" = EXCLUDED."${col}"`)
    .join(', ');

  const query = `
    INSERT INTO ${tableName} (${columnList})
    VALUES (${placeholders})
    ON CONFLICT (${conflictColumn}) DO UPDATE SET
      ${updateList}
  `;

  return { query, values };
}

/**
 * Helper: Parse JSONB fields from query results
 * PostgreSQL returns JSONB as strings, this parses them back to objects
 *
 * @param row Query result row
 * @param jsonbFields Array of field names that are JSONB
 * @returns Row with parsed JSONB fields
 *
 * @example
 * const student = await queryOne('SELECT * FROM "PEOPLE" WHERE "_id" = $1', [id]);
 * return parseJsonbFields(student, ['onHoldHistory', 'extensionHistory']);
 */
export function parseJsonbFields<T extends Record<string, any>>(
  row: T | null,
  jsonbFields: string[]
): T | null {
  if (!row) return null;

  const parsed = { ...row };

  for (const field of jsonbFields) {
    if (parsed[field] && typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch (error) {
        console.warn(`⚠️ Failed to parse JSONB field "${field}":`, error);
        parsed[field] = [];
      }
    }
  }

  return parsed;
}

/**
 * Helper: Stringify objects for JSONB insertion
 *
 * @param data Object with potential JSONB fields
 * @param jsonbFields Array of field names that should be JSONB
 * @returns Data with stringified JSONB fields
 *
 * @example
 * const data = stringifyJsonbFields(personData, ['onHoldHistory', 'extensionHistory']);
 */
export function stringifyJsonbFields<T extends Record<string, any>>(
  data: T,
  jsonbFields: string[]
): T {
  const stringified = { ...data };

  for (const field of jsonbFields) {
    if (stringified[field] && typeof stringified[field] === 'object') {
      stringified[field] = JSON.stringify(stringified[field]);
    }
  }

  return stringified;
}

// Export pool for direct access if needed
export default pool;
