/**
 * sync-kids-matriculas.js
 *
 * Reconciliación KIDS2026 → LGS de la UBICACIÓN de cada niño Kids (curso + salón).
 * KIDS es la fuente de verdad: si allí se hizo un traslado (cambio de salón o de
 * curso) que no llegó a LGS, este script deja KIDS_INSCRIPCIONES igual a KIDS.
 * Desde 2026-10-19 KIDS avisa en línea (POST /api/kids-sync/matricula); este script
 * corrige lo anterior y sirve de red de seguridad.
 *
 * Lee la BD `kids2026` (mismo cluster, mismo usuario) en SOLO LECTURA. Toma la
 * matrícula viva (ACTIVA o RESERVADA, la más reciente) de cada contrato con
 * `external_ref`, y su salón / curso / campaña / horario (mismo formato que LGS:
 * "Mar 17:00 · Jue 17:00").
 *
 * Uso:
 *   node scripts/sync-kids-matriculas.js            # dry-run: lista diferencias
 *   node scripts/sync-kids-matriculas.js --apply    # actualiza KIDS_INSCRIPCIONES (transacción)
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

(async () => {
  const base = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
  const lgs = new Client({ connectionString: base, ssl: { rejectUnauthorized: false } });
  const kids = new Client({ connectionString: base.replace(/\/defaultdb(\?|$)/, '/kids2026$1'), ssl: { rejectUnauthorized: false } });
  await lgs.connect();
  await kids.connect();
  try {
    const insc = (await lgs.query(
      `SELECT "_id","contrato","numeroId","nombre","tipoCurso","classroomId","salonNombre","horario","campaign","kidsEnrollmentId",
              COALESCE("kidsExternalRef", "contrato" || '#' || "numeroId") AS ref
         FROM "KIDS_INSCRIPCIONES"
        WHERE COALESCE("contrato",'') NOT LIKE 'PRB-%'`)).rows;

    const k = (await kids.query(
      `SELECT DISTINCT ON (c.external_ref)
              c.external_ref AS ref, c.tipo_curso, e.id AS enrollment_id, e.estado, cl.id AS classroom_id, cl.nombre AS salon,
              ca.nombre AS campania,
              (SELECT string_agg(
                        (ARRAY['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'])[s.dia_semana + 1] || ' ' || s.hora_local, ' · '
                        ORDER BY s.dia_semana, s.hora_local)
                 FROM scheduling_slot s WHERE s.classroom_id = cl.id) AS horario
         FROM contracts_contract c
         LEFT JOIN enrollment_enrollment e ON e.contract_id = c.id AND e.estado IN ('ACTIVA','RESERVADA')
         LEFT JOIN scheduling_classroom cl ON cl.id = e.classroom_id
         LEFT JOIN catalog_course co ON co.id = cl.course_id
         LEFT JOIN catalog_campaign ca ON ca.id = co.campaign_id
        WHERE c.external_ref IS NOT NULL
        ORDER BY c.external_ref, e.created_at DESC NULLS LAST`)).rows;
    const porRef = new Map(k.map((r) => [r.ref, r]));

    const difs = [];
    const sinMatricula = [];
    let sinKids = 0;
    for (const i of insc) {
      const r = porRef.get(i.ref);
      if (!r) { sinKids++; continue; }
      // Sin matrícula viva en KIDS = baja/cancelación, no traslado: se reporta y NO se toca.
      if (!r.classroom_id) {
        if (i.classroomId) sinMatricula.push({ contrato: i.contrato, nino: i.nombre, doc: i.numeroId, LGS: `${i.tipoCurso} · ${i.salonNombre || '—'}` });
        continue;
      }
      const nuevo = {
        tipoCurso: r.tipo_curso,
        classroomId: r.classroom_id || null,
        salonNombre: r.salon || null,
        horario: r.horario || null,
        campaign: r.campania || i.campaign,
        kidsEnrollmentId: r.enrollment_id || i.kidsEnrollmentId,
      };
      if (i.tipoCurso !== nuevo.tipoCurso || (i.classroomId || null) !== nuevo.classroomId) {
        difs.push({ i, nuevo, estado: r.estado });
      }
    }

    console.log(`\n=== Reconciliación KIDS → LGS (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
    console.log(`Inscripciones LGS: ${insc.length} · sin contrato en KIDS: ${sinKids} · traslados por aplicar: ${difs.length} · sin matrícula viva en KIDS (no se tocan): ${sinMatricula.length}`);
    if (sinMatricula.length) { console.log('\nSin matrícula viva en KIDS (revisar a mano, no es traslado):'); console.table(sinMatricula); }
    if (difs.length) {
      console.table(difs.map(({ i, nuevo, estado }) => ({
        contrato: i.contrato, nino: i.nombre, doc: i.numeroId,
        LGS: `${i.tipoCurso} · ${i.salonNombre || '—'}`,
        KIDS: `${nuevo.tipoCurso} · ${nuevo.salonNombre || 'sin salón'}`,
        matricula: estado || '—',
      })));
    }
    if (!APPLY || !difs.length) {
      if (!APPLY) console.log('DRY-RUN: nada se guardó (use --apply).');
      return;
    }
    await lgs.query('BEGIN');
    for (const { i, nuevo } of difs) {
      await lgs.query(
        `UPDATE "KIDS_INSCRIPCIONES"
            SET "tipoCurso" = $2, "classroomId" = $3, "salonNombre" = $4, "horario" = $5, "campaign" = $6,
                "kidsEnrollmentId" = $7, "_updatedDate" = NOW()
          WHERE "_id" = $1`,
        [i._id, nuevo.tipoCurso, nuevo.classroomId, nuevo.salonNombre, nuevo.horario, nuevo.campaign, nuevo.kidsEnrollmentId]);
    }
    await lgs.query('COMMIT');
    console.log(`✅ ${difs.length} inscripciones actualizadas.`);
  } catch (e) {
    await lgs.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await lgs.end();
    await kids.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
