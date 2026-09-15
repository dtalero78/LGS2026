/**
 * Recibo Extract Service — "Leer recibo" de inscripciones.
 *
 * Extrae los datos de un comprobante de pago (imagen o PDF) usando OpenAI
 * gpt-4o-mini (visión), la misma llave OPENAI_API_KEY que ya usan las
 * actividades complementarias. Los campos se guardan en FINANCIEROS (columnas
 * recibo*), de donde los leen las demás consultas.
 *
 * Gateado por el flag APP_CONFIG.leer_recibo_activo (default OFF); SUPER_ADMIN/
 * ADMIN pueden usarlo aunque el flag esté apagado (para probar).
 */

import 'server-only';
import { query, queryOne } from '@/lib/postgres';
import { ValidationError, NotFoundError } from '@/lib/errors';

const FLAG_KEY = 'leer_recibo_activo';
const OPENAI_MODEL = 'gpt-4o-mini';

// ── Flag (cache 60s) ─────────────────────────────────────────────────────────
let flagCache: { v: boolean; exp: number } | null = null;
export async function isLeerReciboActivo(): Promise<boolean> {
  const now = Date.now();
  if (flagCache && flagCache.exp > now) return flagCache.v;
  const row = await queryOne<{ value: string }>(
    `SELECT "value" FROM "APP_CONFIG" WHERE "key" = $1`, [FLAG_KEY]
  ).catch(() => null);
  const v = row?.value === 'true';
  flagCache = { v, exp: now + 60_000 };
  return v;
}

// ── Extracción ───────────────────────────────────────────────────────────────

export interface ReciboExtraido {
  medioPago: string | null;
  fecha: string | null;         // YYYY-MM-DD
  monto: number | null;
  referencia: string | null;
  banco: string | null;
  cuenta: string | null;
  documento: string | null;
  beneficiario: string | null;
  confianza: number | null;     // 0..1
}

const PROMPT = `Eres un extractor de datos de COMPROBANTES DE PAGO de Latinoamérica (Chile, Colombia, Ecuador): WebPay/Transbank, Nequi, Daviplata, PSE, transferencias bancarias (Bancolombia, AV Villas, Banco Guayaquil, Banco de Bogotá, etc.).

Analiza el comprobante adjunto y devuelve EXCLUSIVAMENTE un objeto JSON válido (sin texto adicional, sin markdown, sin explicación) con EXACTAMENTE estas claves:
{
  "medioPago": string|null,    // normalizado: "WebPay", "Nequi", "Daviplata", "PSE", "Transferencia", "Efectivo", "Tarjeta". Si es una transferencia bancaria, usa "Transferencia".
  "fecha": string|null,        // fecha del pago en formato YYYY-MM-DD. Interpreta "14 De Septiembre De 2026", "12/9/2026", "14-09-2026", "11/09/2026 13:27".
  "monto": number|null,        // valor pagado, SOLO el número entero/decimal sin símbolos ni separadores de miles: 715000, 99, 4000, 279000.
  "referencia": string|null,   // referencia, orden de pago, número de autorización o número de comprobante.
  "banco": string|null,        // banco emisor o destino si aparece.
  "cuenta": string|null,       // número de cuenta destino si aparece.
  "documento": string|null,    // documento/RUT/cédula del pagador si aparece.
  "beneficiario": string|null, // a quién se pagó.
  "confianza": number          // 0 a 1: qué tan seguro estás de la extracción.
}

Reglas ESTRICTAS:
- Si un campo no aparece en el comprobante, usa null. NUNCA inventes datos.
- Si el archivo NO es un comprobante de pago, pon "confianza": 0 y todo lo demás null.
- Responde ÚNICAMENTE el objeto JSON.`;

