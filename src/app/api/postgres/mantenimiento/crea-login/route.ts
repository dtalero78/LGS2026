import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query, queryMany, queryOne } from '@/lib/postgres';
import { ids } from '@/lib/id-generator';
import { ForbiddenError, ValidationError, NotFoundError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Crea/activa el login (USUARIOS_ROLES) de un usuario que no tiene acceso.
// Replica el INSERT de /api/nuevo-usuario/[id]: password en texto plano, rol
// ESTUDIANTE, activo=true. Solo SUPER_ADMIN/ADMIN.

function isAdmin(session: any): boolean {
  const role = String(session?.user?.role ?? '');
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

function normEmail(v: any): string {
  return String(v ?? '').replace(/[^\x20-\x7E]/g, '').trim().toLowerCase();
}
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const nombreDe = (p: any) =>
  [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

// ── GET /api/postgres/mantenimiento/crea-login?q=texto ────────────────────────
// Busca personas por documento / nombre / contrato y devuelve su estado de login.
export const GET = handlerWithAuth(async (req, _ctx, session) => {
  if (!isAdmin(session)) throw new ForbiddenError('No autorizado');

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return successResponse({ resultados: [] });
  const like = `%${q}%`;

  const people = await queryMany<any>(
    `SELECT "_id","numeroId","primerNombre","segundoNombre","primerApellido","segundoApellido",
            "tipoUsuario","email","celular","contrato","estado","estadoInactivo","nivel","step"
       FROM "PEOPLE"
      WHERE "numeroId" ILIKE $1
         OR "contrato" ILIKE $1
         OR (COALESCE("primerNombre",'') || ' ' || COALESCE("primerApellido",'')) ILIKE $1
      ORDER BY CASE WHEN "tipoUsuario" IN ('BENEFICIARIO','BENEFICIARIA') THEN 0 ELSE 1 END,
               "primerApellido" ASC
      LIMIT 30`,
    [like]);

  const nums = [...new Set(people.map(p => String(p.numeroId)).filter(Boolean))];
  const emails = [...new Set(people.map(p => normEmail(p.email)).filter(Boolean))];
  const logins = (nums.length || emails.length)
    ? await queryMany<any>(
        `SELECT "email","activo","numberid","rol" FROM "USUARIOS_ROLES"
           WHERE "numberid" = ANY($1) OR LOWER("email") = ANY($2)`,
        [nums.length ? nums : [''], emails.length ? emails : ['']])
    : [];
  const byNum = new Map<string, any>();
  const byEmail = new Map<string, any>();
  for (const l of logins) {
    if (l.numberid) byNum.set(String(l.numberid), l);
    if (l.email) byEmail.set(String(l.email).toLowerCase(), l);
  }

  // ¿Tiene registro en ACADEMICA? (el panel del estudiante resuelve por ACADEMICA).
  const acadRows = nums.length
    ? await queryMany<any>(`SELECT DISTINCT "numeroId" FROM "ACADEMICA" WHERE "numeroId" = ANY($1)`, [nums])
    : [];
  const acadSet = new Set(acadRows.map(r => String(r.numeroId)));

  const resultados = people.map(p => {
    const email = normEmail(p.email);
    const login = byNum.get(String(p.numeroId)) || (email && byEmail.get(email)) || null;
    return {
      peopleId: p._id,
      numeroId: p.numeroId,
      nombre: nombreDe(p),
      tipoUsuario: p.tipoUsuario,
      email: p.email || null,
      celular: p.celular || null,
      contrato: p.contrato || null,
      nivel: p.nivel || null,
      step: p.step || null,
      estado: p.estado || null,
      estadoInactivo: p.estadoInactivo === true,
      tieneLogin: !!login,
      loginActivo: login ? login.activo === true : null,
      loginEmail: login?.email || null,
      tieneAcademica: acadSet.has(String(p.numeroId)),
    };
  });

  return successResponse({ resultados });
});

// ── POST /api/postgres/mantenimiento/crea-login ───────────────────────────────
// body: { peopleId?, numeroId?, email?, password? } → crea/activa el login.
export const POST = handlerWithAuth(async (req, _ctx, session) => {
  if (!isAdmin(session)) throw new ForbiddenError('No autorizado');

  const body = await req.json().catch(() => ({}));
  const peopleId = String(body?.peopleId ?? '').trim();
  const numeroId = String(body?.numeroId ?? '').trim();
  if (!peopleId && !numeroId) throw new ValidationError('Falta peopleId o numeroId');

  const person = peopleId
    ? await queryOne<any>(`SELECT * FROM "PEOPLE" WHERE "_id" = $1`, [peopleId])
    : await queryOne<any>(
        `SELECT * FROM "PEOPLE" WHERE "numeroId" = $1
           ORDER BY CASE WHEN "tipoUsuario" IN ('BENEFICIARIO','BENEFICIARIA') THEN 0 ELSE 1 END LIMIT 1`,
        [numeroId]);
  if (!person) throw new NotFoundError('PEOPLE', peopleId || numeroId);

  // Email: el del usuario, o el que envíe el admin (para corregir/completar).
  const email = normEmail(body?.email || person.email);
  if (!email) throw new ValidationError('El usuario no tiene email; ingresa uno para crear el login.');
  if (!emailOk(email)) throw new ValidationError('El email no es válido (ej: usuario@correo.com).');

  const password = (String(body?.password ?? '').trim()) || String(person.numeroId ?? '').trim();
  if (!password) throw new ValidationError('No hay contraseña ni documento para usar como clave.');

  const nombre = nombreDe(person);

  await query(
    `INSERT INTO "USUARIOS_ROLES"
       ("_id","email","password","nombre","rol","activo","numberid","contrato","celular","perfilActualizado","_createdDate","_updatedDate")
     VALUES ($1,$2,$3,$4,'ESTUDIANTE',true,$5,$6,$7,NOW(),NOW(),NOW())
     ON CONFLICT ("email") DO UPDATE
       SET "password"=$3,"nombre"=$4,"rol"='ESTUDIANTE',"activo"=true,
           "numberid"=$5,"contrato"=$6,"celular"=$7,"_updatedDate"=NOW()`,
    [
      ids.person(), email, password, nombre,
      person.numeroId || null, person.contrato || null, person.celular || null,
    ]);

  // Si NO tiene registro en ACADEMICA, se crea uno (nivel WELCOME) — sin él, el
  // panel del estudiante no encuentra su ficha académica y queda inservible.
  // Mismo INSERT que /people/[id]/approve.
  let academicaCreada = false;
  if (person.numeroId) {
    const existeAcad = await queryOne<any>(`SELECT "_id" FROM "ACADEMICA" WHERE "numeroId" = $1 LIMIT 1`, [person.numeroId]);
    if (!existeAcad) {
      await query(
        `INSERT INTO "ACADEMICA" (
           "_id","numeroId","primerNombre","segundoNombre","primerApellido","segundoApellido",
           "email","celular","nivel","step","plataforma","estadoInactivo",
           "contrato","usuarioId","sence","senceCode","_createdDate","_updatedDate"
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'WELCOME','WELCOME',$9,false,$10,$11,$12,$13,NOW(),NOW())`,
        [
          ids.academic(), person.numeroId, person.primerNombre, person.segundoNombre || null,
          person.primerApellido, person.segundoApellido || null,
          email, person.celular || null, person.plataforma || null,
          person.contrato || null, person._id, person.sence === true, person.senceCode || null,
        ]);
      academicaCreada = true;
    }
  }

  return successResponse({
    ok: true,
    email,
    password,
    nombre,
    numeroId: person.numeroId,
    contrato: person.contrato,
    academicaCreada,
    message: academicaCreada
      ? 'Login creado + registro académico (WELCOME) creado'
      : 'Login creado/activado correctamente',
  });
});
