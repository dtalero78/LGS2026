import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryMany, queryOne } from '@/lib/postgres';

// ── Server-side cache (30 min TTL, per chart type) ───────────────
const chartCache = new Map<string, { html: string; generatedAt: string }>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── Chart definitions ────────────────────────────────────────────

interface ChartDef {
  key: string;
  label: string;
  description: string;
  gatherData: () => Promise<any>;
  buildPrompt: (data: any) => string;
}

const CHART_DEFS: ChartDef[] = [
  {
    key: 'sessions-trend',
    label: 'Sesiones por Día',
    description: 'Tendencia de sesiones agendadas en los últimos 14 días',
    gatherData: async () => {
      const now = new Date();
      const fourteenDaysAgo = new Date(now);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
      const startDate = fourteenDaysAgo.toISOString().split('T')[0];
      return queryMany<{ dia: string; total: number }>(
        `SELECT "dia"::date::text AS dia, COUNT(*) AS total
         FROM "CALENDARIO"
         WHERE "dia"::date >= $1::date
         GROUP BY "dia"::date
         ORDER BY "dia"::date`,
        [startDate]
      );
    },
    buildPrompt: (data) => `Genera una gráfica de BARRAS VERTICALES para "Sesiones por Día (últimos 14 días)".
Datos: ${JSON.stringify(data)}
- Eje X: fechas en formato dd/mm. Muestra el valor encima de cada barra.
- Color principal: #3B82F6 (azul).
- Barras con bordes redondeados arriba.`,
  },
  {
    key: 'bookings-type',
    label: 'Distribución por Tipo',
    description: 'Bookings del mes actual agrupados por tipo de evento',
    gatherData: async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      return queryMany<{ tipo: string; total: number }>(
        `SELECT COALESCE(c."tipo", b."tipo",
                 CASE
                   WHEN b."step" ILIKE 'TRAINING%' THEN 'CLUB'
                   WHEN b."step" ILIKE 'Step%' THEN 'SESSION'
                   ELSE 'OTRO'
                 END) AS tipo,
                COUNT(*) AS total
         FROM "ACADEMICA_BOOKINGS" b
         LEFT JOIN "CALENDARIO" c ON c."_id" = COALESCE(b."eventoId", b."idEvento")
         WHERE b."fechaEvento" >= $1
         GROUP BY COALESCE(c."tipo", b."tipo",
                 CASE
                   WHEN b."step" ILIKE 'TRAINING%' THEN 'CLUB'
                   WHEN b."step" ILIKE 'Step%' THEN 'SESSION'
                   ELSE 'OTRO'
                 END)
         ORDER BY total DESC`,
        [monthStart]
      );
    },
    buildPrompt: (data) => `Genera una gráfica de DONUT/PIE para "Distribución por Tipo de Evento (mes actual)".
Datos: ${JSON.stringify(data)}
- Incluye leyenda con porcentajes.
- Colores: SESSION=#3B82F6, CLUB=#10B981, WELCOME=#8B5CF6, OTRO=#9CA3AF.`,
  },
  {
    key: 'students-level',
    label: 'Estudiantes por Nivel',
    description: 'Distribución de estudiantes activos por nivel académico',
    gatherData: async () => {
      return queryMany<{ nivel: string; total: number }>(
        `SELECT COALESCE(a."nivel", 'SIN NIVEL') AS nivel, COUNT(*) AS total
         FROM "ACADEMICA" a
         WHERE a."estadoInactivo" IS NOT TRUE
         GROUP BY COALESCE(a."nivel", 'SIN NIVEL')
         ORDER BY total DESC
         LIMIT 10`,
        []
      );
    },
    buildPrompt: (data) => `Genera una gráfica de BARRAS HORIZONTALES para "Estudiantes Activos por Nivel".
Datos: ${JSON.stringify(data)}
- Nombre del nivel a la izquierda, barra al centro, valor a la derecha.
- Gradiente de colores azul (#3B82F6 → #93C5FD).`,
  },
  {
    key: 'attendance-rate',
    label: 'Tasa de Asistencia',
    description: 'Porcentaje de asistencia en los últimos 30 días',
    gatherData: async () => {
      return queryOne<{ total: number; asistieron: number; ausentes: number }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE "asistio" = true) AS asistieron,
           COUNT(*) FILTER (WHERE "asistio" = false) AS ausentes
         FROM "ACADEMICA_BOOKINGS"
         WHERE "fechaEvento" >= NOW() - INTERVAL '30 days'
           AND "fechaEvento" <= NOW()`,
        []
      ) || { total: 0, asistieron: 0, ausentes: 0 };
    },
    buildPrompt: (data) => `Genera un GAUGE/INDICADOR CIRCULAR grande para "Tasa de Asistencia (últimos 30 días)".
Datos: ${JSON.stringify(data)}
- Muestra el porcentaje de asistencia en el centro del gauge.
- Labels debajo: Asistieron (verde #10B981), Ausentes (rojo #EF4444), Pendientes (gris #9CA3AF).
- Pendientes = total - asistieron - ausentes.`,
  },
  {
    key: 'top-students',
    label: 'Top 10 Estudiantes',
    description: 'Estudiantes con más asistencias este mes',
    gatherData: async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      return queryMany<{ nombre: string; asistencias: number; nivel: string }>(
        `SELECT COALESCE(a."primerNombre" || ' ' || a."primerApellido",
                         b."primerNombre" || ' ' || b."primerApellido",
                         'Desconocido') AS nombre,
                COUNT(*) AS asistencias,
                COALESCE(a."nivel", b."nivel", '') AS nivel
         FROM "ACADEMICA_BOOKINGS" b
         LEFT JOIN "ACADEMICA" a ON a."_id" = COALESCE(b."idEstudiante", b."studentId")
         WHERE b."asistio" = true AND b."fechaEvento" >= $1
         GROUP BY COALESCE(a."primerNombre" || ' ' || a."primerApellido",
                           b."primerNombre" || ' ' || b."primerApellido",
                           'Desconocido'),
                  COALESCE(a."nivel", b."nivel", '')
         ORDER BY asistencias DESC
         LIMIT 10`,
        [monthStart]
      );
    },
    buildPrompt: (data) => `Genera una gráfica de BARRAS HORIZONTALES para "Top 10 Estudiantes del Mes".
Datos: ${JSON.stringify(data)}
- Cada barra muestra: nombre del estudiante, nivel entre paréntesis, y conteo de asistencias.
- Color: gradiente dorado (#F59E0B → #FBBF24) para los primeros 3, azul (#3B82F6) para el resto.`,
  },
  {
    key: 'advisor-load',
    label: 'Carga de Advisors',
    description: 'Top 10 advisors con más sesiones este mes',
    gatherData: async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      return queryMany<{ advisor: string; sesiones: number }>(
        `SELECT COALESCE(adv."nombreCompleto",
                         adv."primerNombre" || ' ' || adv."primerApellido",
                         c."advisor") AS advisor,
                COUNT(*) AS sesiones
         FROM "CALENDARIO" c
         LEFT JOIN "ADVISORS" adv ON adv."_id" = c."advisor"
         WHERE c."dia" >= $1 AND c."advisor" IS NOT NULL AND c."advisor" != ''
         GROUP BY COALESCE(adv."nombreCompleto",
                           adv."primerNombre" || ' ' || adv."primerApellido",
                           c."advisor")
         ORDER BY sesiones DESC
         LIMIT 10`,
        [monthStart]
      );
    },
    buildPrompt: (data) => `Genera una gráfica de BARRAS HORIZONTALES para "Carga de Advisors (mes actual)".
Datos: ${JSON.stringify(data)}
- Nombre del advisor a la izquierda, barra al centro, número de sesiones a la derecha.
- Color: verde (#10B981 → #34D399).`,
  },
];

