// Migración idempotente: agrega CALENDARIO.eventoCompartidoId UUID + índice.
//
// Esta columna habilita la feature "Eventos compartidos" — un único evento
// operativo del advisor (Jumps y Clubs no-TRAINING) que se replica en 2-3
// filas distintas (una por nivel) para que estudiantes de varios niveles
// puedan agendarlo. Todas las filas del grupo comparten el mismo UUID en
// esta columna.
//
// Por defecto NULL → comportamiento actual sin cambios. Queries existentes
// (filtran por nivel, JOIN bookings, etc.) siguen funcionando idénticamente.
//
// Sin --apply muestra el estado actual (cuántas filas en CALENDARIO).
// Con --apply ejecuta ALTER + CREATE INDEX.
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const APPLY = process.argv.includes('--apply');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // Verifica si ya existe
    const exists = await pool.query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'CALENDARIO' AND column_name = 'eventoCompartidoId'
    `);
    if (exists.rowCount > 0) {
      console.log('✅ Columna eventoCompartidoId ya existe. No hago nada.');
      const groups = await pool.query(`
        SELECT COUNT(DISTINCT "eventoCompartidoId")::int AS grupos,
               COUNT(*)::int AS filas
          FROM "CALENDARIO" WHERE "eventoCompartidoId" IS NOT NULL
      `);
      console.log(`   Grupos compartidos existentes: ${groups.rows[0].grupos}`);
      console.log(`   Filas que pertenecen a un grupo: ${groups.rows[0].filas}`);
      return;
    }

    const total = await pool.query('SELECT COUNT(*)::int n FROM "CALENDARIO"');
    console.log(`Filas en CALENDARIO: ${total.rows[0].n}`);

    if (!APPLY) {
      console.log('\n🟡 DRY-RUN. Se ejecutará:');
      console.log('   ALTER TABLE "CALENDARIO" ADD COLUMN "eventoCompartidoId" UUID;');
      console.log('   CREATE INDEX idx_calendario_compartido ON "CALENDARIO"("eventoCompartidoId") WHERE "eventoCompartidoId" IS NOT NULL;');
      console.log('\n   Todas las filas existentes quedan con NULL → comportamiento idéntico al actual.');
      console.log('   Re-ejecutar con --apply para aplicar.');
      return;
    }

    console.log('\n🔴 Aplicando ALTER + INDEX...');
    await pool.query('ALTER TABLE "CALENDARIO" ADD COLUMN "eventoCompartidoId" UUID');
    console.log('   ✅ Columna agregada');
    await pool.query(`CREATE INDEX idx_calendario_compartido ON "CALENDARIO"("eventoCompartidoId") WHERE "eventoCompartidoId" IS NOT NULL`);
    console.log('   ✅ Índice creado');
    console.log('\n🎉 Migración completada. Verificación:');
    const verify = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name='CALENDARIO' AND column_name='eventoCompartidoId'
    `);
    console.log('  ', verify.rows[0]);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
