import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne, withTransaction } from '@/lib/postgres';
import { exigirClaveKids } from '@/lib/kids-sync-server';
import { normalizarTelefono } from '@/lib/telefono';

/**
 * POST /api/kids-sync/datos-nino — camino de VUELTA desde KIDS2026 (2026-11-11).
 *
 * En la ficha del niño de KIDS ("✏️ Editar datos") se corrigen sus datos de
 * contacto y los de su apoderado. KIDS llama aquí ANTES de guardar: si LGS
 * rechaza o no responde, no se guarda en ningún lado.
 *
 * Qué se refleja (y nada más: nombre, documento y usuario del niño, lo
 * académico y el contrato NO viajan):
 *  - el NIÑO (PEOPLE BENEFICIARIO kids): email, celular y fechaNacimiento, más su
 *    ficha ACADEMICA (si existe) y el celular de su cuenta ESTUDIANTE. El email de
 *    login NO se toca: es el de la familia y lo comparten hermanos y titular;
 *  - el APODERADO: si es una persona propia, sus campos en KIDS_INSCRIPCIONES
 *    (apoderado, apoderadoApellidos, apoderadoMail, apoderadoTelefono, parentesco);
 *    si es el TITULAR, solo su email y celular en PEOPLE (su nombre es dato del
 *    contrato), con su ACADEMICA y su login —este último solo si coincide su
 *    documento, para no mover la cuenta de otra persona con el mismo correo—.
 *
 * Es un UPDATE directo: no vuelve a avisar a KIDS (sin eco).
 *
 * Body: { externalRef, nino: { fechaNacimiento, email, telefono },
 *         apoderado: { nombres, apellidos, email, telefono, parentesco } | null }
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const correo = (v: unknown): string | null => {
  const t = String(v ?? '').trim().toLowerCase();
  if (!t) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw new ValidationError(`Correo inválido: ${t}`);
  return t;
};
const texto = (v: unknown, max: number): string | null => {
  const t = String(v ?? '').trim();
  return t ? t.slice(0, max) : null;
};

export const POST = handler(async (request) => {
  exigirClaveKids(request);
  const body = await request.json().catch(() => ({}));
  const externalRef = String(body?.externalRef || '').trim();
  if (!externalRef.includes('#')) throw new ValidationError('externalRef es obligatorio (contrato#documento)');
  const fechaNacimiento = String(body?.nino?.fechaNacimiento || '');
  if (!ISO.test(fechaNacimiento)) throw new ValidationError('nino.fechaNacimiento (YYYY-MM-DD) es obligatorio');

  const insc = await queryOne<{
    id: string; beneficiarioId: string; contrato: string | null; apoderadoDoc: string | null;
  }>(
    `SELECT k."_id" AS id, k."beneficiarioId", k."contrato", k."apoderadoDoc"
       FROM "KIDS_INSCRIPCIONES" k
      WHERE k."kidsExternalRef" = $1
      ORDER BY k."_createdDate" DESC LIMIT 1`,
    [externalRef],
  );
  if (!insc) throw new NotFoundError('Beneficiario Kids en LGS', externalRef);

  const nino = await queryOne<{ numeroId: string | null; plataforma: string | null; contrato: string | null }>(
    `SELECT "numeroId", "plataforma", "contrato" FROM "PEOPLE" WHERE "_id" = $1`,
    [insc.beneficiarioId],
  );
  if (!nino) throw new NotFoundError('Beneficiario Kids en LGS', externalRef);
  const pais = nino.plataforma;
  const ninoEmail = correo(body?.nino?.email);
  const ninoCelular = normalizarTelefono(body?.nino?.telefono, pais);

  const ap = body?.apoderado ?? null;
  const contrato = insc.contrato || nino.contrato;
  const titular = contrato
    ? await queryOne<{ _id: string; numeroId: string | null; email: string | null }>(
        `SELECT "_id", "numeroId", "email" FROM "PEOPLE"
          WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'
          ORDER BY "_createdDate" ASC LIMIT 1`,
        [contrato],
      )
    : null;
  const normDoc = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const titularEsApoderado =
    !insc.apoderadoDoc || (titular !== null && normDoc(insc.apoderadoDoc) === normDoc(titular.numeroId));

  const tablas: string[] = [];
  await withTransaction(async (client) => {
    // ── El niño ──
    await client.query(
      `UPDATE "PEOPLE" SET "email" = $2, "celular" = $3, "fechaNacimiento" = $4, "_updatedDate" = NOW()
        WHERE "_id" = $1`,
      [insc.beneficiarioId, ninoEmail, ninoCelular, fechaNacimiento],
    );
    tablas.push('PEOPLE (niño)');
    if (nino.numeroId) {
      const r = await client.query(
        `UPDATE "ACADEMICA" SET "email" = $2, "celular" = $3, "fechaNacimiento" = $4, "_updatedDate" = NOW()
          WHERE "numeroId" = $1`,
        [nino.numeroId, ninoEmail, ninoCelular, fechaNacimiento],
      );
      if (r.rowCount) tablas.push(`ACADEMICA (${r.rowCount})`);
      const u = await client.query(
        `UPDATE "USUARIOS_ROLES" SET "celular" = $2, "_updatedDate" = NOW()
          WHERE "rol" = 'ESTUDIANTE' AND UPPER(REPLACE(COALESCE("numberid", ''), '.', '')) = UPPER($1)`,
        [nino.numeroId, ninoCelular],
      );
      if (u.rowCount) tablas.push(`USUARIOS_ROLES.celular (${u.rowCount})`);
    }

    if (ap === null) return;
    const apEmail = correo(ap.email);
    const apCelular = normalizarTelefono(ap.telefono, pais);
    await client.query(
      `UPDATE "KIDS_INSCRIPCIONES" SET "parentesco" = $2, "_updatedDate" = NOW() WHERE "_id" = $1`,
      [insc.id, texto(ap.parentesco, 30)],
    );

    if (!titularEsApoderado) {
      const nombres = texto(ap.nombres, 60);
      const apellidos = texto(ap.apellidos, 60);
      if (!nombres || !apellidos) throw new ValidationError('Nombres y apellidos del apoderado son obligatorios');
      await client.query(
        `UPDATE "KIDS_INSCRIPCIONES"
            SET "apoderado" = $2, "apoderadoApellidos" = $3, "apoderadoMail" = $4,
                "apoderadoTelefono" = $5, "_updatedDate" = NOW()
          WHERE "_id" = $1`,
        [insc.id, nombres, apellidos, apEmail, apCelular],
      );
      tablas.push('KIDS_INSCRIPCIONES (apoderado)');
      return;
    }

    // El apoderado ES el titular: solo su contacto (el nombre es del contrato).
    if (titular === null) return;
    await client.query(
      `UPDATE "PEOPLE" SET "email" = COALESCE($2, "email"), "celular" = COALESCE($3, "celular"),
              "_updatedDate" = NOW()
        WHERE "_id" = $1`,
      [titular._id, apEmail, apCelular],
    );
    tablas.push('PEOPLE (titular)');
    if (titular.numeroId) {
      const r = await client.query(
        `UPDATE "ACADEMICA" SET "email" = COALESCE($2, "email"), "celular" = COALESCE($3, "celular"),
                "_updatedDate" = NOW()
          WHERE "numeroId" = $1`,
        [titular.numeroId, apEmail, apCelular],
      );
      if (r.rowCount) tablas.push(`ACADEMICA titular (${r.rowCount})`);
    }
    if (apEmail && titular.email && apEmail !== titular.email.toLowerCase() && titular.numeroId) {
      const u = await client.query(
        `UPDATE "USUARIOS_ROLES" SET "email" = $2
          WHERE LOWER("email") = LOWER($1)
            AND UPPER(REPLACE(COALESCE("numberid", ''), '.', '')) = UPPER($3)`,
        [titular.email, apEmail, titular.numeroId],
      );
      if (u.rowCount) tablas.push(`USUARIOS_ROLES titular (${u.rowCount})`);
    }
  });

  console.log(`[kids-sync/datos-nino] ${externalRef}: ${tablas.join(', ')}`);
  return successResponse({ aplicado: true, tablas });
});
