import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { handler, handlerWithAuth } from '@/lib/api-helpers';
import { ServiceBusyError } from '@/lib/errors';

/**
 * Semáforo global para las consultas del módulo de Informes.
 *
 * Los informes hacen agregaciones pesadas; si muchas personas corren varias a la
 * vez pueden saturar las conexiones/CPU de la BD (cluster chico). Este límite
 * global (en memoria, por instancia — el app corre con instance_count=1) impide
 * que haya más de MAX consultas de informes EN CURSO al mismo tiempo. Si se
 * supera, rechaza de inmediato (no encola) con 503 para que el usuario reintente,
 * en vez de acumular consultas y tumbar la BD.
 *
 * Se cachea en globalThis para sobrevivir el hot-reload de Next en desarrollo.
 */
const MAX_CONCURRENT = 6;

const g = globalThis as unknown as { __lgsReportSlots?: { inFlight: number } };
const state = g.__lgsReportSlots ?? (g.__lgsReportSlots = { inFlight: 0 });

/**
 * Ejecuta `fn` ocupando un cupo del semáforo. Si no hay cupo, lanza
 * ServiceBusyError (503) SIN ejecutar la consulta. Libera el cupo pase lo que pase.
 */
export async function withReportSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (state.inFlight >= MAX_CONCURRENT) {
    throw new ServiceBusyError(
      'El sistema está procesando muchas consultas de informes en este momento. Espera unos segundos y vuelve a intentar.',
    );
  }
  state.inFlight++;
  try {
    return await fn();
  } finally {
    state.inFlight--;
  }
}

/**
 * Igual que `handlerWithAuth` pero además ocupa un cupo del semáforo global de
 * informes mientras corre el handler. Si no hay cupo, responde 503
 * ("sistema ocupado, reintenta") sin ejecutar la consulta. Usar en TODOS los
 * endpoints del módulo de Informes (/api/postgres/reports/** e informes/*).
 */
export function handlerReport(
  fn: (request: NextRequest, context: { params: Record<string, string> }, session: Session) => Promise<NextResponse>,
) {
  return handlerWithAuth((request, context, session) =>
    withReportSlot(() => fn(request, context, session)),
  );
}

/**
 * Igual que `handlerReport` pero SIN autenticación (envuelve `handler`, no
 * `handlerWithAuth`). Para los endpoints de informes que ya eran públicos
 * (asistencia/*, estadisticas/*): conserva su comportamiento (sin auth) y solo
 * les agrega el cupo del semáforo. NO cambia el gating de esos endpoints.
 */
export function handlerReportPublic(
  fn: (request: NextRequest, context: { params: Record<string, string> }) => Promise<NextResponse>,
) {
  return handler((request, context) => withReportSlot(() => fn(request, context)));
}
