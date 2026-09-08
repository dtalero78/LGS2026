import 'server-only';
import { NextResponse } from 'next/server';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { issueBienvenidaToken } from '@/lib/bienvenida-token';
import { normalizeNumeroId } from '@/lib/numeroid-normalize';
import { rateLimit } from '@/lib/rate-limit';
import { queryOne } from '@/lib/postgres';

/**
 * POST /api/public/bienvenida/[id]/verificar — PÚBLICO.
 *
 * Reapertura de la constancia una vez vencido el enlace (60 min). El cliente
 * escribe su número de documento y, si coincide, se emite un token NUEVO que
 * le abre otra ventana de 60 minutos.
 *
 * Es el mismo patrón de identidad que ya usa `/contrato/[id]` para firmar
 * (consent.service → sendConsentOtp), con dos refuerzos:
 *
 *   1. **Rate-limit** 5 intentos / 15 min por titular. Un documento son ~8-10
 *      dígitos: sin límite se prueba por fuerza bruta en minutos.
 *   2. **Comparación normalizada** (`normalizeNumeroId` en ambos lados), para
 *      que el cliente pueda escribirlo como aparece en su cédula
 *      ('18.201.897-K') y coincida con el guardado ('18201897K').
 *
 * NO revela si el titular existe ni si ya firmó: cualquier fallo responde el
 * mismo mensaje, para que la respuesta no sirva de oráculo de documentos.
 */
const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const ERROR_GENERICO = 'El número de documento no coincide.';

export const POST = handler(async (request, { params }) => {
  const body = await request.json().catch(() => ({}));
  const documento = normalizeNumeroId(body?.documento);
  if (!documento) throw new ValidationError('Ingresa tu número de documento');

  const rl = rateLimit(`bienvenida-doc:${params.id}`, MAX_INTENTOS, VENTANA_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Demasiados intentos. Espera ${Math.ceil(rl.retryAfterSec / 60)} minuto(s) antes de reintentar.`,
      },
      { status: 429 },
    );
  }

  const person = await queryOne<{ numeroId: string | null; consentimientoDeclarativo: any }>(
    `SELECT "numeroId", "consentimientoDeclarativo"
       FROM "PEOPLE"
      WHERE "_id" = $1 AND "tipoUsuario" = 'TITULAR'
      LIMIT 1`,
    [params.id],
  );

  // Sin titular, sin firma o documento distinto → misma respuesta.
  if (!person || !person.consentimientoDeclarativo) {
    throw new ValidationError(ERROR_GENERICO);
  }
  if (normalizeNumeroId(person.numeroId) !== documento) {
    throw new ValidationError(ERROR_GENERICO);
  }

  // Documento correcto: nueva ventana de 60 min (el token lleva su propio exp).
  return successResponse({ token: issueBienvenidaToken(params.id) });
});
