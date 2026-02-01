/**
 * Test script to verify CALENDARIO date conversion fix
 * Tests that 'dia' field is converted correctly from Wix to PostgreSQL
 */

const CalendarioExporter = require('./exporters/06-calendario');

async function testDateConversion() {
  console.log('🧪 Testing CALENDARIO date conversion fix\n');
  console.log('='.repeat(60));

  const exporter = new CalendarioExporter();

  // Sample Wix record (the WELCOME event from Jan 17)
  const wixRecord = {
    _id: 'b39aa357-a9dc-4acf-bfa4-501a5a768abd',
    nombreEvento: 'WELCOME',
    tituloONivel: 'WELCOME',
    evento: 'SESSION',
    dia: '2026-01-17T16:00:00.000Z', // 16:00 UTC = 11:00 Colombia
    _createdDate: '2026-01-07T15:38:25.577Z',
    _updatedDate: '2026-01-07T15:38:25.577Z',
  };

  console.log('\n📥 INPUT (from Wix):');
  console.log('  dia:', wixRecord.dia);
  console.log('  Expected hora Colombia: 11:00');
  console.log('  Expected hora UTC: 16:00');

  // Transform the record
  const transformed = exporter.transformRecord(wixRecord);

  console.log('\n📤 OUTPUT (after transform):');
  console.log('  dia:', transformed.dia);

  // Verify the conversion
  const diaDate = new Date(transformed.dia);
  const horaUTC = diaDate.getUTCHours();
  const horaColombia = diaDate.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  console.log('\n✅ VERIFICATION:');
  console.log('  Hora UTC:', horaUTC + ':00');
  console.log('  Hora Colombia:', horaColombia);

  const isCorrect =
    transformed.dia === '2026-01-17T16:00:00.000Z' && horaUTC === 16;

  console.log('\n' + '='.repeat(60));
  if (isCorrect) {
    console.log('✅ TEST PASSED: Date conversion is correct!');
    console.log('   Wix UTC (16:00) → PostgreSQL UTC (16:00) ✅');
    console.log('   Display Colombia (11:00) ✅');
  } else {
    console.log('❌ TEST FAILED: Date conversion is incorrect!');
    console.log('   Expected: 2026-01-17T16:00:00.000Z');
    console.log('   Got:     ', transformed.dia);
  }
  console.log('='.repeat(60));

  process.exit(isCorrect ? 0 : 1);
}

testDateConversion();
