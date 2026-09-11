import 'server-only';
import { AppConfigRepository } from '@/repositories/config.repository';

/**
 * Feature flag de la página de bienvenida post-firma (`/bienvenida/[id]`).
 * Guardado en APP_CONFIG (clave `bienvenida_pagina_activa`), togglable desde
 * Mantenimiento sin deploy. Default FALSE si el registro no existe.
 *
 * Con el flag APAGADO, al firmar el contrato se conserva el comportamiento
 * anterior: redirección a letsgospeak.cl (con fallback a letsgospeak.com.co).
 */
const KEY = 'bienvenida_pagina_activa';
const TTL_MS = 60_000;
let cache: { value: boolean; expires: number } | null = null;

export const bienvenidaConfigService = {
  /** ¿Está activa la página de bienvenida? (cache 60s). Default false. */
  async isActive(): Promise<boolean> {
    // Override SOLO local (.env.local, no se despliega) para probar sin tocar prod.
    if (process.env.BIENVENIDA_PAGINA_LOCAL === 'true') return true;
    const now = Date.now();
    if (cache && cache.expires > now) return cache.value;
    const row = await AppConfigRepository.get(KEY);
    const value = row?.value === 'true';
    cache = { value, expires: now + TTL_MS };
    return value;
  },

  /** Activa/desactiva la página de bienvenida (admin). Invalida el cache. */
  async setActive(active: boolean, actor: string): Promise<void> {
    await AppConfigRepository.set(KEY, active ? 'true' : 'false', '#ffffff', actor);
    cache = null;
  },
};
