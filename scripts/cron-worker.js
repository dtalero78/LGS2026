#!/usr/bin/env node

/**
 * Cron Worker para Digital Ocean App Platform
 *
 * Este script ejecuta tareas programadas usando node-cron.
 * Se despliega como un Worker separado en Digital Ocean.
 *
 * Tareas programadas:
 * - reactivate-onhold: Diariamente a las 10:00 PM Colombia (03:00 UTC)
 * - expire-contracts: Diariamente a las 11:00 PM Colombia (04:00 UTC)
 */

const cron = require('node-cron');

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'https://lgs-plataforma.com';
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Obtiene timestamp en zona horaria local del sistema
 */
function getLocalTimestamp() {
  return new Date().toLocaleString();
}

if (!CRON_SECRET) {
  console.error('CRON_SECRET no esta configurado');
  process.exit(1);
}

console.log('Cron Worker iniciado');
console.log(`URL base: ${NEXTAUTH_URL}`);

/**
 * Ejecuta el cron de reactivacion de OnHold
 */
async function executeReactivateOnHold() {
  const timestamp = getLocalTimestamp();
  console.log(`\n[${timestamp}] Ejecutando reactivate-onhold...`);

  try {
    const response = await fetch(`${NEXTAUTH_URL}/api/cron/reactivate-onhold`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log(`[${timestamp}] Completado: ${data.message}`);
      console.log(`   Procesados: ${data.processed}, Exitosos: ${data.successful}, Fallidos: ${data.failed}`);
    } else {
      console.error(`[${timestamp}] Error: ${data.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`[${timestamp}] Error de conexion:`, error.message);
  }
}

/**
 * Ejecuta el cron de expiracion de contratos
 */
async function executeExpireContracts() {
  const timestamp = getLocalTimestamp();
  console.log(`\n[${timestamp}] Ejecutando expire-contracts...`);

  try {
    const response = await fetch(`${NEXTAUTH_URL}/api/cron/expire-contracts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log(`[${timestamp}] Completado: ${data.message}`);
      console.log(`   Procesados: ${data.processed}, Exitosos: ${data.successful}, Fallidos: ${data.failed}`);
    } else {
      console.error(`[${timestamp}] Error: ${data.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`[${timestamp}] Error de conexion:`, error.message);
  }
}

// Programar tareas
// ================

// Reactivar OnHold: Diariamente a las 03:00 UTC (10:00 PM Colombia)
cron.schedule('0 3 * * *', executeReactivateOnHold, {
  scheduled: true,
  timezone: 'UTC'
});

// Expirar contratos: Diariamente a las 04:00 UTC (11:00 PM Colombia)
cron.schedule('0 4 * * *', executeExpireContracts, {
  scheduled: true,
  timezone: 'UTC'
});

console.log('Tareas programadas:');
console.log('   - reactivate-onhold: Diariamente a las 03:00 UTC (10:00 PM Colombia)');
console.log('   - expire-contracts: Diariamente a las 04:00 UTC (11:00 PM Colombia)');

// Ejecutar inmediatamente si se pasa el argumento --run-now
if (process.argv.includes('--run-now')) {
  console.log('\nEjecutando inmediatamente (--run-now)...');
  executeReactivateOnHold();
  executeExpireContracts();
}

// Ejecutar solo expire-contracts si se pasa --expire-contracts
if (process.argv.includes('--expire-contracts')) {
  console.log('\nEjecutando expire-contracts...');
  executeExpireContracts();
}

// Ejecutar solo reactivate-onhold si se pasa --reactivate-onhold
if (process.argv.includes('--reactivate-onhold')) {
  console.log('\nEjecutando reactivate-onhold...');
  executeReactivateOnHold();
}

// Mantener el proceso vivo
console.log('\nWorker en ejecucion. Presiona Ctrl+C para detener.\n');
