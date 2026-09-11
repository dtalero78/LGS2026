import 'server-only';

/**
 * Ejecuta una migración idempotente UNA sola vez por proceso.
 *
 * Por qué existe: el patrón "asegurar la columna antes de usarla" estaba copiado
 * en varios módulos con dos fallas que juntas tumbaron el cluster el 2026-09-07:
 *
 *   1. El flag `xEnsured` se marcaba SOLO en el camino feliz. Si el ALTER fallaba
 *      (p.ej. timeout porque la BD estaba ocupada), nunca se marcaba y se
 *      reintentaba en CADA request. Como ALTER TABLE toma un lock ACCESS EXCLUSIVE,
 *      cada reintento se encolaba delante del tráfico normal de esa tabla: un hipo
 *      transitorio se convertía en una caída permanente que se autoalimentaba.
 *
 *   2. El flag se marcaba AL TERMINAR, así que N requests concurrentes durante el
 *      arranque disparaban N migraciones simultáneas sobre la misma tabla.
 *
 * `ensureOnce` cachea la PROMESA bajo una clave: los concurrentes esperan la misma
 * ejecución, y un fallo no se reintenta (queda registrado y se sigue). El esquema
 * real se garantiza con los scripts de `scripts/`, no desde el request path.
 *
 * Para código nuevo: no pongas DDL acá. Escribe un script idempotente en `scripts/`.
 */
const inFlight = new Map<string, Promise<void>>();

export function ensureOnce(key: string, migration: () => Promise<unknown>): Promise<void> {
  let pending = inFlight.get(key);
  if (!pending) {
    pending = migration()
      .then(() => undefined)
      .catch((err: any) => {
        console.warn(
          `⚠️ [ensureOnce:${key}] no se pudo asegurar el esquema (se continúa sin reintentar):`,
          err?.message ?? err
        );
      });
    inFlight.set(key, pending);
  }
  return pending;
}

/** Solo para tests: olvida lo ya ejecutado. */
export function __resetEnsureOnce(): void {
  inFlight.clear();
}
