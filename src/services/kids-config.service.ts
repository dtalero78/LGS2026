import 'server-only';
import { AppConfigRepository } from '@/repositories/config.repository';

/**
 * Feature flag del proceso "Kids" (switch + modal en Crear Contrato).
 * Guardado en APP_CONFIG (clave `kids_feature_activo`), togglable desde
 * Mantenimiento sin necesidad de deploy. Default FALSE si el registro no existe.
 */
const KEY = 'kids_feature_activo';
const TTL_MS = 60_000;
let cache: { value: boolean; expires: number } | null = null;

export const kidsConfigService = {
  /** ¿Está activo el proceso Kids? (cache 60s). Default false. */
  async isActive(): Promise<boolean> {
    const now = Date.now();
    if (cache && cache.expires > now) return cache.value;
    const row = await AppConfigRepository.get(KEY);
    const value = row?.value === 'true';
    cache = { value, expires: now + TTL_MS };
    return value;
  },

  /** Activa/desactiva el proceso Kids (admin). Invalida el cache. */
  async setActive(active: boolean, actor: string): Promise<void> {
    await AppConfigRepository.set(KEY, active ? 'true' : 'false', '#ffffff', actor);
    cache = null;
  },
};
