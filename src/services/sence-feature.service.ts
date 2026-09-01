import 'server-only';
import { AppConfigRepository } from '@/repositories/config.repository';

/**
 * Feature flag del proceso SENCE (registro de asistencia por Clave Única en el
 * panel del estudiante). Guardado en APP_CONFIG (clave `sence_feature_activo`),
 * togglable desde Mantenimiento › Contingencia › "Proceso SENCE" sin deploy.
 *
 * Default FALSE si el registro no existe → el proceso nace APAGADO: los alumnos
 * SENCE NO ven el botón "Iniciar sesión SENCE" y entran directo por Zoom, hasta
 * que se les configure el `senceCode` a todos y se active el flag.
 */
const KEY = 'sence_feature_activo';
const TTL_MS = 60_000;
let cache: { value: boolean; expires: number } | null = null;

export const senceFeatureService = {
  /** ¿Está activo el proceso SENCE? (cache 60s). Default false. */
  async isActive(): Promise<boolean> {
    // Override SOLO local (via .env.local, que NO se despliega): permite probar
    // el flujo SENCE sin activar el flag en la BD de producción (compartida).
    if (process.env.SENCE_FEATURE_LOCAL === 'true') return true;
    const now = Date.now();
    if (cache && cache.expires > now) return cache.value;
    const row = await AppConfigRepository.get(KEY);
    const value = row?.value === 'true';
    cache = { value, expires: now + TTL_MS };
    return value;
  },

  /** Activa/desactiva el proceso SENCE (admin). Invalida el cache. */
  async setActive(active: boolean, actor: string): Promise<void> {
    await AppConfigRepository.set(KEY, active ? 'true' : 'false', '#ffffff', actor);
    cache = null;
  },
};
