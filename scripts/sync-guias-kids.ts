/**
 * Carga inicial / red de seguridad: guías de KIDS → LGS (misma lógica que el cron
 * sync-guias-kids, src/lib/kids-guias-sync.ts), leyendo la BD `kids2026` del mismo cluster
 * en SOLO LECTURA (no necesita KIDS_API_URL). La foto la copia el cron en producción.
 *
 * Uso:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx --conditions=react-server --tsconfig tsconfig.json -r dotenv/config scripts/sync-guias-kids.ts           (dry-run)
 *   … scripts/sync-guias-kids.ts --apply                                                                                                          (respaldo en docs/ + aplica)
 */
import fs from 'fs';
import { Client } from 'pg';
import { queryMany } from '@/lib/postgres';
import { aplicarGuia } from '@/lib/kids-guias-sync';
import type { KidsGuia } from '@/lib/kids-intake';

const APPLY = process.argv.includes('--apply');

(async () => {
  const base = String(process.env.DATABASE_URL).replace(/[?&]sslmode=[^&]*/g, '');
  const kids = new Client({ connectionString: base.replace(/\/defaultdb(\?|$)/, '/kids2026$1'), ssl: { rejectUnauthorized: false } });
  await kids.connect();
  const { rows } = await kids.query<KidsGuia>(
    `SELECT DISTINCT ON (u.id)
            u.id AS "guiaUserId", u.username, u.email AS "emailCuenta", u.estado::text AS estado,
            u.password_hash AS "passwordHash", u.debe_cambiar_password AS "debeCambiarPassword",
            g.nombres, g.apellidos, g.doc_numero AS "docNumero", g.email, g.telefono,
            TRIM(g.pais) AS pais, g.domicilio, g.fecha_nacimiento::text AS "fechaNacimiento",
            g.zoom_url AS "zoomUrl", g.foto_file_id AS "fotoFileId",
            GREATEST(u.updated_at, COALESCE(g.actualizado_en, u.updated_at))::text AS "actualizadoEn"
       FROM identity_user u
       JOIN access_user_role ur ON ur.user_id = u.id
       JOIN access_role r ON r.id = ur.role_id AND r.code = 'guia'
       LEFT JOIN scheduling_guia g ON g.guia_user_id = u.id
      ORDER BY u.id`);
  await kids.end();

  const emails = rows.map(r => String(r.email || r.emailCuenta || '').trim().toLowerCase()).filter(Boolean);
  const ids = rows.map(r => r.guiaUserId);
  const [logins, advs] = await Promise.all([
    queryMany(`SELECT * FROM "USUARIOS_ROLES" WHERE "kidsUserId" = ANY($1) OR LOWER(TRIM("email")) = ANY($2)`, [ids, emails]),
    queryMany(`SELECT * FROM "ADVISORS" WHERE "kidsUserId" = ANY($1) OR LOWER(TRIM("email")) = ANY($2)`, [ids, emails]),
  ]);
  console.log(`${rows.length} guías en KIDS · ${logins.length} logins y ${advs.length} advisors relacionados en LGS`);
  for (const r of rows) {
    const em = String(r.email || r.emailCuenta || '').trim().toLowerCase();
    const l = logins.find((x: any) => x.kidsUserId === r.guiaUserId || String(x.email).trim().toLowerCase() === em);
    const a = advs.find((x: any) => x.kidsUserId === r.guiaUserId || String(x.email).trim().toLowerCase() === em);
    console.log(`- ${r.username.padEnd(15)} ${`${r.nombres || ''} ${r.apellidos || ''}`.padEnd(36)} advisor: ${a ? `${a._id} (${a.programa})` : 'NUEVO'} · login: ${l ? `${l.email} rol ${l.rol}${l.origenCuenta === 'KIDS' ? ' [KIDS]' : ' [propio LGS → pendiente]'}` : 'NUEVO'}${r.debeCambiarPassword ? ' · debe cambiar clave en KIDS' : ''}`);
  }
  if (!APPLY) { console.log('\nDry-run. Use --apply para aplicar.'); process.exit(0); }

  const archivo = `docs/backup-sync-guias-kids-${Date.now()}.json`;
  fs.writeFileSync(archivo, JSON.stringify({ logins, advisors: advs }, null, 1));
  console.log(`\nRespaldo: ${archivo}`);
  for (const r of rows) {
    const res = await aplicarGuia(r).catch((e: any) => ({ username: r.username, nombre: '', estado: 'error', detalle: e?.message }));
    console.log(`  ${res.estado.padEnd(12)} ${r.username}${res.detalle ? ` — ${res.detalle}` : ''}`);
  }
  process.exit(0);
})().catch(e => { console.error('❌', e?.message || e); process.exit(1); });
