/**
 * Cron Runs — helper para auditar la ejecución de jobs programados.
 *
 * Permite que el endpoint /api/cron/health-check responda "el cron X
 * corrió OK hace N horas" o "está stale (sin correr en >26h)" para
 * detectar proactivamente fallos del cron-worker en Digital Ocean.
 *
 * Uso típico en un endpoint de cron:
 *   const result = await recordCronRun('reactivate-onhold', async () => {
 *     const processed = ...
 *     return { processedCount: processed.length, successCount: ..., failedCount: ... };
 *   });
 *
 * El helper:
 *   1. INSERT fila con status='running' al inicio.
 *   2. UPDATE la fila con status='success'|'error', counts y errorMessage al final.
 *   3. Si la función lanza, marca 'error' y re-lanza (el endpoint sigue
 *      reportando el error normalmente — el log NO oculta fallos).
 *   4. Si CRON_RUNS no existe (primer deploy antes de la migración),
 *      el helper degrada a no-op (warning en consola) — NUNCA bloquea
 *      al cron real.
 */

import 'server-only';
import { query, queryOne } from '@/lib/postgres';
import { ids } from '@/lib/id-generator';

export type CronStatus = 'running' | 'success' | 'partial' | 'error';

export interface CronRunResult {
  processedCount?: number;
  successCount?: number;
  failedCount?: number;
  metadata?: Record<string, any>;
}

export interface CronRunRow {
  _id: string;
  cronName: string;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  status: CronStatus;
  processedCount: number;
  successCount: number;
  failedCount: number;
  errorMessage: string | null;
  metadata: Record<string, any> | null;
}

/**
 * Envuelve la ejecución de un cron job con auditoría en CRON_RUNS.
 * Re-lanza cualquier error del callback (no oculta fallos).
 */
export async function recordCronRun<T extends CronRunResult>(
  cronName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const runId = ids.audit();
  let logged = false;

  try {
    await query(
      `INSERT INTO "CRON_RUNS" ("_id", "cronName", "startedAt", "status")
       VALUES ($1, $2, NOW(), 'running')`,
      [runId, cronName],
    );
    logged = true;
  } catch (err: any) {
    console.warn(`[cron-runs] CRON_RUNS no disponible (¿migración pendiente?). Continúo sin auditoría:`, err?.message);
  }

  try {
    const result = await fn();

    if (logged) {
      const processed = result.processedCount ?? 0;
      const success   = result.successCount   ?? processed;
      const failed    = result.failedCount    ?? 0;
      const status: CronStatus = failed > 0 && success > 0 ? 'partial' : failed > 0 ? 'error' : 'success';

      await query(
        `UPDATE "CRON_RUNS"
         SET "finishedAt" = NOW(),
             "status" = $1,
             "processedCount" = $2,
             "successCount" = $3,
             "failedCount" = $4,
             "metadata" = $5::jsonb
         WHERE "_id" = $6`,
        [status, processed, success, failed, JSON.stringify(result.metadata ?? null), runId],
      ).catch(err => console.warn('[cron-runs] update success failed:', err?.message));
    }

    return result;
  } catch (err: any) {
    if (logged) {
      await query(
        `UPDATE "CRON_RUNS"
         SET "finishedAt" = NOW(),
             "status" = 'error',
             "errorMessage" = $1
         WHERE "_id" = $2`,
        [String(err?.message ?? err).slice(0, 1000), runId],
      ).catch(e => console.warn('[cron-runs] update error failed:', e?.message));
    }
    throw err;
  }
}

/**
 * Última ejecución (success o error) por cron name.
 */
export async function getLastRun(cronName: string): Promise<CronRunRow | null> {
  return queryOne<CronRunRow>(
    `SELECT * FROM "CRON_RUNS"
     WHERE "cronName" = $1 AND "finishedAt" IS NOT NULL
     ORDER BY "startedAt" DESC LIMIT 1`,
    [cronName],
  ).catch(() => null);
}

/**
 * Helper de "stale": true si la última ejecución terminada fue hace más
 * de `maxHours` horas (default 26h — los crones son diarios + 2h de margen).
 */
export function isStale(lastRun: CronRunRow | null, maxHours = 26): boolean {
  if (!lastRun?.finishedAt) return true;
  const ageMs = Date.now() - new Date(lastRun.finishedAt).getTime();
  return ageMs > maxHours * 60 * 60 * 1000;
}
