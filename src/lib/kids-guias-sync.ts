import 'server-only';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { queryOne, withTransaction } from '@/lib/postgres';
import { generateId } from '@/lib/id-generator';
import { normalizarTelefono } from '@/lib/telefono';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { kidsIntake, type KidsGuia } from '@/lib/kids-intake';

/**
 * Guías de KIDS reflejadas en LGS (fase 1). La cuenta NACE en KIDS: usuario, clave (hash
 * argon2id, nunca en claro), estado y ficha (nombres, teléfono, país, domicilio, nacimiento,
 * Zoom, foto) se copian a USUARIOS_ROLES (rol ADVISOR, `origenCuenta='KIDS'`) y ADVISORS
 * (programa KIDS). LGS no cambia la clave de estas cuentas (se cambia en KIDS).
 *
 * Cuándo corre: el cron `sync-guias-kids` (cada 15 min) y, al fallar un ingreso en LGS, solo
 * para ese usuario (auth-postgres), para que una clave recién cambiada en KIDS sirva al instante.
 *
 * PENDIENTE (decisión del usuario): las guías que ya tenían login propio en LGS antes de
 * esta sincronización (Shirley Oñate, Verónica Espinosa — programa AMBOS) NO se tocan:
 * se informan como `pendiente` hasta decidir qué clave manda.
 */

const PAIS: Record<string, string> = { CL: 'Chile', CO: 'Colombia', EC: 'Ecuador', PE: 'Perú' };

export interface ResultadoGuia {
  username: string; nombre: string;
  estado: 'creada' | 'actualizada' | 'sin cambios' | 'pendiente' | 'error';
  detalle?: string;
}

const t = (s: any) => String(s ?? '').replace(/\s+/g, ' ').trim();
const vacioANull = (s: any) => t(s) || null;

async function copiarFoto(advisorId: string, g: KidsGuia): Promise<string | null> {
  const f = await kidsIntake.fotoGuia(g.guiaUserId);
  if (!f) return null;
  const ext = f.mime.includes('png') ? 'png' : f.mime.includes('webp') ? 'webp' : 'jpg';
  const key = `fotosAdvisors/${advisorId}_kids_${Date.now()}.${ext}`;
  await spacesClient.send(new PutObjectCommand({ Bucket: SPACES_BUCKET, Key: key, Body: f.bytes, ContentType: f.mime, ACL: 'private' as any }));
  return key;
}

