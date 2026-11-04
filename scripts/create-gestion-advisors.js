/**
 * create-gestion-advisors.js — esquema de Administración › Gestión Advisors
 * (liquidación de horas de advisors LGS y guías KIDS). Spec: docs/specs/gestion-advisors.md
 *
 *  - ADVISORS: datos de pago (tipo, categoría de tarifa, programa, grupo de pago,
 *    enlace a KIDS, valor fijo y horas de planta/semiplanta).
 *  - TARIFAS_ADVISOR: tarifas por país/programa/tipo/categoría/concepto con vigencia.
 *  - TIPO_CAMBIO: valor del USD por día y moneda (COP, CLP).
 *  - LIQ_ADVISOR (+ _AJUSTES, _FACTURAS, _LOG): una liquidación por advisor × programa × corte.
 *  - Rol ADMINISTRACION (revisora de facturas) y permisos ADMINISTRACION.GESTION_ADVISORS.*
 *    para ACADEMICO_JEFE, ADMINISTRACION y ADMINISTRACION_JEFE (solo AGREGA, nunca quita).
 *
 * Idempotente (IF NOT EXISTS / ON CONFLICT). Dry-run por defecto; --apply ejecuta en transacción.
 * Uso: node scripts/create-gestion-advisors.js [--apply]
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
const { randomUUID } = require('crypto');

const APPLY = process.argv.includes('--apply');

const P = 'ADMINISTRACION.GESTION_ADVISORS.';
const PERMISOS_POR_ROL = {
  ACADEMICO_JEFE: ['VER', 'AJUSTAR', 'HORAS_OK', 'VER_COMPENSACION', 'TARIFAS', 'FICHA_PAGO'],
  ADMINISTRACION: ['VER', 'FACTURA_DEVOLVER', 'VERIFICAR', 'VER_COMPENSACION'],
  ADMINISTRACION_JEFE: ['VER', 'REGISTRAR_PAGO', 'CONSOLIDADO_IMPRIMIR', 'CONSOLIDADO_EXPORTAR',
    'VER_COMPENSACION', 'TARIFAS', 'FICHA_PAGO'],
};

const SQL = [
  // ── ADVISORS: datos de pago ──
  `ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "tipoContratacion" VARCHAR(20) NOT NULL DEFAULT 'POR_HORAS'`,
  `ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "categoriaTarifa" VARCHAR(40) NOT NULL DEFAULT 'ESTANDAR'`,
  `ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "programa" VARCHAR(10) NOT NULL DEFAULT 'LGS'`,
  `ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "grupoPago" VARCHAR(20)`,
  `ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "kidsUserId" VARCHAR(64)`,
  `ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "valorFijoMensual" NUMERIC(14,2)`,
  `ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "horasContratadas" NUMERIC(6,1)`,
  `ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "horasGestionAdmin" NUMERIC(6,1)`,

  // ── Tarifas ──
  `CREATE TABLE IF NOT EXISTS "TARIFAS_ADVISOR" (
     "_id"          VARCHAR(64) PRIMARY KEY,
     "pais"         VARCHAR(20) NOT NULL,              -- Chile | Colombia | Ecuador
     "programa"     VARCHAR(10) NOT NULL DEFAULT 'LGS', -- LGS | KIDS
     "tipo"         VARCHAR(20) NOT NULL,              -- POR_HORAS | SEMIPLANTA
     "categoria"    VARCHAR(40) NOT NULL DEFAULT 'ESTANDAR',
     "concepto"     VARCHAR(20) NOT NULL,              -- NORMAL | FESTIVO | EXAM_INTERN
     "moneda"       VARCHAR(3)  NOT NULL,              -- COP | CLP | USD
     "valor"        NUMERIC(14,2) NOT NULL CHECK ("valor" >= 0),
     "vigenteDesde" DATE NOT NULL,
     "activo"       BOOLEAN NOT NULL DEFAULT true,
     "creadoPor"    VARCHAR(150),
     "_createdDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "_updatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT "tarifas_advisor_uq" UNIQUE ("pais", "programa", "tipo", "categoria", "concepto", "vigenteDesde")
   )`,

  // ── Tipo de cambio (unidades de moneda local por 1 USD) ──
  `CREATE TABLE IF NOT EXISTS "TIPO_CAMBIO" (
     "fecha"        DATE NOT NULL,
     "moneda"       VARCHAR(3) NOT NULL,
     "valor"        NUMERIC(14,4) NOT NULL CHECK ("valor" > 0),
     "fuente"       VARCHAR(60),
     "_createdDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY ("fecha", "moneda")
   )`,

  // ── Liquidación por advisor × programa × corte ──
  `CREATE TABLE IF NOT EXISTS "LIQ_ADVISOR" (
     "_id"            VARCHAR(64) PRIMARY KEY,
     "advisorId"      VARCHAR(64) NOT NULL,
     "programa"       VARCHAR(10) NOT NULL,            -- LGS | KIDS
     "periodo"        VARCHAR(7)  NOT NULL,            -- YYYY-MM
     "corte"          VARCHAR(3)  NOT NULL,            -- MES | Q1 | Q2
     "estado"         VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
     "horasOk"        BOOLEAN NOT NULL DEFAULT false,
     "horasOkPor"     VARCHAR(150),
     "horasOkEn"      TIMESTAMPTZ,
     "snapshot"       JSONB,                           -- horas/tarifas/tipo de cambio/reparto congelados al verificar
     "valor"          NUMERIC(14,2),
     "moneda"         VARCHAR(3),
     "verificadoPor"  VARCHAR(150),
     "verificadoEn"   TIMESTAMPTZ,
     "pagadoPor"      VARCHAR(150),
     "pagadoEn"       TIMESTAMPTZ,
     "referenciaPago" VARCHAR(150),
     "_createdDate"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "_updatedDate"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT "liq_advisor_uq" UNIQUE ("advisorId", "programa", "periodo", "corte")
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_liq_advisor_periodo" ON "LIQ_ADVISOR" ("periodo")`,

  `CREATE TABLE IF NOT EXISTS "LIQ_ADVISOR_AJUSTES" (
     "_id"          VARCHAR(64) PRIMARY KEY,
     "liqId"        VARCHAR(64) NOT NULL,
     "alcance"      VARCHAR(10) NOT NULL,              -- SEMANA | TOTAL
     "semanaInicio" DATE,
     "concepto"     VARCHAR(20) NOT NULL,
     "horas"        NUMERIC(6,1) NOT NULL CHECK ("horas" <> 0 AND MOD("horas" * 2, 1) = 0),
     "motivo"       TEXT NOT NULL,
     "usuarioEmail" VARCHAR(150),
     "usuarioNombre" VARCHAR(150),
     "_createdDate" TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_liq_ajustes_liq" ON "LIQ_ADVISOR_AJUSTES" ("liqId")`,

  `CREATE TABLE IF NOT EXISTS "LIQ_ADVISOR_FACTURAS" (
     "_id"                  VARCHAR(64) PRIMARY KEY,
     "liqId"                VARCHAR(64) NOT NULL,
     "url"                  TEXT NOT NULL,             -- key privada en Spaces
     "nombre"               VARCHAR(255),
     "tipo"                 VARCHAR(80),
     "extraido"             JSONB,
     "inconsistencias"      JSONB,
     "estado"               VARCHAR(20) NOT NULL DEFAULT 'RECIBIDA', -- RECIBIDA | DEVUELTA | ACEPTADA
     "comentarioDevolucion" TEXT,
     "devueltaPor"          VARCHAR(150),
     "devueltaEn"           TIMESTAMPTZ,
     "subidoPor"            VARCHAR(150),
     "subidoEn"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_liq_facturas_liq" ON "LIQ_ADVISOR_FACTURAS" ("liqId")`,

  `CREATE TABLE IF NOT EXISTS "LIQ_ADVISOR_LOG" (
     "_id"            VARCHAR(64) PRIMARY KEY,
     "liqId"          VARCHAR(64),
     "advisorId"      VARCHAR(64),
     "accion"         VARCHAR(40) NOT NULL,
     "estadoAnterior" VARCHAR(20),
     "estadoNuevo"    VARCHAR(20),
     "detalle"        JSONB,
     "usuarioEmail"   VARCHAR(150),
     "usuarioNombre"  VARCHAR(150),
     "usuarioRol"     VARCHAR(50),
     "_createdDate"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_liq_log_liq" ON "LIQ_ADVISOR_LOG" ("liqId")`,
];

(async () => {
  console.log(APPLY ? '== APPLY ==' : '== DRY-RUN (sin --apply no escribe) ==');
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    // Plan de permisos por rol (solo agrega lo que falta)
    const plan = [];
    for (const [rol, sufijos] of Object.entries(PERMISOS_POR_ROL)) {
      const want = sufijos.map((s) => P + s);
      const r = await c.query(`SELECT "permisos" FROM "ROL_PERMISOS" WHERE "rol" = $1`, [rol]);
      const actual = r.rows[0] ? (Array.isArray(r.rows[0].permisos) ? r.rows[0].permisos : JSON.parse(r.rows[0].permisos || '[]')) : null;
      const faltan = want.filter((p) => !(actual || []).includes(p));
      plan.push({ rol, existe: !!actual, faltan });
      console.log(`  ${rol}: ${actual ? 'existe' : 'SE CREA'} · agrega ${faltan.length} → ${faltan.map((p) => p.replace(P, '')).join(', ') || '(nada)'}`);
    }

    if (!APPLY) {
      console.log(`\n${SQL.length} sentencias de esquema (IF NOT EXISTS). Correr con --apply para ejecutar.`);
      return;
    }

    await c.query('BEGIN');
    for (const s of SQL) { await c.query(s); console.log('✔', s.trim().split('\n')[0].slice(0, 100)); }
    for (const { rol, existe, faltan } of plan) {
      if (!existe) {
        await c.query(
          `INSERT INTO "ROL_PERMISOS" ("_id", "rol", "permisos", "descripcion", "activo", "fechaCreacion", "fechaActualizacion", "_createdDate", "_updatedDate")
           VALUES ($1, $2, $3, $4, true, NOW(), NOW(), NOW(), NOW())`,
          [randomUUID(), rol, JSON.stringify(faltan), 'Administración: revisión de facturas y boletas de advisors'],
        );
      } else if (faltan.length) {
        await c.query(
          `UPDATE "ROL_PERMISOS"
              SET "permisos" = (COALESCE("permisos"::jsonb, '[]'::jsonb) || $2::jsonb),
                  "fechaActualizacion" = NOW(), "_updatedDate" = NOW()
            WHERE "rol" = $1`,
          [rol, JSON.stringify(faltan)],
        );
      }
      console.log(`✔ permisos ${rol}`);
    }
    await c.query('COMMIT');
    console.log('\nListo. Recordar: los permisos se reflejan en ≤1 min (caché del middleware) y con F5.');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
