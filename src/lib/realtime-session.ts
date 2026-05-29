/**
 * OpenAI Realtime — ephemeral client secret minting (server-side).
 *
 * The browser never sees OPENAI_API_KEY. The server mints a short-lived
 * client_secret with the GA Realtime API and hands only that to the client,
 * which uses it for the WebRTC SDP exchange (POST /v1/realtime/calls).
 *
 * Mirrors the proven flow in asistente-medico-bsl (services/session.py), ported
 * to TypeScript. Instructions + tools are sent by the client via `session.update`
 * after the DataChannel opens (they are dynamic per student), so they are NOT
 * baked into the client secret here.
 */

import 'server-only';

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
// 'ash' is proven working with the GA Realtime API (see asistente-medico-bsl).
// Override with OPENAI_REALTIME_VOICE to try newer voices (marin/cedar).
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'ash';

export interface RealtimeClientSecret {
  value: string;
  model: string;
  voice: string;
}

export async function createRealtimeClientSecret(): Promise<RealtimeClientSecret> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada');
  }

  const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: REALTIME_MODEL,
        audio: { output: { voice: REALTIME_VOICE } },
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  const value = data?.value ?? data?.client_secret?.value;

  if (!res.ok || !value) {
    throw new Error(
      `No se pudo crear la sesión Realtime [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  return { value, model: REALTIME_MODEL, voice: REALTIME_VOICE };
}
