/**
 * Duración de eventos de CALENDARIO (cliente + servidor — sin 'server-only').
 *
 * En LGS las sesiones y clubs duran 1 hora; no hay "horario del curso" con rango
 * como en otras plataformas. Se mantiene un mapa por tipo por si a futuro se
 * agregan tipos con otra duración; hoy todos caen al default de 60 min.
 *
 * Es la única fuente de verdad para la hora de fin / duración — la usa
 * `zoom-window` para saber hasta cuándo dura la reconexión al Zoom.
 */
export const DEFAULT_EVENT_DURATION_MIN = 60;

const DURATION_BY_TIPO: Record<string, number> = {
  SESSION: 60,
  CLUB: 60,
  WELCOME: 60,
};

/** Minutos que dura el evento según su tipo (default 60). */
export function eventDurationMin(tipo?: string | null): number {
  return DURATION_BY_TIPO[String(tipo || '').toUpperCase()] ?? DEFAULT_EVENT_DURATION_MIN;
}

/** Fecha/hora de fin del evento (inicio + su duración). */
export function eventEndDate(dia: Date | string, tipo?: string | null): Date {
  const start = typeof dia === 'string' ? new Date(dia) : dia;
  return new Date(start.getTime() + eventDurationMin(tipo) * 60_000);
}