/** Aplica una guía de KIDS en LGS (transacción). La foto se baja solo si cambió en KIDS. */
export async function aplicarGuia(g: KidsGuia): Promise<ResultadoGuia> {
  const email = t(g.email || g.emailCuenta).toLowerCase() || null;
  const nombres = t(g.nombres), apellidos = t(g.apellidos);
  const nombre = t(`${nombres} ${apellidos}`) || g.username;
  const base = { username: g.username, nombre };
  if (!g.passwordHash?.startsWith('$argon2')) return { ...base, estado: 'error', detalle: 'KIDS no entregó la clave cifrada' };

  const pais = PAIS[String(g.pais || '').toUpperCase()] || null;
  const activo = g.estado === 'ACTIVO';

  // Login previo de LGS (no creado por esta sincronización) → pendiente de decidir.
  const login = await queryOne<any>(
    `SELECT "_id","email","rol","origenCuenta" FROM "USUARIOS_ROLES"
      WHERE "kidsUserId" = $1 OR ($2::text IS NOT NULL AND LOWER(TRIM("email")) = $2)
      ORDER BY ("kidsUserId" = $1) DESC NULLS LAST LIMIT 1`, [g.guiaUserId, email]);
  if (login && login.origenCuenta !== 'KIDS') {
    return { ...base, estado: 'pendiente', detalle: `ya tiene login propio en LGS (${login.email}, rol ${login.rol}); no se modifica` };
  }

  const adv = await queryOne<any>(
    `SELECT * FROM "ADVISORS" WHERE "kidsUserId" = $1 OR ($2::text IS NOT NULL AND LOWER(TRIM("email")) = $2)
      ORDER BY ("kidsUserId" = $1) DESC NULLS LAST LIMIT 1`, [g.guiaUserId, email]);
  if (adv && adv.programa === 'AMBOS' && !login) {
    // Advisor de adultos que también es guía, sin login reflejado aún: se deja para la decisión pendiente.
    return { ...base, estado: 'pendiente', detalle: 'advisor de Adultos y Kids (AMBOS); se decide al final' };
  }

  const advId: string = adv?._id || generateId('adv');
  let fotoKey: string | null = null;
  if (g.fotoFileId && g.fotoFileId !== adv?.kidsFotoId) {
    try { fotoKey = await copiarFoto(advId, g); } catch (e: any) { console.warn('[kids-guias] foto no copiada', g.username, e?.message); }
  }

  const fila = {
    primerNombre: nombres || null, primerApellido: apellidos || null, nombreCompleto: nombre,
    email, telefono: normalizarTelefono(g.telefono, pais), pais,
    domicilioadvisor: vacioANull(g.domicilio), fechaNacimiento: g.fechaNacimiento || null, zoom: vacioANull(g.zoomUrl),
  };

  return withTransaction(async (client) => {
    if (!adv) {
      await client.query(
        `INSERT INTO "ADVISORS" ("_id","primerNombre","primerApellido","nombreCompleto","email","telefono","pais","domicilioadvisor",
           "fechaNacimiento","zoom","activo","programa","kidsUserId","fotoAdvisor","kidsFotoId","_createdDate","_updatedDate")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,'KIDS',$12,$13,$14,NOW(),NOW())`,
        [advId, fila.primerNombre, fila.primerApellido, fila.nombreCompleto, fila.email, fila.telefono, fila.pais, fila.domicilioadvisor,
         fila.fechaNacimiento, fila.zoom, activo, g.guiaUserId, fotoKey, fotoKey ? g.fotoFileId : null]);
    } else {
      // KIDS manda en los datos que trae; lo que KIDS deja vacío no borra lo que LGS ya tenía.
      await client.query(
        `UPDATE "ADVISORS" SET
           "primerNombre" = COALESCE($2, "primerNombre"), "primerApellido" = COALESCE($3, "primerApellido"),
           "nombreCompleto" = COALESCE($4, "nombreCompleto"), "email" = COALESCE($5, "email"),
           "telefono" = COALESCE($6, "telefono"), "pais" = COALESCE($7, "pais"),
           "domicilioadvisor" = COALESCE($8, "domicilioadvisor"), "fechaNacimiento" = COALESCE($9::date, "fechaNacimiento"),
           "zoom" = COALESCE($10, "zoom"),
           "activo" = CASE WHEN COALESCE("programa",'LGS') = 'KIDS' THEN $11 ELSE "activo" END,
           "programa" = CASE WHEN "programa" IS NULL OR "programa" = 'LGS' THEN 'AMBOS' ELSE "programa" END,
           "kidsUserId" = $12,
           "fotoAdvisor" = COALESCE($13, "fotoAdvisor"), "kidsFotoId" = CASE WHEN $13::text IS NOT NULL THEN $14 ELSE "kidsFotoId" END,
           "_updatedDate" = NOW()
         WHERE "_id" = $1`,
        [advId, fila.primerNombre, fila.primerApellido, fila.nombreCompleto, fila.email, fila.telefono, fila.pais, fila.domicilioadvisor,
         fila.fechaNacimiento, fila.zoom, activo, g.guiaUserId, fotoKey, g.fotoFileId]);
    }

    // Login: usuario + clave de KIDS. perfilActualizado = ahora: la ficha viene de KIDS, no se
    // les pide el formulario de Actualización de Datos de LGS.
    let loginId: string = login?._id;
    if (!login) {
      loginId = generateId('adv');
      await client.query(
        `INSERT INTO "USUARIOS_ROLES" ("_id","email","username","password","nombre","apellido","rol","activo","celular","plataforma",
           "origen","origenCuenta","kidsUserId","kidsDebeCambiar","perfilActualizado","fechaCreacion","fechaActualizacion","_createdDate","_updatedDate")
         VALUES ($1,$2,$3,$4,$5,$6,'ADVISOR',$7,$8,$9,'KIDS','KIDS',$10,$11,NOW(),NOW(),NOW(),NOW(),NOW())`,
        [loginId, email || `${g.username}@guias.kids`, g.username, g.passwordHash, nombres || g.username, apellidos || null,
         activo, fila.telefono, pais, g.guiaUserId, g.debeCambiarPassword === true]);
    } else {
      await client.query(
        `UPDATE "USUARIOS_ROLES" SET "email" = COALESCE($2, "email"), "username" = $3, "password" = $4,
           "nombre" = COALESCE($5, "nombre"), "apellido" = COALESCE($6, "apellido"), "activo" = $7,
           "celular" = COALESCE($8, "celular"), "plataforma" = COALESCE($9, "plataforma"),
           "kidsUserId" = $10, "kidsDebeCambiar" = $11, "fechaActualizacion" = NOW(), "_updatedDate" = NOW()
         WHERE "_id" = $1`,
        [loginId, email, g.username, g.passwordHash, nombres || null, apellidos || null, activo, fila.telefono, pais,
         g.guiaUserId, g.debeCambiarPassword === true]);
    }
    await client.query(`UPDATE "ADVISORS" SET "usuarioRolId" = $2 WHERE "_id" = $1`, [advId, loginId]);
    return { ...base, estado: adv && login ? 'actualizada' : 'creada' } as ResultadoGuia;
  });
}

/** Trae de KIDS todas las guías (o la de `usuario`) y las aplica. Nunca lanza por una guía. */
export async function sincronizarGuiasKids(usuario?: string): Promise<ResultadoGuia[]> {
  if (!kidsIntake.isConfigured()) return [];
  const { guias } = await kidsIntake.guias(usuario);
  const out: ResultadoGuia[] = [];
  for (const g of guias || []) {
    try { out.push(await aplicarGuia(g)); }
    catch (e: any) { out.push({ username: g.username, nombre: t(`${g.nombres || ''} ${g.apellidos || ''}`) || g.username, estado: 'error', detalle: e?.message }); }
  }
  return out;
}
