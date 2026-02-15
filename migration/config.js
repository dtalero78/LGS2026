/**
 * Migration Configuration
 * Centralized settings for Wix to PostgreSQL migration
 */

require('dotenv').config();

module.exports = {
  // PostgreSQL connection settings
  // Supports DATABASE_URL (strips sslmode to avoid conflicts) or individual POSTGRES_* vars
  postgres: process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    ssl: { rejectUnauthorized: false },
  } : {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'lgs_admin',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },

  // Wix API settings
  wix: {
    baseUrl: process.env.WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions',
    timeout: 120000, // 2 minutes timeout for Wix requests
  },

  // Migration batch settings
  batching: {
    // Batch sizes per collection (adjust based on data size)
    NIVELES: 100, // Small catalog table
    ROL_PERMISOS: 50, // Very small (9 roles)
    USUARIOS_ROLES: 100, // Small (50-100 users)
    PEOPLE: 100, // Large table, moderate batch size
    ACADEMICA: 200, // Large table, moderate batch size
    CALENDARIO: 200, // Medium table
    ACADEMICA_BOOKINGS: 200, // Very large table
    FINANCIEROS: 100, // Medium table
    NIVELES_MATERIAL: 100, // Small table
    CLUBS: 100, // Very small table
    COMMENTS: 100, // Medium table
    STEP_OVERRIDES: 100, // Medium table
  },

  // Rate limiting (pause between batches in milliseconds)
  rateLimit: {
    NIVELES: 1000, // 1 second
    ROL_PERMISOS: 1000,
    USUARIOS_ROLES: 1000,
    PEOPLE: 2000, // 2 seconds (larger table)
    ACADEMICA: 2000,
    CALENDARIO: 2000,
    ACADEMICA_BOOKINGS: 2000, // Largest table, more cautious
    FINANCIEROS: 1500,
    NIVELES_MATERIAL: 1000,
    CLUBS: 1000,
    COMMENTS: 1500,
    STEP_OVERRIDES: 1500,
  },

  // Retry settings
  retry: {
    maxAttempts: 5, // Maximum number of retries per batch
    initialDelay: 1000, // Initial delay in ms
    maxDelay: 60000, // Maximum delay in ms (1 minute)
    backoffMultiplier: 2, // Exponential backoff multiplier
  },

  // Logging settings
  logging: {
    level: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
    logToFile: process.env.LOG_TO_FILE === 'true',
    logFilePath: process.env.LOG_FILE_PATH || './migration/logs/migration.log',
  },

  // Validation settings
  validation: {
    enablePreInsertValidation: true, // Validate data before inserting
    enablePostMigrationChecks: true, // Run integrity checks after migration
    sampleSize: 10, // Number of random records to spot-check
  },

  // Migration order (dependency-based)
  // Collections are migrated in this exact order
  migrationOrder: [
    'NIVELES', // No dependencies
    'ROL_PERMISOS', // No dependencies
    'USUARIOS_ROLES', // Depends on ROL_PERMISOS (logical, not enforced FK)
    'CLUBS', // No dependencies
    'PEOPLE', // No dependencies
    'ACADEMICA', // Depends on PEOPLE
    'CALENDARIO', // No dependencies
    'ACADEMICA_BOOKINGS', // Depends on PEOPLE, CALENDARIO
    'FINANCIEROS', // Depends on PEOPLE (logical)
    'NIVELES_MATERIAL', // Depends on NIVELES (logical)
    'COMMENTS', // Depends on PEOPLE (logical)
    'STEP_OVERRIDES', // Depends on PEOPLE, ACADEMICA
  ],

  // Wix API endpoints for each collection
  wixEndpoints: {
    NIVELES: '/exportarNiveles',
    ROL_PERMISOS: '/exportarRolPermisos',
    USUARIOS_ROLES: '/exportarUsuariosRoles',
    PEOPLE: '/exportarPeople',
    ACADEMICA: '/exportarAcademica',
    CALENDARIO: '/exportarCalendario',
    ACADEMICA_BOOKINGS: '/exportarBooking',
    FINANCIEROS: '/exportarContratos', // Note: Wix calls it "Contratos"
    CLUBS: '/exportarClubs', // May need to be added to Wix
    NIVELES_MATERIAL: '/exportarMaterial', // May need to be added to Wix
    COMMENTS: '/exportarComments', // May need to be added to Wix
    STEP_OVERRIDES: '/exportarOverrides', // May need to be added to Wix
    METADATA: '/exportarMetadata', // Get total counts
  },

  // PostgreSQL table names (with quotes)
  pgTables: {
    NIVELES: '"NIVELES"',
    ROL_PERMISOS: '"ROL_PERMISOS"',
    USUARIOS_ROLES: '"USUARIOS_ROLES"',
    PEOPLE: '"PEOPLE"',
    ACADEMICA: '"ACADEMICA"',
    CALENDARIO: '"CALENDARIO"',
    ACADEMICA_BOOKINGS: '"ACADEMICA_BOOKINGS"',
    FINANCIEROS: '"FINANCIEROS"',
    NIVELES_MATERIAL: '"NIVELES_MATERIAL"',
    CLUBS: '"CLUBS"',
    COMMENTS: '"COMMENTS"',
    STEP_OVERRIDES: '"STEP_OVERRIDES"',
  },

  // JSONB fields per table (for parsing/stringifying)
  jsonbFields: {
    NIVELES: ['material', 'clubs', 'steps', 'materiales', 'materialUsuario'],
    ROL_PERMISOS: ['permisos'],
    USUARIOS_ROLES: [],
    PEOPLE: ['onHoldHistory', 'extensionHistory'],
    ACADEMICA: ['extensionHistory', 'onHoldHistory'],
    CALENDARIO: [],
    ACADEMICA_BOOKINGS: [],
    FINANCIEROS: ['documentacion'],
    NIVELES_MATERIAL: [],
    CLUBS: [],
    COMMENTS: [],
    STEP_OVERRIDES: [],
  },

  // Primary key field (always _id for Wix collections)
  primaryKey: '_id',

  // Field to track data origin
  originField: 'origen',
  originValue: 'WIX',
};
