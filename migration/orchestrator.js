/**
 * Migration Orchestrator
 * Executes all collection migrations in dependency order
 *
 * Usage:
 *   node migration/orchestrator.js                    # Full migration
 *   node migration/orchestrator.js --dry-run          # Simulate without DB writes
 *   node migration/orchestrator.js --only=PEOPLE      # Migrate only PEOPLE
 *   node migration/orchestrator.js --skip=NIVELES     # Skip NIVELES
 */

require('dotenv').config();
const { Pool } = require('pg');
const config = require('./config');

// Import all exporters
const NivelesExporter = require('./exporters/01-niveles');
const RolPermisosExporter = require('./exporters/02-rol-permisos');
const UsuariosRolesExporter = require('./exporters/03-usuarios-roles');
const PeopleExporter = require('./exporters/04-people');
const AcademicaExporter = require('./exporters/05-academica');
const CalendarioExporter = require('./exporters/06-calendario');
const AcademicaBookingsExporter = require('./exporters/07-academica-bookings');
const FinancierosExporter = require('./exporters/08-financieros');
const NivelesMaterialExporter = require('./exporters/09-niveles-material');
const ClubsExporter = require('./exporters/10-clubs');
const CommentsExporter = require('./exporters/11-comments');
const StepOverridesExporter = require('./exporters/12-step-overrides');

// Map collection names to exporter classes
const EXPORTERS = {
  NIVELES: NivelesExporter,
  ROL_PERMISOS: RolPermisosExporter,
  USUARIOS_ROLES: UsuariosRolesExporter,
  CLUBS: ClubsExporter,
  PEOPLE: PeopleExporter,
  ACADEMICA: AcademicaExporter,
  CALENDARIO: CalendarioExporter,
  ACADEMICA_BOOKINGS: AcademicaBookingsExporter,
  FINANCIEROS: FinancierosExporter,
  NIVELES_MATERIAL: NivelesMaterialExporter,
  COMMENTS: CommentsExporter,
  STEP_OVERRIDES: StepOverridesExporter,
};

class MigrationOrchestrator {
  constructor(pool, options = {}) {
    this.pool = pool;
    this.dryRun = options.dryRun || false;
    this.onlyCollection = options.onlyCollection || null;
    this.skipCollection = options.skipCollection || null;
    this.results = [];
    this.startTime = null;
  }

  /**
   * Get list of collections to migrate based on options
   */
  getCollectionsToMigrate() {
    let collections = config.migrationOrder;

    // Filter if --only specified
    if (this.onlyCollection) {
      if (!collections.includes(this.onlyCollection)) {
        throw new Error(`Collection "${this.onlyCollection}" not found in migration order`);
      }
      collections = [this.onlyCollection];
    }

    // Filter if --skip specified
    if (this.skipCollection) {
      collections = collections.filter(c => c !== this.skipCollection);
    }

    return collections;
  }

  /**
   * Execute migration for a single collection
   */
  async migrateCollection(collectionName) {
    const ExporterClass = EXPORTERS[collectionName];

    if (!ExporterClass) {
      console.error(`❌ Exporter not found for collection: ${collectionName}`);
      return {
        collectionName,
        success: false,
        error: 'Exporter not found',
      };
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 Migrating ${collectionName}`);
    console.log(`${'='.repeat(70)}\n`);

    try {
      const exporter = new ExporterClass();
      const result = await exporter.export(this.pool, { dryRun: this.dryRun });

      return {
        ...result,
        success: result.totalFailed === 0,
      };
    } catch (error) {
      console.error(`❌ Migration failed for ${collectionName}:`, error.message);
      return {
        collectionName,
        success: false,
        error: error.message,
        totalProcessed: 0,
        totalInserted: 0,
        totalUpdated: 0,
        totalFailed: 0,
      };
    }
  }

  /**
   * Execute all migrations in order
   */
  async run() {
    this.startTime = Date.now();

    console.log('\n' + '='.repeat(70));
    console.log('🌟 MIGRATION ORCHESTRATOR');
    console.log('='.repeat(70));
    console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    console.log(`Database: ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`);
    console.log('='.repeat(70) + '\n');

    // Test connection
    try {
      console.log('🔌 Testing PostgreSQL connection...');
      await this.pool.query('SELECT version()');
      console.log('✅ PostgreSQL connected\n');
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error.message);
      process.exit(1);
    }

    // Get collections to migrate
    const collections = this.getCollectionsToMigrate();
    console.log(`📋 Collections to migrate (${collections.length}):`);
    collections.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col}`);
    });
    console.log('');

    // Migrate each collection
    for (const collectionName of collections) {
      const result = await this.migrateCollection(collectionName);
      this.results.push(result);

      // Stop on failure unless in dry-run
      if (!result.success && !this.dryRun) {
        console.error(`\n❌ Migration stopped due to failure in ${collectionName}`);
        break;
      }
    }

    // Print final summary
    this.printSummary();
  }

  /**
   * Print final migration summary
   */
  printSummary() {
    const duration = Date.now() - this.startTime;
    const totalProcessed = this.results.reduce((sum, r) => sum + r.totalProcessed, 0);
    const totalInserted = this.results.reduce((sum, r) => sum + r.totalInserted, 0);
    const totalUpdated = this.results.reduce((sum, r) => sum + r.totalUpdated, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.totalFailed, 0);
    const successCount = this.results.filter(r => r.success).length;

    console.log('\n' + '='.repeat(70));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Collections: ${successCount}/${this.results.length} successful`);
    console.log('');
    console.log('Per-collection results:');

    this.results.forEach((result, i) => {
      const status = result.success ? '✅' : '❌';
      const rate = result.duration ? (result.totalProcessed / (result.duration / 1000)).toFixed(2) : '0.00';
      console.log(`  ${i + 1}. ${status} ${result.collectionName}`);
      console.log(`     Processed: ${result.totalProcessed} | Inserted: ${result.totalInserted} | Updated: ${result.totalUpdated} | Failed: ${result.totalFailed}`);
      console.log(`     Rate: ${rate} records/sec | Duration: ${(result.duration / 1000).toFixed(2)}s`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });

    console.log('');
    console.log('Overall totals:');
    console.log(`  Records processed: ${totalProcessed}`);
    console.log(`  Inserted: ${totalInserted}`);
    console.log(`  Updated: ${totalUpdated}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log(`  Average rate: ${totalProcessed > 0 ? (totalProcessed / (duration / 1000)).toFixed(2) : '0.00'} records/sec`);
    console.log('='.repeat(70));

    if (totalFailed > 0) {
      console.log('\n⚠️  Warning: Some records failed. Check logs above for details.');
    }

    if (this.dryRun) {
      console.log('\nℹ️  This was a DRY RUN - no data was written to PostgreSQL');
    } else if (successCount === this.results.length && totalFailed === 0) {
      console.log('\n🎉 SUCCESS: All migrations completed without errors!');
    } else {
      console.log('\n❌ PARTIAL FAILURE: Some migrations had errors.');
    }

    console.log('');
  }
}

// Main execution
async function main() {
  const pool = new Pool(config.postgres);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    onlyCollection: args.find(arg => arg.startsWith('--only='))?.split('=')[1],
    skipCollection: args.find(arg => arg.startsWith('--skip='))?.split('=')[1],
  };

  const orchestrator = new MigrationOrchestrator(pool, options);

  try {
    await orchestrator.run();

    // Exit with error code if there were failures
    const hasFailures = orchestrator.results.some(r => !r.success);
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('🔌 PostgreSQL connection closed\n');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MigrationOrchestrator;
