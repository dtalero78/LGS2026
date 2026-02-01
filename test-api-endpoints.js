#!/usr/bin/env node

/**
 * Script de Testing Automatizado - Endpoints PostgreSQL
 * Ejecutar: node test-api-endpoints.js
 */

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3001';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  partial: 0,
  total: 0
};

/**
 * Helper: Make authenticated request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      ok: false,
      status: 500,
      error: error.message,
      duration
    };
  }
}

/**
 * Helper: Print test result
 */
function logTest(name, result, duration, notes = '') {
  results.total++;

  if (result === 'pass') {
    results.passed++;
    console.log(`${colors.green}✅ PASÓ${colors.reset} | ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
  } else if (result === 'fail') {
    results.failed++;
    console.log(`${colors.red}❌ FALLÓ${colors.reset} | ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
  } else {
    results.partial++;
    console.log(`${colors.yellow}⚠️  PARCIAL${colors.reset} | ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
  }

  if (notes) {
    console.log(`   ${colors.gray}→ ${notes}${colors.reset}`);
  }
}

/**
 * Helper: Print section header
 */
function logSection(title) {
  console.log('');
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
}

/**
 * Test: GET /api/postgres/niveles
 */
async function testGetNiveles() {
  const result = await apiRequest('/api/postgres/niveles');

  if (result.ok && result.data.success && result.data.niveles) {
    logTest(
      'GET /api/postgres/niveles',
      'pass',
      result.duration,
      `${result.data.niveles.length} niveles encontrados`
    );
  } else {
    logTest(
      'GET /api/postgres/niveles',
      'fail',
      result.duration,
      result.error || result.data.error
    );
  }
}

/**
 * Test: GET /api/postgres/advisors
 */
async function testGetAdvisors() {
  const result = await apiRequest('/api/postgres/advisors');

  if (result.ok && result.data.success && result.data.advisors) {
    logTest(
      'GET /api/postgres/advisors',
      'pass',
      result.duration,
      `${result.data.advisors.length} advisors encontrados`
    );
  } else {
    logTest(
      'GET /api/postgres/advisors',
      'fail',
      result.duration,
      result.error || result.data.error
    );
  }
}

/**
 * Test: GET /api/postgres/roles
 */
async function testGetRoles() {
  const result = await apiRequest('/api/postgres/roles');

  if (result.ok && result.data.success && result.data.roles) {
    logTest(
      'GET /api/postgres/roles',
      'pass',
      result.duration,
      `${result.data.roles.length} roles encontrados`
    );
    return result.data.roles[0]?.rol; // Return first role for next test
  } else {
    logTest(
      'GET /api/postgres/roles',
      'fail',
      result.duration,
      result.error || result.data.error
    );
    return null;
  }
}

/**
 * Test: GET /api/postgres/roles/{rol}/permissions
 */
async function testGetRolePermissions(rol) {
  if (!rol) {
    logTest('GET /api/postgres/roles/{rol}/permissions', 'fail', 0, 'No role available');
    return;
  }

  const result = await apiRequest(`/api/postgres/roles/${rol}/permissions`);

  if (result.ok && result.data.success && result.data.permisos) {
    logTest(
      `GET /api/postgres/roles/${rol}/permissions`,
      'pass',
      result.duration,
      `${result.data.permisos.length} permisos encontrados`
    );
  } else {
    logTest(
      `GET /api/postgres/roles/${rol}/permissions`,
      'fail',
      result.duration,
      result.error || result.data.error
    );
  }
}

/**
 * Test: POST /api/postgres/events/batch-counts (Performance)
 */
async function testBatchCounts() {
  // Generate 50 fake event IDs
  const eventIds = Array.from({ length: 50 }, (_, i) => `evt_test_${i}`);

  const result = await apiRequest('/api/postgres/events/batch-counts', {
    method: 'POST',
    body: JSON.stringify({ eventIds })
  });

  if (result.ok && result.data.success) {
    const performanceOk = result.duration < 500;
    logTest(
      'POST /api/postgres/events/batch-counts (50 eventos)',
      performanceOk ? 'pass' : 'partial',
      result.duration,
      performanceOk ? 'Performance OK' : '⚠️ Lento (>500ms)'
    );
  } else {
    logTest(
      'POST /api/postgres/events/batch-counts',
      'fail',
      result.duration,
      result.error || result.data.error
    );
  }
}

/**
 * Test: GET /api/postgres/events/filtered (con filtros)
 */
async function testGetEventsFiltered() {
  const today = new Date().toISOString().split('T')[0];
  const result = await apiRequest(`/api/postgres/events/filtered?desde=${today}`);

  if (result.ok && result.data.success) {
    logTest(
      'GET /api/postgres/events/filtered',
      'pass',
      result.duration,
      `${result.data.events?.length || 0} eventos encontrados`
    );
    return result.data.events?.[0]?._id; // Return first event ID
  } else {
    logTest(
      'GET /api/postgres/events/filtered',
      'fail',
      result.duration,
      result.error || result.data.error
    );
    return null;
  }
}

/**
 * Test: GET /api/postgres/events/{id}
 */
async function testGetEventById(eventId) {
  if (!eventId) {
    logTest('GET /api/postgres/events/{id}', 'fail', 0, 'No event ID available');
    return;
  }

  const result = await apiRequest(`/api/postgres/events/${eventId}`);

  if (result.ok && result.data.success && result.data.event) {
    logTest(
      `GET /api/postgres/events/${eventId}`,
      'pass',
      result.duration,
      `Evento: ${result.data.event.tituloONivel}`
    );
  } else {
    logTest(
      `GET /api/postgres/events/${eventId}`,
      'fail',
      result.duration,
      result.error || result.data.error
    );
  }
}

/**
 * Test: GET /api/postgres/events/{id}/bookings
 */
async function testGetEventBookings(eventId) {
  if (!eventId) {
    logTest('GET /api/postgres/events/{id}/bookings', 'fail', 0, 'No event ID available');
    return;
  }

  const result = await apiRequest(`/api/postgres/events/${eventId}/bookings?includeStudent=true`);

  if (result.ok && result.data.success) {
    logTest(
      `GET /api/postgres/events/${eventId}/bookings`,
      'pass',
      result.duration,
      `${result.data.bookings?.length || 0} inscritos`
    );
  } else {
    logTest(
      `GET /api/postgres/events/${eventId}/bookings`,
      'fail',
      result.duration,
      result.error || result.data.error
    );
  }
}

/**
 * Test: GET /api/postgres/approvals/pending
 */
async function testGetPendingApprovals() {
  const result = await apiRequest('/api/postgres/approvals/pending');

  if (result.ok && result.data.success) {
    logTest(
      'GET /api/postgres/approvals/pending',
      'pass',
      result.duration,
      `${result.data.approvals?.length || 0} aprobaciones pendientes`
    );
  } else {
    logTest(
      'GET /api/postgres/approvals/pending',
      'fail',
      result.duration,
      result.error || result.data.error
    );
  }
}

/**
 * Test: GET /api/postgres/students/search
 */
async function testSearchStudents() {
  const result = await apiRequest('/api/postgres/students/search?q=test');

  if (result.ok && result.data.success) {
    logTest(
      'GET /api/postgres/students/search',
      'pass',
      result.duration,
      `${result.data.students?.length || 0} estudiantes encontrados`
    );
    return result.data.students?.[0]?._id; // Return first student ID
  } else {
    logTest(
      'GET /api/postgres/students/search',
      'fail',
      result.duration,
      result.error || result.data.error
    );
    return null;
  }
}

/**
 * Test: GET /api/postgres/students/{id}
 */
async function testGetStudentById(studentId) {
  if (!studentId) {
    logTest('GET /api/postgres/students/{id}', 'fail', 0, 'No student ID available');
    return;
  }

  const result = await apiRequest(`/api/postgres/students/${studentId}`);

  if (result.ok && result.data.success && result.data.student) {
    logTest(
      `GET /api/postgres/students/${studentId}`,
      'pass',
      result.duration,
      `${result.data.student.primerNombre} ${result.data.student.primerApellido}`
    );
  } else {
    logTest(
      `GET /api/postgres/students/${studentId}`,
      'fail',
      result.duration,
      result.error || result.data.error
    );
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}🧪 TESTING ENDPOINTS POSTGRESQL${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.gray}Base URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.gray}Fecha: ${new Date().toISOString()}${colors.reset}`);

  // 1. Básicos (Catálogos)
  logSection('📚 CATÁLOGOS Y CONFIGURACIÓN');
  await testGetNiveles();
  await testGetAdvisors();
  const firstRole = await testGetRoles();
  await testGetRolePermissions(firstRole);

  // 2. Eventos
  logSection('📅 EVENTOS Y CALENDARIO');
  const firstEventId = await testGetEventsFiltered();
  await testGetEventById(firstEventId);
  await testGetEventBookings(firstEventId);
  await testBatchCounts();

  // 3. Estudiantes
  logSection('👨‍🎓 ESTUDIANTES');
  const firstStudentId = await testSearchStudents();
  await testGetStudentById(firstStudentId);

  // 4. Aprobaciones
  logSection('✅ APROBACIONES');
  await testGetPendingApprovals();

  // Results summary
  console.log('');
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}📊 RESUMEN DE RESULTADOS${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.green}✅ Pasados:${colors.reset} ${results.passed}/${results.total}`);
  console.log(`${colors.red}❌ Fallados:${colors.reset} ${results.failed}/${results.total}`);
  console.log(`${colors.yellow}⚠️  Parciales:${colors.reset} ${results.partial}/${results.total}`);

  const percentage = Math.round((results.passed / results.total) * 100);
  console.log('');
  console.log(`${colors.blue}Tasa de éxito:${colors.reset} ${percentage}%`);

  if (percentage >= 90) {
    console.log(`${colors.green}🎉 EXCELENTE - Listo para deployment${colors.reset}`);
  } else if (percentage >= 70) {
    console.log(`${colors.yellow}⚠️  ACEPTABLE - Revisar issues antes de deployment${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ CRÍTICO - NO deployar hasta resolver issues${colors.reset}`);
  }

  console.log('');
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  // Exit with error code if tests failed
  if (results.failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}❌ Error fatal en testing:${colors.reset}`, error);
  process.exit(1);
});
