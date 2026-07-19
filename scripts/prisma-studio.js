#!/usr/bin/env node
/**
 * prisma-studio.js — abre Prisma Studio gestionando el firewall de la BD (DO)
 * automáticamente: whitelistea tu IP pública, abre Studio, y la remueve al cerrar
 * (Ctrl+C). PORTABLE entre proyectos: detecta el cluster de Digital Ocean a partir
 * del host de DATABASE_URL (el host empieza con el nombre del cluster, p.ej.
 * "lgs-db-do-user-…" → cluster "lgs-db"; "mosaico-db-…" → "mosaico-db").
 *
 * Requisitos: doctl autenticado, curl, y DATABASE_URL en .env o .env.local.
 * USO:  npm run studio     (o: node scripts/prisma-studio.js)
 */
const { execSync, spawn } = require('child_process');
try { require('dotenv').config({ path: '.env.local' }); } catch {}
try { require('dotenv').config(); } catch {}

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

const url = process.env.DATABASE_URL;
if (!url) { console.error('❌ Falta DATABASE_URL en .env / .env.local'); process.exit(1); }

const host = new URL(url).hostname;                 // p.ej. lgs-db-do-user-19197755-0.e.db.ondigitalocean.com
const clusterName = host.split('-do-user')[0];      // p.ej. lgs-db
let clusterId = null;
try {
  const list = sh('doctl databases list --format ID,Name --no-header');
  for (const line of list.split('\n')) {
    const [id, name] = line.trim().split(/\s+/);
    if (name === clusterName) { clusterId = id; break; }
  }
} catch (e) { console.error('❌ doctl databases list falló:', e.message); process.exit(1); }
if (!clusterId) { console.error(`❌ No encontré el cluster de DO llamado "${clusterName}" (host ${host})`); process.exit(1); }

const ip = sh('curl -s https://api.ipify.org');

let cleaned = false;
function cleanup() {
  if (cleaned) return; cleaned = true;
  try {
    const rules = sh(`doctl databases firewalls list ${clusterId} --no-header`);
    for (const l of rules.split('\n')) {
      if (l.includes(ip)) { const uuid = l.trim().split(/\s+/)[0]; try { sh(`doctl databases firewalls remove ${clusterId} --uuid ${uuid}`); } catch {} }
    }
    console.log(`\n🔒 IP ${ip} removida del firewall de ${clusterName}`);
  } catch (e) { console.error('cleanup:', e.message); }
}

(async () => {
  console.log(`🔓 Whitelisteando ${ip} en ${clusterName} (${clusterId})…`);
  try { sh(`doctl databases firewalls append ${clusterId} --rule ip_addr:${ip}`); } catch (e) { console.error('append:', e.message); }
  await new Promise(r => setTimeout(r, 9000)); // propagación

  console.log('🚀 Abriendo Prisma Studio (Ctrl+C para cerrar y limpiar el firewall)…');
  const child = spawn('npx', ['prisma', 'studio'], { stdio: 'inherit', shell: true });

  const shutdown = () => { child.kill('SIGINT'); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  child.on('exit', (code) => { cleanup(); process.exit(code || 0); });
})();
process.on('exit', cleanup); // red de seguridad
