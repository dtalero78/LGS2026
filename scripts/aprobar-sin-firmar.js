/**
 * aprobar-sin-firmar.js
 *
 * Regulariza contratos que aparecían como "Sin firmar" en el Centro de Aprobaciones
 * pero NO son pendientes reales (análisis 2026-10-19, docs/sin-firmar-analisis-*.csv):
 *
 *   --finalizar=<contratos>  Grupo 4 (histórico, ya se cursó y venció): titular y
 *                            beneficiarios → aprobacion 'Aprobado', estado 'FINALIZADA',
 *                            estadoInactivo true.
 *   --activar=<contratos>    Grupo 3 (alumnos ya aprobados en ESE contrato): titular →
 *                            aprobacion 'Aprobado' (estado ACTIVA si su contrato sigue
 *                            vigente); beneficiarios sin estado → 'Aprobado'.
 *
 * SIN mensajes, SIN crear fichas académicas ni logins, SIN tocar USUARIOS_ROLES (es una
 * corrección de estado, no el flujo de aprobación). Cada cambio de `aprobacion` queda en
 * APROBACION_AUDIT (origen SISTEMA) y el estado previo en docs/backup-aprobar-sin-firmar-*.json.
 * Salta (y reporta) filas que ya tengan otro estado de aprobación (Rechazado, Contrato nulo…).
 *
 * Uso: node scripts/aprobar-sin-firmar.js --finalizar=A,B --activar=C,D --motivo="..." [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3).trim();
const lista = (k) => [...new Set(arg(k).split(',').map((s) => s.trim()).filter(Boolean))];
const APPLY = process.argv.includes('--apply');
const MOTIVO = arg('motivo');
const FINALIZAR = lista('finalizar');
const ACTIVAR = lista('activar');
if (MOTIVO.length < 10) { console.error('--motivo="..." obligatorio (≥10)'); process.exit(1); }
const solapados = FINALIZAR.filter((k) => ACTIVAR.includes(k));
if (solapados.length) { console.error('Contratos en ambas listas:', solapados.join(', ')); process.exit(1); }

const rid = () => `aud_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
const editable = (a) => ['', 'PENDIENTE'].includes(String(a || '').trim().toUpperCase());

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const backup = [], resumen = [];
  try {
    await c.query('BEGIN');
    const procesar = async (contrato, modo) => {
      const people = (await c.query(`SELECT * FROM "PEOPLE" WHERE "contrato" = $1 FOR UPDATE`, [contrato])).rows;
      if (!people.length) { resumen.push({ contrato, modo, estado: 'no existe' }); return; }
      let cambiadas = 0, saltadas = 0;
      for (const p of people) {
        const esTit = p.tipoUsuario === 'TITULAR';
        if (modo === 'activar' && !esTit && !editable(p.aprobacion)) continue; // beneficiario ya aprobado: no se toca
        if (!editable(p.aprobacion)) { saltadas++; continue; }
        const vigente = p.finalContrato && new Date(p.finalContrato) >= new Date(new Date().toISOString().slice(0, 10));
        const nuevo = modo === 'finalizar'
          ? { estado: 'FINALIZADA', estadoInactivo: true }
          : { estado: esTit ? (vigente ? 'ACTIVA' : (p.estado || 'FINALIZADA')) : p.estado, estadoInactivo: esTit ? !vigente && p.estadoInactivo : p.estadoInactivo };
        backup.push({ _id: p._id, contrato, tipoUsuario: p.tipoUsuario, aprobacion: p.aprobacion, estado: p.estado, estadoInactivo: p.estadoInactivo });
        await c.query(
          `UPDATE "PEOPLE" SET "aprobacion" = 'Aprobado', "estado" = $2, "estadoInactivo" = $3, "_updatedDate" = NOW() WHERE "_id" = $1`,
          [p._id, nuevo.estado, nuevo.estadoInactivo]);
        await c.query(
          `INSERT INTO "APROBACION_AUDIT" ("_id","personId","contrato","tipoUsuario","nombre","estadoAnterior","estadoNuevo",
              "origen","motivo","usuarioEmail","usuarioNombre","usuarioRol","_createdDate")
           VALUES ($1,$2,$3,$4,$5,$6,'Aprobado','SISTEMA',$7,'script:aprobar-sin-firmar','Claude (autorizado por plataformalgsdigital)','SUPER_ADMIN',NOW())`,
          [rid(), p._id, contrato, p.tipoUsuario, `${(p.primerNombre || '').trim()} ${(p.primerApellido || '').trim()}`.trim(),
           p.aprobacion || null, `${MOTIVO} [${modo === 'finalizar' ? 'aprobado y finalizado' : 'aprobado'}]`]);
        cambiadas++;
      }
      resumen.push({ contrato, modo, filas: people.length, cambiadas, saltadas_otro_estado: saltadas });
    };
    for (const k of FINALIZAR) await procesar(k, 'finalizar');
    for (const k of ACTIVAR) await procesar(k, 'activar');
    const tot = (m) => resumen.filter((r) => r.modo === m);
    console.log(`Finalizar: ${tot('finalizar').length} contratos / ${tot('finalizar').reduce((s, r) => s + (r.cambiadas || 0), 0)} filas · Activar: ${tot('activar').length} contratos / ${tot('activar').reduce((s, r) => s + (r.cambiadas || 0), 0)} filas`);
    const raros = resumen.filter((r) => r.estado === 'no existe' || r.saltadas_otro_estado || !r.cambiadas);
    if (raros.length) { console.log('Revisar:'); console.table(raros); }
    if (APPLY) {
      fs.writeFileSync(`docs/backup-aprobar-sin-firmar-${Date.now()}.json`, JSON.stringify(backup, null, 2));
      await c.query('COMMIT');
      console.log(`✅ APLICADO (${backup.length} filas). Estado previo en docs/backup-aprobar-sin-firmar-*.json; auditoría en APROBACION_AUDIT.`);
    } else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK (use --apply).'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR (ROLLBACK):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
