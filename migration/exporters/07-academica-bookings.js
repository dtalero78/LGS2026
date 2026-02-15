/**
 * AcademicaBookings Collection Exporter
 * Exports event enrollments from Wix to PostgreSQL
 *
 * Expected records: ~50K+
 * Priority: ALTA (largest table)
 */

const fetch = require('node-fetch');
const { Pool } = require('pg');
const config = require('../config');

class AcademicaBookingsExporter {
  constructor() {
    this.collectionName = 'ACADEMICA_BOOKINGS';
    this.wixEndpoint = `${config.wix.baseUrl}${config.wixEndpoints.ACADEMICA_BOOKINGS}`;
    this.pgTable = config.pgTables.ACADEMICA_BOOKINGS;
    this.batchSize = config.batching.ACADEMICA_BOOKINGS;
    this.rateLimit = config.rateLimit.ACADEMICA_BOOKINGS;
    this.jsonbFields = config.jsonbFields.ACADEMICA_BOOKINGS;
  }

  /**
   * Fetch data from Wix with pagination
   */
  async fetchFromWix(skip, limit) {
    const url = `${this.wixEndpoint}?skip=${skip}&limit=${limit}`;

    console.log(`📡 Fetching ${this.collectionName} from Wix: skip=${skip}, limit=${limit}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: config.wix.timeout,
      });

      if (!response.ok) {
        throw new Error(`Wix API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(`Wix returned success: false - ${data.error || 'Unknown error'}`);
      }

      // Wix returns data in "data" field, not "items"
      const records = data.data || data.items || [];
      console.log(`✅ Fetched ${records.length} records from Wix`);

      return records;
    } catch (error) {
      console.error(`❌ Error fetching from Wix:`, error.message);
      throw error;
    }
  }

  /**
   * Transform Wix record to PostgreSQL format
   * Handles JSONB fields and ensures all required fields exist
   */
  transformRecord(wixRecord) {
    // Stringify JSONB fields
    const record = { ...wixRecord };

    for (const field of this.jsonbFields) {
      if (record[field] !== undefined && record[field] !== null) {
        if (typeof record[field] === 'object') {
          record[field] = JSON.stringify(record[field]);
        }
      } else {
        record[field] = '[]'; // Default empty array for JSONB
      }
    }

    // Add origen field
    record.origen = config.originValue;

    // Clean empty strings to NULL
    Object.keys(record).forEach(key => {
      if (record[key] === '') {
        record[key] = null;
      }
    });

    // Clean date fields with enhanced validator
    const cleanDate = (value) => {
      if (!value || value === '' || value === 'null') return null;
      try {
        const d = new Date(value);
        if (isNaN(d.getTime()) || d.getFullYear() < 1900 || d.getFullYear() > 2100) {
          return null;
        }
        return d.toISOString();
      } catch {
        return null;
      }
    };

    // Ensure dates are properly formatted
    record._createdDate = cleanDate(record._createdDate) || new Date().toISOString();
    record._updatedDate = cleanDate(record._updatedDate) || new Date().toISOString();
    record.fechaAgendamiento = cleanDate(record.fechaAgendamiento);
    record.fechaEvento = cleanDate(record.fechaEvento);
    record.fecha = cleanDate(record.fecha);

    return record;
  }

  /**
   * Build UPSERT query for PostgreSQL
   */
  buildUpsertQuery(record) {
    const columns = Object.keys(record);
    const values = Object.values(record);

    // Build column list with quotes: "col1", "col2", "col3"
    const columnList = columns.map(col => `"${col}"`).join(', ');

    // Build placeholders: $1, $2, $3
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    // Build update list: "col1" = EXCLUDED."col1", "col2" = EXCLUDED."col2"
    // Don't update _id (primary key)
    const updateList = columns
      .filter(col => col !== '_id')
      .map(col => `"${col}" = EXCLUDED."${col}"`)
      .join(', ');

    const query = `
      INSERT INTO ${this.pgTable} (${columnList})
      VALUES (${placeholders})
      ON CONFLICT ("_id") DO UPDATE SET
        ${updateList}
    `;

    return { query, values };
  }

  /**
   * Insert/Update a single record in PostgreSQL
   */
  async upsertRecord(pool, record) {
    const transformed = this.transformRecord(record);
    const { query, values } = this.buildUpsertQuery(transformed);

    try {
      const result = await pool.query(query, values);
      return { success: true, rowCount: result.rowCount };
    } catch (error) {
      console.error(`❌ Error upserting record ${record._id}:`, error.message);
      throw error;
    }
  }

  /**
   * Build multi-row UPSERT query for a batch of records
   */
  buildBatchUpsertQuery(transformedRecords) {
    const columnSet = new Set();
    for (const record of transformedRecords) {
      for (const key of Object.keys(record)) {
        columnSet.add(key);
      }
    }
    const columns = Array.from(columnSet);
    const columnList = columns.map(col => `"${col}"`).join(', ');

    const values = [];
    const valueRows = [];
    let paramIndex = 1;
    for (const record of transformedRecords) {
      const rowPlaceholders = [];
      for (const col of columns) {
        rowPlaceholders.push(`$${paramIndex++}`);
        values.push(record[col] !== undefined ? record[col] : null);
      }
      valueRows.push(`(${rowPlaceholders.join(', ')})`);
    }

    const updateList = columns
      .filter(col => col !== '_id')
      .map(col => `"${col}" = EXCLUDED."${col}"`)
      .join(', ');

    const query = `
      INSERT INTO ${this.pgTable} (${columnList})
      VALUES ${valueRows.join(', ')}
      ON CONFLICT ("_id") DO UPDATE SET
        ${updateList}
    `;

    return { query, values };
  }

  /**
   * Export all records from Wix to PostgreSQL
   */
  async export(pool, options = {}) {
    const { dryRun = false, maxRecords = null } = options;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Starting ${this.collectionName} export`);
    console.log(`   Dry run: ${dryRun ? 'YES' : 'NO'}`);
    console.log(`   Max records: ${maxRecords || 'UNLIMITED'}`);
    console.log(`${'='.repeat(60)}\n`);

    let skip = 0;
    let totalProcessed = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    let hasMore = true;

    const startTime = Date.now();

    while (hasMore) {
      // Check if we've reached max records
      if (maxRecords && totalProcessed >= maxRecords) {
        console.log(`⚠️  Reached max records limit (${maxRecords}), stopping...`);
        break;
      }

      // Fetch batch from Wix with retry
      let batch;
      let fetchAttempts = 0;
      const maxFetchAttempts = 5;
      while (fetchAttempts < maxFetchAttempts) {
        try {
          batch = await this.fetchFromWix(skip, this.batchSize);
          break;
        } catch (error) {
          fetchAttempts++;
          if (fetchAttempts >= maxFetchAttempts) {
            console.error(`❌ Failed to fetch at skip=${skip} after ${maxFetchAttempts} attempts:`, error.message);
            totalFailed += this.batchSize;
            hasMore = false;
            break;
          }
          const delay = Math.min(5000 * fetchAttempts, 30000);
          console.log(`⚠️ Fetch failed (attempt ${fetchAttempts}/${maxFetchAttempts}), retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
      if (!batch) break;

      if (!batch || batch.length === 0) {
        console.log('✅ No more records to fetch');
        hasMore = false;
        break;
      }

      // Batch UPSERT: transform all records and send as single query
      if (!dryRun) {
        if (!this.pgColumns) {
          const colResult = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${this.collectionName}'`);
          this.pgColumns = new Set(colResult.rows.map(r => r.column_name));
          console.log(`📋 PG columns loaded: ${this.pgColumns.size} columns`);
        }
        const transformedRecords = batch.map(record => {
          const transformed = this.transformRecord(record);
          const filtered = {};
          for (const [key, value] of Object.entries(transformed)) {
            if (this.pgColumns.has(key)) filtered[key] = value;
          }
          return filtered;
        });
        let retries = 0;
        const maxRetries = 3;
        while (retries <= maxRetries) {
          try {
            const { query, values } = this.buildBatchUpsertQuery(transformedRecords);
            await pool.query(query, values);
            totalInserted += batch.length;
            break;
          } catch (error) {
            retries++;
            if (retries > maxRetries) {
              console.error(`❌ Batch failed after ${maxRetries} retries:`, error.message);
              totalFailed += batch.length;
            } else {
              console.log(`⚠️ PG batch error (attempt ${retries}/${maxRetries}): ${error.message}`);
              await this.sleep(2000 * retries);
            }
          }
        }
      }
      totalProcessed += batch.length;
      console.log(`📊 Progress: ${totalProcessed} records processed`);

      // Update skip for next batch
      skip += batch.length;

      // Check if we got fewer records than batch size (end of data)
      if (batch.length < this.batchSize) {
        console.log('✅ Fetched last batch (incomplete batch size)');
        hasMore = false;
      }

      // Rate limiting - reduced pause between batches
      if (hasMore) {
        await this.sleep(200);
      }
    }

    const duration = Date.now() - startTime;
    const rate = totalProcessed > 0 ? (totalProcessed / (duration / 1000)).toFixed(2) : 0;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ ${this.collectionName} export completed`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Inserted: ${totalInserted}`);
    console.log(`   Updated: ${totalUpdated}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`   Rate: ${rate} records/sec`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      collectionName: this.collectionName,
      totalProcessed,
      totalInserted,
      totalUpdated,
      totalFailed,
      duration,
      rate,
    };
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI entry point for standalone execution
if (require.main === module) {
  (async () => {
    const pool = new Pool(config.postgres);

    try {
      // Test connection
      console.log('🔌 Testing PostgreSQL connection...');
      await pool.query('SELECT NOW()');
      console.log('✅ PostgreSQL connected\n');

      // Run export
      const exporter = new AcademicaBookingsExporter();
      const dryRun = process.argv.includes('--dry-run');
      const maxRecords = process.argv.find(arg => arg.startsWith('--max='))?.split('=')[1];

      const result = await exporter.export(pool, {
        dryRun,
        maxRecords: maxRecords ? parseInt(maxRecords) : null,
      });

      console.log('✅ Export completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Export failed:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  })();
}

module.exports = AcademicaBookingsExporter;
