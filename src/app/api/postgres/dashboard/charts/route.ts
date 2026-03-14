import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryMany, queryOne } from '@/lib/postgres';

// ── Server-side cache (30 min TTL) ─────────────────────────────────
let cachedCharts: { html: string; generatedAt: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── Gather chart data from DB ──────────────────────────────────────

async function gatherChartData() {
  const now = new Date();

  // Last 14 days for sessions trend
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  const startDate = fourteenDaysAgo.toISOString().split('T')[0];

  // Current month for top students
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    sessionsByDay,
    bookingsByType,
    studentsByLevel,
    topStudents,
    attendanceRate,
    advisorLoad,
  ] = await Promise.all([
    // 1. Sessions per day (last 14 days)
    queryMany<{ dia: string; total: number }>(
      `SELECT "dia"::date::text AS dia, COUNT(*) AS total
       FROM "CALENDARIO"
       WHERE "dia"::date >= $1::date
       GROUP BY "dia"::date
       ORDER BY "dia"::date`,
      [startDate]
    ),

    // 2. Bookings by event type (current month)
    queryMany<{ tipo: string; total: number }>(
      `SELECT COALESCE("tipo", 'SIN TIPO') AS tipo, COUNT(*) AS total
       FROM "ACADEMICA_BOOKINGS"
       WHERE "fechaEvento" >= $1
       GROUP BY COALESCE("tipo", 'SIN TIPO')
       ORDER BY total DESC`,
      [monthStart]
    ),

    // 3. Students by level (active only)
    queryMany<{ nivel: string; total: number }>(
      `SELECT COALESCE(a."nivel", 'SIN NIVEL') AS nivel, COUNT(*) AS total
       FROM "ACADEMICA" a
       WHERE a."estadoInactivo" IS NOT TRUE
       GROUP BY COALESCE(a."nivel", 'SIN NIVEL')
       ORDER BY total DESC
       LIMIT 10`,
      []
    ),

    // 4. Top 10 students this month
    queryMany<{ nombre: string; asistencias: number; nivel: string }>(
      `SELECT b."primerNombre" || ' ' || b."primerApellido" AS nombre,
              COUNT(*) AS asistencias,
              COALESCE(b."nivel", '') AS nivel
       FROM "ACADEMICA_BOOKINGS" b
       WHERE b."asistio" = true AND b."fechaEvento" >= $1
       GROUP BY b."primerNombre", b."primerApellido", b."nivel"
       ORDER BY asistencias DESC
       LIMIT 10`,
      [monthStart]
    ),

    // 5. Attendance rate (last 30 days)
    queryOne<{ total: number; asistieron: number; ausentes: number }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE "asistio" = true) AS asistieron,
         COUNT(*) FILTER (WHERE "asistio" = false) AS ausentes
       FROM "ACADEMICA_BOOKINGS"
       WHERE "fechaEvento" >= NOW() - INTERVAL '30 days'
         AND "fechaEvento" <= NOW()`,
      []
    ),

    // 6. Advisor workload (current month, top 10)
    queryMany<{ advisor: string; sesiones: number }>(
      `SELECT "advisor", COUNT(*) AS sesiones
       FROM "CALENDARIO"
       WHERE "dia" >= $1 AND "advisor" IS NOT NULL AND "advisor" != ''
       GROUP BY "advisor"
       ORDER BY sesiones DESC
       LIMIT 10`,
      [monthStart]
    ),
  ]);

  return {
    sessionsByDay,
    bookingsByType,
    studentsByLevel,
    topStudents,
    attendanceRate: attendanceRate || { total: 0, asistieron: 0, ausentes: 0 },
    advisorLoad,
  };
}

// ── Call Claude API to generate SVG charts ──────────────────────────

async function generateChartsWithClaude(data: any): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const prompt = `Eres un experto en visualización de datos. Genera HTML con gráficas SVG inline para un dashboard administrativo de una plataforma educativa llamada "Let's Go Speak". El diseño debe ser moderno, limpio y profesional con colores suaves.

DATOS:

1. Sesiones por día (últimos 14 días):
${JSON.stringify(data.sessionsByDay)}

2. Bookings por tipo de evento (mes actual):
${JSON.stringify(data.bookingsByType)}

3. Estudiantes activos por nivel:
${JSON.stringify(data.studentsByLevel)}

4. Top 10 estudiantes del mes (por asistencias):
${JSON.stringify(data.topStudents)}

5. Tasa de asistencia (últimos 30 días):
${JSON.stringify(data.attendanceRate)}

6. Carga de advisors (top 10, mes actual):
${JSON.stringify(data.advisorLoad)}

INSTRUCCIONES:
- Genera SOLO el HTML con SVGs inline. NO incluyas <html>, <head>, <body>, ni scripts.
- Usa una grid responsive de 2 columnas (CSS grid con gap).
- Cada gráfica debe estar en una tarjeta (card) con fondo blanco, bordes redondeados, y sombra sutil.
- Cada card debe tener un título descriptivo en español.
- Paleta de colores: azul (#3B82F6, #60A5FA, #93C5FD), verde (#10B981, #34D399), naranja (#F59E0B), rojo (#EF4444), gris (#6B7280, #9CA3AF).
- Las gráficas deben ser:
  1. **Sesiones por día**: Gráfica de barras verticales con labels de fecha (dd/mm) en eje X. Muestra valor encima de cada barra.
  2. **Distribución por tipo de evento**: Gráfica de donut/pie con leyenda.
  3. **Estudiantes por nivel**: Barras horizontales con nombre del nivel y valor.
  4. **Tasa de asistencia**: Un gauge/indicador circular grande mostrando el porcentaje, con labels de Asistieron/Ausentes/Pendientes.
  5. **Top 10 estudiantes**: Barras horizontales con nombre, nivel, y conteo.
  6. **Carga de advisors**: Barras horizontales con nombre del advisor y número de sesiones.
- Todos los SVGs deben tener width="100%" y un viewBox adecuado para ser responsive.
- Los textos deben ser legibles (font-size mínimo 11px).
- NO uses JavaScript ni scripts. Solo HTML+CSS+SVG inline.
- El CSS debe estar inline o en un <style> tag al inicio.
- Si un dataset está vacío, muestra un mensaje "Sin datos disponibles" en la tarjeta correspondiente.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || '';

  // Extract HTML from markdown code blocks if present
  const htmlMatch = text.match(/```html?\s*([\s\S]*?)```/);
  return htmlMatch ? htmlMatch[1].trim() : text.trim();
}

// ── Route handler ───────────────────────────────────────────────────

export const GET = handlerWithAuth(async () => {
  // Return cached if fresh
  if (cachedCharts && Date.now() - cacheTimestamp < CACHE_TTL) {
    return successResponse({ ...cachedCharts, cached: true });
  }

  const data = await gatherChartData();
  const html = await generateChartsWithClaude(data);

  cachedCharts = { html, generatedAt: new Date().toISOString() };
  cacheTimestamp = Date.now();

  return successResponse({ ...cachedCharts, cached: false });
});

// Force regenerate (bypass cache)
export const POST = handlerWithAuth(async () => {
  const data = await gatherChartData();
  const html = await generateChartsWithClaude(data);

  cachedCharts = { html, generatedAt: new Date().toISOString() };
  cacheTimestamp = Date.now();

  return successResponse({ ...cachedCharts, cached: false });
});
