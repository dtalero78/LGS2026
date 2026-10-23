import 'server-only';
import crypto from 'crypto';

/**
 * Firma del enlace "Crear Contrato" del CRM (`/api/auth/crm-bridge`).
 *
 *  - v1 (sin `v`):  HMAC_SHA256(secret, `${email}:${ts}`)
 *  - v2 (`v=2`):    HMAC_SHA256(secret, `${email}:${ts}:${fe}|${tm}|${ge}|${gd}|${s1}|${fil}|${ori}`)
 *
 * v2 trae la escalera comercial del día de la matrícula para el Libro de Producción.
 * Los valores van SIN codificar dentro de la firma; un campo vacío es la cadena vacía.
 * La firma se verifica dos veces: en el puente (con caducidad de 5 min) y otra vez al
 * crear el contrato, porque los campos viajan por el navegador hasta el POST.
 */

export const CRM_LADDER_KEYS = ['fe', 'tm', 'ge', 'gd', 's1', 'fil', 'ori'] as const;
export type CrmLadderKey = (typeof CRM_LADDER_KEYS)[number];

/** Lo que el formulario reenvía al crear el contrato (tal cual llegó del CRM). */
export type CrmBridgeEnvelope = { email: string; ts: string; token: string } & Record<CrmLadderKey, string>;

/** Parámetro del enlace → columna de PEOPLE (titular) y su largo máximo. */
export const CRM_LADDER_COLUMNS: Record<CrmLadderKey, { col: string; max: number }> = {
  fe: { col: 'fullExecutive', max: 150 },
  tm: { col: 'jefeGrupo', max: 150 },
  ge: { col: 'gerente', max: 150 },
  gd: { col: 'gerenteDivision', max: 150 },
  s1: { col: 'salesManager', max: 150 },
  fil: { col: 'filial', max: 150 },
  ori: { col: 'origenMatricula', max: 200 },
};

function hmac(payload: string): string | null {
  const secret = process.env.CRM_BRIDGE_SECRET || '';
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function crmBridgePayload(email: string, ts: string, ladder?: Record<CrmLadderKey, string>): string {
  if (!ladder) return `${email}:${ts}`;
  return `${email}:${ts}:${CRM_LADDER_KEYS.map(k => ladder[k] ?? '').join('|')}`;
}

export function verifyCrmBridge(email: string, ts: string, token: string, ladder?: Record<CrmLadderKey, string>): boolean {
  const expected = hmac(crmBridgePayload(email, ts, ladder));
  return !!expected && safeEqual(expected, token);
}

/**
 * Escalera verificada de lo que reenvió el formulario, o null si no vino, la firma
 * no cuadra o es de otro asesor (el email firmado debe ser `titular.asesor`).
 */
export function ladderFromEnvelope(env: unknown, asesorEmail: string): Record<CrmLadderKey, string> | null {
  if (!env || typeof env !== 'object') return null;
  const e = env as Partial<CrmBridgeEnvelope>;
  if (typeof e.email !== 'string' || typeof e.ts !== 'string' || typeof e.token !== 'string') return null;
  const ladder = Object.fromEntries(
    CRM_LADDER_KEYS.map(k => [k, typeof e[k] === 'string' ? (e[k] as string) : ''])) as Record<CrmLadderKey, string>;
  if (!verifyCrmBridge(e.email, e.ts, e.token, ladder)) return null;
  if (e.email.trim().toLowerCase() !== asesorEmail.trim().toLowerCase()) return null;
  return ladder;
}
