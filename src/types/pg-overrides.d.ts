/**
 * Override: `pg` declaration when @types/pg is not installed.
 *
 * The pg package includes its own types but TS resolves the ESM entry
 * (pg/esm/index.mjs) without picking them up. This shim provides minimal
 * types for the surface used in this codebase.
 */
declare module 'pg' {
  export interface QueryResultRow {
    [column: string]: any;
  }
  export interface QueryResult<R extends QueryResultRow = any> {
    rows: R[];
    rowCount: number | null;
    command: string;
    fields: any[];
    oid?: number;
  }
  export interface PoolClient {
    query: (text: string, params?: any[]) => Promise<QueryResult<any>>;
    release: () => void;
  }
  export interface PoolConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: any;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }
  export class Pool {
    constructor(config?: PoolConfig);
    query<R extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    on(event: 'error' | 'connect' | 'remove' | 'acquire', listener: (...args: any[]) => void): this;
  }
}
