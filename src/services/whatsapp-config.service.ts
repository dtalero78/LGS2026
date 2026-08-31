import 'server-only';
import { AppConfigRepository } from '@/repositories/config.repository';
import { ValidationError } from '@/lib/errors';

/**
 * Contingencia de canales de WhatsApp (Whapi) — selección de canal POR TIPO DE
 * MENSAJE.
 *
 * La plataforma tiene DOS canales/números en Whapi. Si uno se cae (sesión en
 * estado "QR" = deslogueado), lo que sale por ese número falla. Desde
 * Mantenimiento › Contingencia se elige, **por cada tipo de mensaje**, por cuál
 * canal sale. Se guarda un mapa `tipo → 'A'|'B'` en APP_CONFIG (`whatsapp_canales`,
 * JSON), togglable sin deploy (efecto ≤60s por cache).
 *
 * Defaults = el reparto histórico (antes de la caída del 2026-08-29): los flujos
 * críticos por A (+56 9 5770 3724) y bienvenida/reagendar por B (+56 9 4267 9066).
 */

export type CanalId = 'A' | 'B';

/** Los 2 canales. Los tokens ya viven en git (fallbacks históricos). */
export const WHATSAPP_CANALES: Record<CanalId, {
  token: string; numero: string; channelId: string; nombre: string;
}> = {
  A: { token: 'VSyDX4j7ooAJ7UGOhz8lGplUVDDs2EYj', numero: '+56 9 5770 3724', channelId: 'SPDRMN-67FL6', nombre: 'Coordinador Servicio al usuario' },
  B: { token: 'I1s8u9FihgMttIDRvRDoMpOJB1LzPgtx', numero: '+56 9 4267 9066', channelId: 'DEADPL-QSNG2', nombre: "Let's Go Speak" },
};

export type MessageTipo =
  | 'firma' | 'contrato_pdf' | 'solicitar_firma' | 'password'
  | 'bienvenida_aprobar' | 'masivo' | 'exam_intern' | 'bienvenida' | 'reagendar';

/** Catálogo de tipos de mensaje configurables + su canal por defecto. */
export const MESSAGE_TIPOS: { key: MessageTipo; label: string; descripcion: string; default: CanalId }[] = [
  { key: 'firma',              label: 'OTP de firma del contrato', descripcion: 'Código para firmar el consentimiento', default: 'A' },
  { key: 'contrato_pdf',       label: 'PDF del contrato',          descripcion: 'Envío del contrato en PDF',            default: 'A' },
  { key: 'solicitar_firma',    label: 'Solicitar firma',           descripcion: 'Aviso "tu contrato ya está listo"',    default: 'A' },
  { key: 'password',           label: 'OTP recuperar contraseña',  descripcion: 'Código para restablecer la clave',     default: 'A' },
  { key: 'bienvenida_aprobar', label: 'Bienvenida al aprobar',     descripcion: 'Link de registro al aprobar beneficiario', default: 'B' },
  { key: 'masivo',             label: 'Envío masivo',              descripcion: 'Mensajería masiva por plantilla',      default: 'B' },
  { key: 'exam_intern',        label: 'Exam. Internacional',       descripcion: 'Confirmación de examen internacional', default: 'B' },
  { key: 'bienvenida',         label: 'Mensaje de Bienvenida',     descripcion: 'Bienvenida / crear solo perfil',       default: 'B' },
  { key: 'reagendar',          label: 'Reagendar',                 descripcion: 'Reagendar clase',                      default: 'B' },
];

const KEY = 'whatsapp_canales';
const DEFAULT_MAP = Object.fromEntries(MESSAGE_TIPOS.map(t => [t.key, t.default])) as Record<MessageTipo, CanalId>;
const TTL_MS = 60_000;
let cache: { value: Record<MessageTipo, CanalId>; expires: number } | null = null;

async function readMap(): Promise<Record<MessageTipo, CanalId>> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;
  const map: Record<MessageTipo, CanalId> = { ...DEFAULT_MAP };
  try {
    const row = await AppConfigRepository.get(KEY);
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      for (const t of MESSAGE_TIPOS) {
        if (parsed?.[t.key] === 'A' || parsed?.[t.key] === 'B') map[t.key] = parsed[t.key];
      }
    }
  } catch { /* ante error de BD/parseo, defaults resilientes */ }
  cache = { value: map, expires: now + TTL_MS };
  return map;
}

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
  } catch {
    return { conectado: false, estado: 'ERROR', numeroDetectado: null };
  }
}

export interface CanalEstado {
  id: CanalId; numero: string; channelId: string; nombre: string;
  conectado: boolean; estado: string; numeroDetectado: string | null;
}

export const whatsappConfigService = {
  /** Canal configurado para un tipo de mensaje. Cache 60s. */
  async getCanalDeTipo(tipo: MessageTipo): Promise<CanalId> {
    const map = await readMap();
    return map[tipo] ?? DEFAULT_MAP[tipo] ?? 'A';
  },

  /** Token del canal del tipo indicado — lo usan los puntos de envío. */
  async getActiveToken(tipo?: MessageTipo): Promise<string> {
    const canal: CanalId = tipo ? await this.getCanalDeTipo(tipo) : 'A';
    return WHATSAPP_CANALES[canal].token;
  },

  /** Cambia el canal de UN tipo (admin). Invalida cache. Devuelve el mapa nuevo. */
  async setCanalDeTipo(tipo: string, canal: string, actor: string): Promise<Record<MessageTipo, CanalId>> {
    if (!MESSAGE_TIPOS.some(t => t.key === tipo)) throw new ValidationError(`Tipo de mensaje inválido: ${tipo}`);
    if (canal !== 'A' && canal !== 'B') throw new ValidationError(`Canal inválido: ${canal} (debe ser 'A' o 'B')`);
    const map = await readMap();
    const next = { ...map, [tipo as MessageTipo]: canal as CanalId };
    await AppConfigRepository.set(KEY, JSON.stringify(next), '#ffffff', actor);
    cache = null;
    return next;
  },

  /** Estado en vivo de ambos canales + el canal asignado a cada tipo. Sin tokens. */
  async getEstado(): Promise<{
    canales: CanalEstado[];
    tipos: { key: MessageTipo; label: string; descripcion: string; canal: CanalId }[];
  }> {
    const [map, hA, hB] = await Promise.all([readMap(), checkHealth('A'), checkHealth('B')]);
    const canales: CanalEstado[] = (['A', 'B'] as CanalId[]).map(id => ({
      id, numero: WHATSAPP_CANALES[id].numero, channelId: WHATSAPP_CANALES[id].channelId,
      nombre: WHATSAPP_CANALES[id].nombre, ...(id === 'A' ? hA : hB),
    }));
    const tipos = MESSAGE_TIPOS.map(t => ({ key: t.key, label: t.label, descripcion: t.descripcion, canal: map[t.key] }));
    return { canales, tipos };
  },
};
