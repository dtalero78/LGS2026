import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { query } from '@/lib/postgres';
import { ids } from '@/lib/id-generator';
import { NotFoundError, ValidationError } from '@/lib/errors';

// Normaliza el documento igual que el resto de la plataforma: MAYÚSCULAS sin
// puntos, guiones ni espacios (así '15.969.643-K' y '15969643K' son el mismo).
const norm = (v: any) => String(v || '').toUpperCase().replace(/[.\s-]/g, '');
const soloDigitos = (v: any) => String(v || '').replace(/\D/g, '') || null;

type BenefInput = {
  primerNombre?: string; segundoNombre?: string;
  primerApellido?: string; segundoApellido?: string;
  numeroId?: string; email?: string; celular?: string;
};

async function findTitular(contrato: string) {
  const r = await query(
    `SELECT "_id","primerNombre","primerApellido","numeroId","plataforma","contrato",
            "fechaContrato","finalContrato","vigencia","tipoPersona"
       FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' LIMIT 1`,
    [contrato]
  );
  return r.rows[0] || null;
}

/**
 * GET /api/admin/cargar-beneficiarios/lookup?contrato=01-15979-26
 * Devuelve el titular del contrato + cuántos beneficiarios tiene + los numeroId
 * (normalizados) ya existentes, para que la UI marque duplicados en vivo.
 */
export const GET = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CARGAR_BENEFICIARIOS);
  const contrato = new URL(request.url).searchParams.get('contrato')?.trim() || '';
  if (!contrato) throw new ValidationError('Debe indicar el número de contrato');

  const titular = await findTitular(contrato);
  if (!titular) throw new NotFoundError(`No se encontró un titular para el contrato ${contrato}`);

  const benef = await query(
    `SELECT UPPER(REGEXP_REPLACE("numeroId",'[.\\s-]','','g')) AS n,
            (COALESCE("primerNombre",'')||' '||COALESCE("primerApellido",'')) AS nombre
       FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" <> 'TITULAR'`,
    [contrato]
  );

  return successResponse({
    titular,
    beneficiariosActuales: benef.rows.length,
    numeroIdsExistentes: benef.rows.map(r => r.n),
  });
});

/**
 * POST /api/admin/cargar-beneficiarios
 * Body: { contrato, beneficiarios: [{primerNombre, segundoNombre, primerApellido,
 *         segundoApellido, numeroId, email, celular}] }
 *
 * Crea los beneficiarios que NO existan (por numeroId normalizado) heredando
 * titularId/contrato/plataforma/fechas/vigencia del titular. Idempotente: re-correr
 * omite los que ya existen.
 */
export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CARGAR_BENEFICIARIOS);
  const body = await request.json();
  const contrato = String(body?.contrato || '').trim();
  const lista: BenefInput[] = Array.isArray(body?.beneficiarios) ? body.beneficiarios : [];

  if (!contrato) throw new ValidationError('Debe indicar el número de contrato');
  if (!lista.length) throw new ValidationError('La lista de beneficiarios está vacía');

  const titular = await findTitular(contrato);
  if (!titular) throw new NotFoundError(`No se encontró un titular para el contrato ${contrato}`);

  // Filtra filas sin datos mínimos (nombre + documento).
  const validas = lista.filter(b => norm(b.numeroId) && (b.primerNombre || '').trim());
  if (!validas.length) throw new ValidationError('Ninguna fila tiene nombre y número de identificación');

  // numeroId ya existentes en PEOPLE (cualquier contrato) → se omiten.
  const normList = validas.map(b => norm(b.numeroId));
  const existRows = await query(
    `SELECT UPPER(REGEXP_REPLACE("numeroId",'[.\\s-]','','g')) AS n
       FROM "PEOPLE" WHERE UPPER(REGEXP_REPLACE("numeroId",'[.\\s-]','','g')) = ANY($1)`,
    [normList]
  );
  const existentes = new Set(existRows.rows.map(r => r.n));

  const detalle: Array<{ numeroId: string; nombre: string; estado: string; error?: string }> = [];
  let insertados = 0, omitidos = 0, fallidos = 0;
  const vistos = new Set<string>(); // evita duplicados dentro del mismo lote

  for (const b of validas) {
    const nid = norm(b.numeroId);
    const nombre = `${b.primerNombre || ''} ${b.primerApellido || ''}`.trim();
    if (existentes.has(nid) || vistos.has(nid)) {
      omitidos++; detalle.push({ numeroId: nid, nombre, estado: 'omitido' });
      continue;
    }
    vistos.add(nid);
    try {
      await query(
        `INSERT INTO "PEOPLE" ("_id","numeroId","primerNombre","segundoNombre","primerApellido","segundoApellido",
           "email","celular","titularId","tipoUsuario","contrato","plataforma","estadoInactivo",
           "vigencia","fechaContrato","finalContrato","sence","kids","origen","_createdDate","_updatedDate")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'BENEFICIARIO',$10,$11,false,$12,$13,$14,false,false,'POSTGRES',NOW(),NOW())`,
        [ids.person(), nid, b.primerNombre, b.segundoNombre || null, b.primerApellido || null, b.segundoApellido || null,
         (b.email || '').trim() || null, soloDigitos(b.celular), titular._id, contrato, titular.plataforma || null,
         titular.vigencia || null, titular.fechaContrato || null, titular.finalContrato || null]
      );
      insertados++; detalle.push({ numeroId: nid, nombre, estado: 'insertado' });
    } catch (e: any) {
      fallidos++; detalle.push({ numeroId: nid, nombre, estado: 'error', error: e?.message || 'error' });
    }
  }

  return successResponse({ contrato, insertados, omitidos, fallidos, detalle });
});
