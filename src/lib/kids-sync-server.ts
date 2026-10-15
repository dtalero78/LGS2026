import 'server-only';
import { timingSafeEqual } from 'crypto';
import { queryOne } from '@/lib/postgres';
import { NotFoundError, UnauthorizedError } from '@/lib/errors';

/**
 * Lado RECEPTOR de las llamadas de KIDS2026 a LGS (/api/kids-sync/*): OnHold y
 * extensión de vigencia hechos en KIDS que tienen que quedar igual aquí.
 *
 * Autenticación de servicio: header `x-api-key` = KIDS_INTAKE_API_KEY (la misma
 * clave compartida con la que LGS entra a KIDS). Sin clave configurada → 401.
 */

export function exigirClaveKids(request: Request): void {
  const esperada = process.env.KIDS_INTAKE_API_KEY || '';
  const recibida = request.headers.get('x-api-key');
  if (!esperada || !recibida) throw new UnauthorizedError('Clave de servicio inválida');
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedError('Clave de servicio inválida');
  }
}

/** `_id` (PEOPLE) del beneficiario Kids a partir del N° de reserva "contrato#documento". 404 si no existe. */
export async function beneficiarioKidsDeRef(externalRef: string): Promise<string> {
  const insc = await queryOne<{ id: string }>(
    `SELECT k."beneficiarioId" AS id
       FROM "KIDS_INSCRIPCIONES" k JOIN "PEOPLE" p ON p."_id" = k."beneficiarioId"
      WHERE k."kidsExternalRef" = $1
      ORDER BY k."_createdDate" DESC LIMIT 1`,
    [externalRef],
  );
  if (insc?.id) return insc.id;
  const [contrato, doc] = externalRef.split('#');
  if (contrato && doc) {
    const p = await queryOne<{ id: string }>(
      `SELECT "_id" AS id FROM "PEOPLE"
        WHERE "contrato" = $1 AND "numeroId" = $2 AND "tipoUsuario" = 'BENEFICIARIO' AND "kids" = true
        ORDER BY "_createdDate" DESC LIMIT 1`,
      [contrato, doc],
    );
    if (p?.id) return p.id;
  }
  throw new NotFoundError('Beneficiario Kids en LGS', externalRef);
}
