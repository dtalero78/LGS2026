import 'server-only';
import { AppConfigRepository } from '@/repositories/config.repository';
import { ValidationError } from '@/lib/errors';

/**
 * Contingencia de canales de WhatsApp (Whapi).
 *
 * La plataforma tiene DOS canales/números en Whapi. Si uno se cae (la sesión de
 * WhatsApp queda en estado "QR" = deslogueado), TODO lo que sale por ese número
 * falla. Este servicio permite **elegir por cuál canal sale TODO el WhatsApp**
 * desde Mantenimiento › Contingencia, guardando la elección en APP_CONFIG
 * (`whatsapp_canal` = 'A' | 'B'), togglable sin deploy (efecto en ≤60s por cache).
 *
 * Todos los puntos de envío leen `getActiveToken()`. Default 'A' (el número
 * "Coordinador Servicio al usuario", histórico primario).
 */

export type CanalId = 'A' | 'B';

/** Los 2 canales. Los tokens ya viven en git (fallbacks históricos). */
export const WHATSAPP_CANALES: Record<CanalId, {
  token: string; numero: string; channelId: string; nombre: string;
}> = {
  A: { token: 'VSyDX4j7ooAJ7UGOhz8lGplUVDDs2EYj', numero: '+56 9 5770 3724', channelId: 'SPDRMN-67FL6', nombre: 'Coordinador Servicio al usuario' },
  B: { token: 'I1s8u9FihgMttIDRvRDoMpOJB1LzPgtx', numero: '+56 9 4267 9066', channelId: 'DEADPL-QSNG2', nombre: "Let's Go Speak" },
};

const KEY = 'whatsapp_canal';
const DEFAULT_CANAL: CanalId = 'A';
const TTL_MS = 60_000;
let cache: { value: CanalId; expires: number } | null = null;

async function readCanal(): Promise<CanalId> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;
  let value: CanalId = DEFAULT_CANAL;
  try {
    const row = await AppConfigRepository.get(KEY);
    if (row?.value === 'A' || row?.value === 'B') value = row.value;
  } catch { /* ante error de BD, default resiliente */ }
  cache = { value, expires: now + TTL_MS };
  return value;
}

export interface CanalEstado {
  id: CanalId;
  numero: string;
  channelId: string;
  nombre: string;
  activo: boolean;
  conectado: boolean;       // true si Whapi reporta AUTH (code 4)
  estado: string;           // 'AUTH' | 'QR' | 'ERROR' | ...
  numeroDetectado: string | null;
}

/** Consulta el estado en vivo de un canal en Whapi (/health). No expone el token. */
async function checkHealth(canal: CanalId): Promise<{ conectado: boolean; estado: string; numeroDetectado: string | null }> {
  try {
    const r = await fetch('https://gate.whapi.cloud/health?wakeup=false', {
      headers: { authorization: `Bearer ${WHATSAPP_CANALES[canal].token}` },
      signal: AbortSignal.timeout(15000),
    });
    const j: any = await r.json().catch(() => ({}));
    const code = j?.status?.code;
    const text = j?.status?.text || (r.ok ? 'UNKNOWN' : `HTTP ${r.status}`);
    return { conectado: code === 4, estado: String(text), numeroDetectado: j?.user?.id ?? null };
  } catch (e: any) {
    return { conectado: false, estado: 'ERROR', numeroDetectado: null };
  }
}

export const whatsappConfigService = {
  async getCanalActivo(): Promise<CanalId> {
    return readCanal();
  },

  /** Token del canal ACTIVO — lo usan todos los puntos de envío. Cache 60s. */
  async getActiveToken(): Promise<string> {
    const canal = await readCanal();
    return WHATSAPP_CANALES[canal].token;
  },

  /** Cambia el canal activo (admin, Mantenimiento › Contingencia). Invalida cache. */
  async setCanalActivo(canal: string, actor: string): Promise<CanalId> {
    if (canal !== 'A' && canal !== 'B') {
      throw new ValidationError(`Canal inválido: ${canal} (debe ser 'A' o 'B')`);
    }
    await AppConfigRepository.set(KEY, canal, '#ffffff', actor);
    cache = null;
    return canal;
  },

  /** Estado en vivo de ambos canales + cuál está activo (para la página). Sin tokens. */
  async getEstado(): Promise<{ activo: CanalId; canales: CanalEstado[] }> {
    const [activo, hA, hB] = await Promise.all([readCanal(), checkHealth('A'), checkHealth('B')]);
    const build = (id: CanalId, h: { conectado: boolean; estado: string; numeroDetectado: string | null }): CanalEstado => ({
      id,
      numero: WHATSAPP_CANALES[id].numero,
      channelId: WHATSAPP_CANALES[id].channelId,
      nombre: WHATSAPP_CANALES[id].nombre,
      activo: id === activo,
      ...h,
    });
    return { activo, canales: [build('A', hA), build('B', hB)] };
  },
};