// ── Call Claude API to generate a single chart ───────────────────

async function generateChartWithClaude(chartPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const systemPrompt = `Eres un experto en visualización de datos. Genera un documento HTML completo con una sola gráfica SVG inline para un dashboard administrativo. El diseño debe ser moderno, limpio y profesional.

REGLAS:
- Genera un documento HTML completo: <!DOCTYPE html>, <html>, <head> con <style>, y <body>.
- El body debe tener font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: transparent; margin: 0; padding: 16px.
- La gráfica debe estar en una tarjeta (card) con fondo blanco, border-radius: 12px, y box-shadow sutil.
- El SVG debe tener width="100%" y un viewBox adecuado para ser responsive.
- Los textos deben ser legibles (font-size mínimo 11px).
- INTERACTIVIDAD con JavaScript:
  - Tooltips al hacer hover sobre barras/segmentos mostrando el valor exacto.
  - Efecto hover en barras (cambio de opacidad o color).
  - Animación suave de entrada (CSS transitions o requestAnimationFrame).
- Los scripts deben ir en un <script> tag al final del body.
- Si el dataset está vacío, muestra un mensaje "Sin datos disponibles".
- NO incluyas explicaciones, solo el HTML.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: chartPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[Charts] Claude API error:', response.status, err.slice(0, 500));
    throw new Error(`Claude API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || '';

  const htmlMatch = text.match(/```html?\s*([\s\S]*?)```/);
  return htmlMatch ? htmlMatch[1].trim() : text.trim();
}

// ── Route handlers ───────────────────────────────────────────────

// GET: Return available chart options (no data fetching)
export const GET = handlerWithAuth(async (req) => {
  const url = new URL(req.url);
  const chartKey = url.searchParams.get('chart');

  // If no chart specified, return available options
  if (!chartKey) {
    const options = CHART_DEFS.map(d => ({ key: d.key, label: d.label, description: d.description }));
    return successResponse({ options });
  }

  // Check cache for specific chart
  const cached = chartCache.get(chartKey);
  const ts = cacheTimestamps.get(chartKey) || 0;
  if (cached && Date.now() - ts < CACHE_TTL) {
    return successResponse({ ...cached, cached: true });
  }

  // Generate specific chart
  const def = CHART_DEFS.find(d => d.key === chartKey);
  if (!def) {
    return successResponse({ error: `Chart "${chartKey}" not found` });
  }

  console.log(`[Charts] Generating "${chartKey}"...`);
  const data = await def.gatherData();
  const html = await generateChartWithClaude(def.buildPrompt(data));
  console.log(`[Charts] "${chartKey}" generated, HTML length: ${html.length}`);

  const entry = { html, generatedAt: new Date().toISOString() };
  chartCache.set(chartKey, entry);
  cacheTimestamps.set(chartKey, Date.now());

  return successResponse({ ...entry, cached: false });
});

// POST: Force regenerate a specific chart
export const POST = handlerWithAuth(async (req) => {
  const body = await req.json().catch(() => ({}));
  const chartKey = body.chart;

  if (!chartKey) {
    return successResponse({ error: 'Missing "chart" parameter' });
  }

  const def = CHART_DEFS.find(d => d.key === chartKey);
  if (!def) {
    return successResponse({ error: `Chart "${chartKey}" not found` });
  }

  const data = await def.gatherData();
  const html = await generateChartWithClaude(def.buildPrompt(data));

  const entry = { html, generatedAt: new Date().toISOString() };
  chartCache.set(chartKey, entry);
  cacheTimestamps.set(chartKey, Date.now());

  return successResponse({ ...entry, cached: false });
});