async function callOpenAI(fileContent: any): Promise<ReciboExtraido> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ValidationError('OPENAI_API_KEY no está configurada en el entorno.');

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey });

  let response: any;
  try {
    const params: any = {
      model: OPENAI_MODEL,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, fileContent] }],
    };
    response = await client.chat.completions.create(params);
  } catch (e: any) {
    throw new ValidationError(`El extractor de recibos falló: ${e?.message || e}`);
  }

  const text = String(response?.choices?.[0]?.message?.content ?? '').trim();
  const jsonStr = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
  let parsed: any;
  try { parsed = JSON.parse(jsonStr); }
  catch { throw new ValidationError('El extractor no devolvió un JSON válido.'); }

  const num = (x: any) => (x === null || x === undefined || x === '' ? null : Number(x));
  return {
    medioPago:    parsed.medioPago ?? null,
    fecha:        (typeof parsed.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)) ? parsed.fecha : null,
    monto:        Number.isFinite(num(parsed.monto)) ? (num(parsed.monto) as number) : null,
    referencia:   parsed.referencia ?? null,
    banco:        parsed.banco ?? null,
    cuenta:       parsed.cuenta ?? null,
    documento:    parsed.documento ?? null,
    beneficiario: parsed.beneficiario ?? null,
    confianza:    Number.isFinite(num(parsed.confianza)) ? (num(parsed.confianza) as number) : null,
  };
}

/** Descarga el recibo desde su URL (DO Spaces) y lo manda a OpenAI. */
export async function extraerReciboDesdeUrl(url: string): Promise<ReciboExtraido> {
  if (!url || !/^https?:\/\//i.test(url)) throw new ValidationError('URL del recibo inválida.');

  const r = await fetch(url);
  if (!r.ok) throw new ValidationError(`No se pudo descargar el recibo (${r.status}).`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw new ValidationError('El recibo supera el tamaño máximo (8MB).');
  const b64 = buf.toString('base64');

  let mediaType = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!mediaType || mediaType === 'application/octet-stream') {
    if (/\.pdf(\?|$)/i.test(url)) mediaType = 'application/pdf';
    else if (/\.png(\?|$)/i.test(url)) mediaType = 'image/png';
    else if (/\.(jpe?g)(\?|$)/i.test(url)) mediaType = 'image/jpeg';
    else if (/\.webp(\?|$)/i.test(url)) mediaType = 'image/webp';
    else mediaType = 'image/jpeg';
  }

  let fileContent: any;
  if (mediaType === 'application/pdf') {
    // OpenAI acepta PDFs como content part de tipo "file" (base64 data URL).
    fileContent = { type: 'file', file: { filename: 'recibo.pdf', file_data: `data:application/pdf;base64,${b64}` } };
  } else {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mt = allowed.includes(mediaType) ? mediaType : 'image/jpeg';
    fileContent = { type: 'image_url', image_url: { url: `data:${mt};base64,${b64}` } };
  }
  return callOpenAI(fileContent);
}

// ── Guardado en FINANCIEROS ──────────────────────────────────────────────────

export interface GuardarReciboOpts {
  contrato: string;
  url: string | null;
  campos: Partial<ReciboExtraido>;
  actor: string;
}

export async function guardarReciboEnFinanciero(opts: GuardarReciboOpts): Promise<void> {
  const contrato = String(opts.contrato || '').trim();
  if (!contrato) throw new ValidationError('contrato es requerido.');

  const c = opts.campos || {};
  const fecha = (typeof c.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) ? c.fecha : null;
  const monto = (c.monto === null || c.monto === undefined || !Number.isFinite(Number(c.monto))) ? null : Number(c.monto);
  const extraido = {
    ...c,
    url: opts.url ?? null,
    extraidoPor: opts.actor,
    extraidoEn: new Date().toISOString(),
  };

  const res = await query(
    `UPDATE "FINANCIEROS"
        SET "reciboUrl"        = $1,
            "reciboMedioPago"  = $2,
            "reciboFecha"      = $3::date,
            "reciboMonto"      = $4,
            "reciboReferencia" = $5,
            "reciboBanco"      = $6,
            "reciboExtraido"   = $7::jsonb,
            "_updatedDate"     = NOW()
      WHERE "contrato" = $8`,
    [opts.url ?? null, c.medioPago ?? null, fecha, monto, c.referencia ?? null, c.banco ?? null, JSON.stringify(extraido), contrato]
  );

  if ((res.rowCount ?? 0) === 0) {
    throw new NotFoundError('FINANCIEROS', `contrato ${contrato}`);
  }
}
