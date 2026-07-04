import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { withTransaction } from '@/lib/postgres';
import { ValidationError } from '@/lib/errors';
import { ComercialPermission } from '@/types/permissions';
import { ids } from '@/lib/id-generator';

/**
 * POST /api/postgres/matriculas/delete
 *   body: { contratos: string[], motivo?: string }
 *
 * Borra en CASCADA un contrato (titular + beneficiarios + FINANCIEROS +
 * PAGOS_TITULARES + ACADEMICA/bookings/overrides + USUARIOS_ROLES), SOLO si el
 * contrato está **SIN FIRMAR** (titular sin hashConsentimiento y sin aprobacion).
 * Cada contrato se procesa en una transacción atómica con snapshot en PURGE_LOG.
 * Defensa en profundidad: si el titular no está sin-firmar → se omite.
 * Gateado por COMERCIAL.MATRICULAS.BORRAR.
 */

interface DeleteResultItem {
  contrato: string;
  status: 'ok' | 'error' | 'no_sin_firmar' | 'sin_titular';
  error?: string;
  borrados?: Record<string, number>;
}

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, ComercialPermission.MATRICULAS_BORRAR);

  const body = await request.json().catch(() => ({}));
  const contratos = Array.isArray(body?.contratos) ? body.contratos : null;
  const motivo = (typeof body?.motivo === 'string' && body.motivo.trim())
    ? body.motivo.trim()
    : 'Borrado de matrícula sin firmar';
  if (!contratos || !contratos.length) throw new ValidationError('contratos requerido');
  if (contratos.length > 100) throw new ValidationError('Máximo 100 contratos por operación');

  const actorEmail = (session?.user as any)?.email ?? '';
  const actorNombre = (session?.user as any)?.name ?? null;
  const ipRaw = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
  const ip = ipRaw.split(',')[0].trim().slice(0, 45);
  const userAgent = request.headers.get('user-agent') || '';

  const results: DeleteResultItem[] = [];

  for (const contrato of contratos) {
    if (typeof contrato !== 'string' || !contrato.trim() || /^PRB-/i.test(contrato)) {
      results.push({ contrato: String(contrato), status: 'error', error: 'Contrato inválido' });
      continue;
    }
    try {
      const outcome = await withTransaction(async (client) => {
        const peopleSnap = await client.query(`SELECT * FROM "PEOPLE" WHERE "contrato" = $1`, [contrato]);
        const titular = peopleSnap.rows.find((p: any) => p.tipoUsuario === 'TITULAR');
        if (!titular) return { skip: 'sin_titular' as const };

        // GUARD: solo contratos SIN FIRMAR (sin consentimiento y sin aprobación).
        const firmado = (titular.hashConsentimiento || '').toString().trim() !== '';
        const aprobado = (titular.aprobacion || '').toString().trim() !== '';
        if (firmado || aprobado) return { skip: 'no_sin_firmar' as const };

        const numeroIds = Array.from(new Set(peopleSnap.rows.map((p: any) => p.numeroId).filter(Boolean)));
        const peopleIds = peopleSnap.rows.map((p: any) => p._id);
        const emails = Array.from(new Set(peopleSnap.rows.map((p: any) => (p.email || '').toLowerCase()).filter(Boolean)));

        const academicaSnap = numeroIds.length
          ? await client.query(`SELECT * FROM "ACADEMICA" WHERE "numeroId" = ANY($1::text[])`, [numeroIds])
          : { rows: [] };
        const academicaIds = academicaSnap.rows.map((a: any) => a._id);
        const bookingsSnap = academicaIds.length
          ? await client.query(`SELECT * FROM "ACADEMICA_BOOKINGS" WHERE "studentId" = ANY($1::text[]) OR "idEstudiante" = ANY($1::text[])`, [academicaIds])
          : { rows: [] };
        const finSnap = await client.query(`SELECT * FROM "FINANCIEROS" WHERE "contrato" = $1`, [contrato]);
        const pagosSnap = (peopleIds.length || numeroIds.length)
          ? await client.query(
              `SELECT * FROM "PAGOS_TITULARES" WHERE ("idPeople" = ANY($1::text[]) OR "numeroId" = ANY($2::text[]))`,
              [peopleIds.length ? peopleIds : ['__none__'], numeroIds.length ? numeroIds : ['__none__']])
          : { rows: [] };
        const overridesSnap = academicaIds.length
          ? await client.query(`SELECT * FROM "STEP_OVERRIDES" WHERE "studentId" = ANY($1::text[])`, [academicaIds])
          : { rows: [] };
        const complemSnap = academicaIds.length
          ? await client.query(`SELECT * FROM "COMPLEMENTARIA_ATTEMPTS" WHERE "studentId" = ANY($1::text[])`, [academicaIds]).catch(() => ({ rows: [] }))
          : { rows: [] };
        const usuariosSnap = emails.length
          ? await client.query(`SELECT * FROM "USUARIOS_ROLES" WHERE LOWER("email") = ANY($1::text[])`, [emails])
          : { rows: [] };

        const titularNombre = `${titular.primerNombre || ''} ${titular.primerApellido || ''}`.trim();
        const snapshot = {
          people: peopleSnap.rows, academica: academicaSnap.rows, bookings: bookingsSnap.rows,
          financieros: finSnap.rows, pagos: pagosSnap.rows, stepOverrides: overridesSnap.rows,
          complementarias: complemSnap.rows, usuariosRoles: usuariosSnap.rows,
        };
        const borrados = {
          people: peopleSnap.rows.length, academica: academicaSnap.rows.length, bookings: bookingsSnap.rows.length,
          financieros: finSnap.rows.length, pagos: pagosSnap.rows.length, stepOverrides: overridesSnap.rows.length,
          complementarias: complemSnap.rows.length, usuariosRoles: usuariosSnap.rows.length,
        };

        await client.query(
          `INSERT INTO "PURGE_LOG"
             ("_id","tipoPurga","contrato","titularId","titularNombre","snapshot","motivo",
              "realizadoPor","realizadoPorNombre","ip","userAgent","filasBorradas")
           VALUES ($1,'MATRICULA_SIN_FIRMAR',$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb)`,
          [ids.audit(), contrato, titular._id, titularNombre, JSON.stringify(snapshot), motivo,
           actorEmail, actorNombre, ip, userAgent, JSON.stringify(borrados)]);

        if (academicaIds.length) {
          await client.query(`DELETE FROM "STEP_OVERRIDES" WHERE "studentId" = ANY($1::text[])`, [academicaIds]);
          await client.query(`DELETE FROM "COMPLEMENTARIA_ATTEMPTS" WHERE "studentId" = ANY($1::text[])`, [academicaIds]).catch(() => null);
          await client.query(`DELETE FROM "ACADEMICA_BOOKINGS" WHERE "studentId" = ANY($1::text[]) OR "idEstudiante" = ANY($1::text[])`, [academicaIds]);
        }
        if (peopleIds.length || numeroIds.length) {
          await client.query(
            `DELETE FROM "PAGOS_TITULARES" WHERE ("idPeople" = ANY($1::text[]) OR "numeroId" = ANY($2::text[]))`,
            [peopleIds.length ? peopleIds : ['__none__'], numeroIds.length ? numeroIds : ['__none__']]);
        }
        if (numeroIds.length) await client.query(`DELETE FROM "ACADEMICA" WHERE "numeroId" = ANY($1::text[])`, [numeroIds]);
        await client.query(`DELETE FROM "FINANCIEROS" WHERE "contrato" = $1`, [contrato]);
        if (emails.length) await client.query(`DELETE FROM "USUARIOS_ROLES" WHERE LOWER("email") = ANY($1::text[])`, [emails]);
        await client.query(`DELETE FROM "PEOPLE" WHERE "contrato" = $1`, [contrato]);

        return { borrados };
      });

      if ((outcome as any).skip === 'sin_titular') results.push({ contrato, status: 'sin_titular', error: 'No se encontró el titular del contrato' });
      else if ((outcome as any).skip === 'no_sin_firmar') results.push({ contrato, status: 'no_sin_firmar', error: 'El contrato está firmado o aprobado; solo se pueden borrar contratos SIN FIRMAR' });
      else results.push({ contrato, status: 'ok', borrados: (outcome as any).borrados });
    } catch (err: any) {
      console.error(`[matriculas/delete] ${contrato}:`, err?.message || err);
      results.push({ contrato, status: 'error', error: err?.message || 'Error desconocido' });
    }
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const omitidos = results.filter(r => r.status === 'no_sin_firmar').length;
  const failed = results.filter(r => r.status === 'error' || r.status === 'sin_titular').length;
  return successResponse({
    message: `Borrado: ${ok} OK · ${omitidos} omitidos (firmados) · ${failed} fallidos`,
    results, ok, omitidos, failed, total: results.length,
  });
});
