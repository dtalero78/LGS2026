/**
 * NivelesMaterial Collection Exporter
 * Exports course materials from Wix to PostgreSQL
 *
 * Expected records: ~100-200
 * Priority: BAJA (catalog)
 */

const fetch = require('node-fetch');
const { Pool } = require('pg');
const config = require('../config');

class NivelesMaterialExporter {
  constructor() {
    this.collectionName = 'NIVELES_MATERIAL';
    this.wixEndpoint = `${config.wix.baseUrl}${config.wixEndpoints.NIVELES_MATERIAL}`;
    this.pgTable = config.pgTables.NIVELES_MATERIAL;
    this.batchSize = config.batching.NIVELES_MATERIAL;
    this.rateLimit = config.rateLimit.NIVELES_MATERIAL;
    this.jsonbFields = config.jsonbFields.NIVELES_MATERIAL;
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

    // Ensure dates are properly formatted
    if (record._createdDate) {
      record._createdDate = new Date(record._createdDate).toISOString();
    } else {
      record._createdDate = new Date().toISOString();
    }

    if (record._updatedDate) {
      record._updatedDate = new Date(record._updatedDate).toISOString();
    } else {
      record._updatedDate = new Date().toISOString();
    }

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

      // Fetch batch from Wix
      let batch;
      try {
        batch = await this.fetchFromWix(skip, this.batchSize);
      } catch (error) {
        console.error(`❌ Failed to fetch batch at skip=${skip}:`, error.message);
        totalFailed += this.batchSize;

        // Retry logic could go here
        break;
      }

      if (!batch || batch.length === 0) {
        console.log('✅ No more records to fetch');
        hasMore = false;
        break;
      }

      // Process each record in the batch
      for (const record of batch) {
        try {
          if (!dryRun) {
            const result = await this.upsertRecord(pool, record);
            if (result.rowCount === 1) {
              totalInserted++;
            } else {
              totalUpdated++;
            }
          }
          totalProcessed++;

          // Log progress every 10 records
          if (totalProcessed % 10 === 0) {
            console.log(`📊 Progress: ${totalProcessed} records processed`);
          }
        } catch (error) {
          console.error(`❌ Failed to process record:`, {
            _id: record._id,
            nivel: record.nivel,
            error: error.message,
          });
          totalFailed++;
        }
      }

      // Update skip for next batch
      skip += batch.length;

      // Check if we got fewer records than batch size (end of data)
      if (batch.length < this.batchSize) {
        console.log('✅ Fetched last batch (incomplete batch size)');
        hasMore = false;
      }

      // Rate limiting - pause between batches
      if (hasMore) {
        console.log(`⏸️  Pausing ${this.rateLimit}ms before next batch...`);
        await this.sleep(this.rateLimit);
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
      const exporter = new NivelesMaterialExporter();
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

module.exports = NivelesMaterialExporter;
