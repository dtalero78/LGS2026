import 'server-only';

/**
 * rate-limit.ts — limitador de intentos en memoria (ventana fija).
 *
 * POR QUÉ: el flujo de recuperación de contraseña no tenía ningún límite. Los
 * últimos 4 del numeroId son 10.000 combinaciones y el OTP 1.000.000 — sin
 * límite se prueban por fuerza bruta en minutos.
 *
 * LIMITACIÓN CONOCIDA (igual que `otp-store`): el contador vive en memoria del
 * proceso. Se pierde al reiniciar y NO se comparte entre réplicas. Hoy funciona
 * porque el servicio corre con `instance_count: 1` (.do/app.yaml). Si se escala
 * a N instancias, el límite efectivo se multiplica por N — habría que moverlo a
 * Postgres o Redis. Aun así, un límite imperfecto es MUCHO mejor que ninguno.
 */

interface Entry { count: number; resetAt: number }

const buckets = new Map<string, Entry>();

/** Limpieza perezosa: purga vencidos cada vez que el Map crece demasiado. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
}

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos hasta que se libere el bloqueo (0 si está permitido). */
  retryAfterSec: number;
  /** Intentos que quedan en la ventana actual. */
  remaining: number;
}

/**
 * Consume un intento para `key`. Devuelve allowed=false al superar `max`
 * dentro de `windowMs`.
 *
 * @param key      identificador del bucket, p.ej. `verify-otp:juan@x.com`
 * @param max      intentos permitidos por ventana
 * @param windowMs duración de la ventana en ms
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const cur = buckets.get(key);
  if (!cur || now > cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0, remaining: max - 1 };
  }

  cur.count += 1;
  if (cur.count > max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  return { allowed: true, retryAfterSec: 0, remaining: max - cur.count };
}

/** Libera el bucket (p.ej. tras un intento exitoso). */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}
