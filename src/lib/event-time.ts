/**
 * event-time.ts — Zona horaria CANÓNICA de los eventos (CALENDARIO / ADMIN_EVENTS).
 *
 * PROBLEMA que resuelve:
 *   Los eventos se crean y se consultan desde muchos países (Chile, Argentina,
 *   España, México, Colombia, …). Antes, tanto el GUARDADO como la LECTURA de la
 *   hora dependían de la TZ del navegador de quien operaba:
 *     - Guardar: `new Date("2026-06-30T18:00:00")` (sin offset) se interpretaba en
 *       la TZ del navegador → el MISMO "18:00" quedaba en instantes UTC distintos
 *       según el país de quien creaba el evento.
 *     - Leer: agrupar por día/mes con `getDate()`/`getMonth()` (TZ del navegador)
 *       hacía que un evento de la tarde-noche en Colombia (que cruza a UTC del día
 *       siguiente) cayera en un día/mes distinto según quién consultaba → horas
 *       que "desaparecían" del conteo mensual del advisor.
 *
 * SOLUCIÓN:
 *   Anclar TODA la semántica de hora/día/mes de los eventos a UNA sola zona
 *   canónica: la operación de la plataforma = America/Bogota (Colombia). Así el
 *   resultado es DETERMINISTA e independiente del país desde donde se cree o se
 *   consulte. Colombia no observa horario de verano (DST) → offset fijo `-05:00`.
 *   El formateo de lectura usa `Intl` con la TZ IANA (robusto ante DST si algún
 *   día cambia la zona canónica).
 *
 * Este módulo es CLIENTE + SERVIDOR (sin `'server-only'`): lo usan tanto los
 * formularios de creación (EventModal, eventos-administrativos) como los
 * servicios/vistas de lectura (buildMonthlyView, control-horas, panel-advisor,
 * AdvisorDashboard).
 */

/** Zona horaria canónica de los eventos de la plataforma. */
export const PLATFORM_TZ = 'America/Bogota';
/** Offset fijo de Colombia (sin DST). Usado para construir instantes deterministas. */
const PLATFORM_OFFSET = '-05:00';

/**
 * Convierte una fecha (`YYYY-MM-DD`) + hora (`HH:MM`) elegidas en el formulario,
 * interpretadas SIEMPRE como hora de Colombia, al instante UTC (ISO string).
 * Determinista: no depende de la TZ del navegador de quien crea el evento.
 */
export function eventLocalToUTC(fecha: string, hora: string): string {
  const hhmm = String(hora || '').slice(0, 5).padStart(5, '0');
  return new Date(`${fecha}T${hhmm}:00${PLATFORM_OFFSET}`).toISOString();
}

/**
 * Límites [inicio, finExclusivo) de un mes en hora de Colombia, como ISO UTC.
 * Ej. junio 2026 → ['2026-06-01T05:00:00Z', '2026-07-01T05:00:00Z').
 * Incluye correctamente los eventos de la tarde-noche del último día del mes
 * (que en UTC caen en el día 1 del mes siguiente).
 */
export function monthRangeLocal(year: number, month: number): { fromISO: string; toISO: string } {
  const mm = String(month).padStart(2, '0');
  const toY = month === 12 ? year + 1 : year;
  const toM = String(month === 12 ? 1 : month + 1).padStart(2, '0');
  const from = new Date(`${year}-${mm}-01T00:00:00${PLATFORM_OFFSET}`);
  const to = new Date(`${toY}-${toM}-01T00:00:00${PLATFORM_OFFSET}`);
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

/** Componentes de un instante en hora de Colombia (deterministas, DST-correctos). */
export function eventParts(iso: string | Date): {
  year: number; month: number; day: number; weekdayMon0: number; hour: number; minute: number;
} {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PLATFORM_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  const wdMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return {
    year: +get('year'),
    month: +get('month'),
    day: +get('day'),
    weekdayMon0: wdMap[get('weekday')] ?? 0,
    hour: (+get('hour')) % 24,   // '24' de medianoche → 0
    minute: +get('minute'),
  };
}

/** `YYYY-MM-DD` del instante en hora de Colombia (para agrupar por día del calendario). */
export function eventDayKey(iso: string | Date): string {
  const p = eventParts(iso);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** `HH:MM` (24h) del instante en hora de Colombia (para mostrar la hora del evento). */
export function eventHora(iso: string | null | undefined | Date): string {
  if (!iso) return '--:--';
  try {
    const p = eventParts(iso);
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  } catch {
    return '--:--';
  }
}

/** `YYYY-MM-DD` de HOY en hora de Colombia (para resaltar "hoy" en el calendario). */
export function todayDayKeyLocal(): string {
  return eventDayKey(new Date());
}
