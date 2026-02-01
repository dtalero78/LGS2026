-- ============================================
-- LGS Admin Panel - PostgreSQL Schema
-- Migration from Wix Collections to PostgreSQL
-- All field names in camelCase (matching Wix exactly)
-- Version: 1.0.0
-- Date: 2026-01-19
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. NIVELES (Level Definitions - ~20 records)
-- Dependency: None (must be migrated first)
-- Priority: MEDIA
-- ============================================
CREATE TABLE "NIVELES" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "code" VARCHAR(20) NOT NULL UNIQUE,
  "step" VARCHAR(50),
  "esParalelo" BOOLEAN DEFAULT FALSE,
  "description" TEXT,
  "material" JSONB DEFAULT '[]',
  "clubs" JSONB DEFAULT '[]',
  "steps" JSONB DEFAULT '[]',
  "materiales" JSONB DEFAULT '[]',
  "orden" INTEGER,
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX'
);

CREATE INDEX idx_niveles_code ON "NIVELES"("code");
CREATE INDEX idx_niveles_paralelo ON "NIVELES"("esParalelo");
CREATE INDEX idx_niveles_orden ON "NIVELES"("orden");

COMMENT ON TABLE "NIVELES" IS 'Academic level definitions (WELCOME, BN1, BN2, P1, ESS, etc.)';
COMMENT ON COLUMN "NIVELES"."esParalelo" IS 'TRUE for parallel levels like ESS that don''t block main progression';

-- ============================================
-- 2. ROL_PERMISOS (Role-Based Access Control - 9 roles)
-- Dependency: None
-- Priority: ALTA
-- ============================================
CREATE TABLE "ROL_PERMISOS" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "rol" VARCHAR(50) NOT NULL UNIQUE,
  "descripcion" TEXT,
  "permisos" JSONB DEFAULT '[]',
  "activo" BOOLEAN DEFAULT TRUE,
  "fechaCreacion" TIMESTAMP WITH TIME ZONE,
  "fechaActualizacion" TIMESTAMP WITH TIME ZONE,
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX'
);

CREATE INDEX idx_rol_permisos_rol ON "ROL_PERMISOS"("rol");
CREATE INDEX idx_rol_permisos_activo ON "ROL_PERMISOS"("activo");
CREATE INDEX idx_rol_permisos_gin ON "ROL_PERMISOS" USING GIN("permisos");

COMMENT ON TABLE "ROL_PERMISOS" IS 'Role definitions with permission arrays (SUPER_ADMIN, ADMIN, ADVISOR, etc.)';
COMMENT ON COLUMN "ROL_PERMISOS"."permisos" IS 'Array of permission strings in format MODULE.SUBMODULE.ACTION';

-- ============================================
-- 3. USUARIOS_ROLES (Authentication - 50-100 users)
-- Dependency: ROL_PERMISOS (foreign key)
-- Priority: ALTA
-- ============================================
CREATE TABLE "USUARIOS_ROLES" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "nombre" VARCHAR(255) NOT NULL,
  "apellido" VARCHAR(255),
  "password" TEXT NOT NULL,
  "rol" VARCHAR(50) NOT NULL,
  "activo" BOOLEAN DEFAULT TRUE,
  "celular" VARCHAR(20),
  "linkZoom" TEXT,
  "fechaCreacion" TIMESTAMP WITH TIME ZONE,
  "fechaActualizacion" TIMESTAMP WITH TIME ZONE,
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX'
);

-- Note: Foreign key to ROL_PERMISOS is NOT enforced to allow flexibility
-- but logically links via USUARIOS_ROLES.rol = ROL_PERMISOS.rol
CREATE INDEX idx_usuarios_email ON "USUARIOS_ROLES"("email");
CREATE INDEX idx_usuarios_rol ON "USUARIOS_ROLES"("rol");
CREATE INDEX idx_usuarios_activo ON "USUARIOS_ROLES"("activo");

COMMENT ON TABLE "USUARIOS_ROLES" IS 'User accounts for admin panel authentication';
COMMENT ON COLUMN "USUARIOS_ROLES"."password" IS 'Supports both bcrypt hashed and plain text (legacy)';

-- ============================================
-- 4. PEOPLE (User Profiles - 5-10K records)
-- Dependency: None
-- Priority: ALTA
-- Complex JSONB fields: onHoldHistory, extensionHistory
-- ============================================
CREATE TABLE "PEOPLE" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "numeroId" VARCHAR(50) NOT NULL UNIQUE,
  "primerNombre" VARCHAR(255) NOT NULL,
  "segundoNombre" VARCHAR(255),
  "primerApellido" VARCHAR(255) NOT NULL,
  "segundoApellido" VARCHAR(255),
  "celular" VARCHAR(20),
  "telefono" VARCHAR(20),
  "email" VARCHAR(255),
  "domicilio" TEXT,
  "ciudad" VARCHAR(255),
  "fechaNacimiento" DATE,
  "contrato" VARCHAR(50) NOT NULL,
  "vigencia" VARCHAR(50),
  "fechaCreacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tipoUsuario" VARCHAR(20) NOT NULL CHECK ("tipoUsuario" IN ('TITULAR', 'BENEFICIARIO')),
  "plataforma" VARCHAR(50),
  "clave" TEXT,
  "nivel" VARCHAR(20),
  "step" VARCHAR(50),
  "nivelParalelo" VARCHAR(20),
  "stepParalelo" VARCHAR(50),
  "aprobacion" VARCHAR(50) CHECK ("aprobacion" IN ('Aprobado', 'Pendiente', 'Rechazado', 'Contrato nulo', 'Devuelto')),
  "estadoInactivo" BOOLEAN DEFAULT FALSE,
  "estado" VARCHAR(50),
  "fechaOnHold" DATE,
  "fechaFinOnHold" DATE,
  "vigenciaOriginalPreOnHold" VARCHAR(50),
  "onHoldCount" INTEGER DEFAULT 0,
  "onHoldHistory" JSONB DEFAULT '[]',
  "extensionCount" INTEGER DEFAULT 0,
  "extensionHistory" JSONB DEFAULT '[]',
  "fechaContrato" DATE,
  "finalContrato" DATE,
  "titularId" VARCHAR(50),
  "asesor" VARCHAR(255),
  "usuarioId" VARCHAR(50),
  "ingresos" VARCHAR(100),
  "genero" VARCHAR(50),
  "empresa" VARCHAR(255),
  "cargo" VARCHAR(255),
  "referenciaUno" VARCHAR(255),
  "parentezcoRefUno" VARCHAR(100),
  "telefonoRefUno" VARCHAR(20),
  "referenciaDos" VARCHAR(255),
  "parentezcoRefDos" VARCHAR(100),
  "telefonoRefDos" VARCHAR(20),
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX'
);

-- Indexes for performance
CREATE INDEX idx_people_numeroid ON "PEOPLE"("numeroId");
CREATE INDEX idx_people_contrato ON "PEOPLE"("contrato");
CREATE INDEX idx_people_email ON "PEOPLE"("email");
CREATE INDEX idx_people_tipo ON "PEOPLE"("tipoUsuario");
CREATE INDEX idx_people_nivel ON "PEOPLE"("nivel");
CREATE INDEX idx_people_asesor ON "PEOPLE"("asesor");
CREATE INDEX idx_people_aprobacion ON "PEOPLE"("aprobacion");
CREATE INDEX idx_people_inactivo ON "PEOPLE"("estadoInactivo");
CREATE INDEX idx_people_titular ON "PEOPLE"("titularId");
CREATE INDEX idx_people_final_contrato ON "PEOPLE"("finalContrato");
CREATE INDEX idx_people_plataforma ON "PEOPLE"("plataforma");

-- GIN indexes for JSONB searches
CREATE INDEX idx_people_onhold_history ON "PEOPLE" USING GIN("onHoldHistory");
CREATE INDEX idx_people_extension_history ON "PEOPLE" USING GIN("extensionHistory");

COMMENT ON TABLE "PEOPLE" IS 'User profiles for both TITULAR (account holders) and BENEFICIARIO (students)';
COMMENT ON COLUMN "PEOPLE"."onHoldHistory" IS 'Array of OnHold records with fechaOnHold, fechaFinOnHold, motivo, activadoPor';
COMMENT ON COLUMN "PEOPLE"."extensionHistory" IS 'Array of contract extensions (manual + automatic from OnHold)';

-- ============================================
-- 5. ACADEMICA (Academic Records - 30K+ records)
-- Dependency: PEOPLE, NIVELES
-- Priority: ALTA
-- ============================================
CREATE TABLE "ACADEMICA" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "studentId" VARCHAR(50) NOT NULL,
  "numeroId" VARCHAR(50) NOT NULL,
  "nivel" VARCHAR(20) NOT NULL,
  "step" VARCHAR(50) NOT NULL,
  "nivelParalelo" VARCHAR(20),
  "stepParalelo" VARCHAR(50),
  "primerNombre" VARCHAR(255) NOT NULL,
  "segundoNombre" VARCHAR(255),
  "primerApellido" VARCHAR(255) NOT NULL,
  "segundoApellido" VARCHAR(255),
  "asesor" VARCHAR(255),
  "fechaNacimiento" DATE,
  "celular" VARCHAR(20),
  "telefono" VARCHAR(20),
  "email" VARCHAR(255),
  "contrato" VARCHAR(50),
  "fechaCreacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tipoUsuario" VARCHAR(20) DEFAULT 'BENEFICIARIO',
  "plataforma" VARCHAR(50),
  "clave" TEXT,
  "usuarioId" VARCHAR(50),
  "peopleId" VARCHAR(50),
  "estadoInactivo" BOOLEAN DEFAULT FALSE,
  "fechaContrato" DATE,
  "finalContrato" DATE,
  "vigencia" INTEGER,
  "extensionCount" INTEGER DEFAULT 0,
  "extensionHistory" JSONB DEFAULT '[]',
  "onHoldCount" INTEGER DEFAULT 0,
  "onHoldHistory" JSONB DEFAULT '[]',
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX',
  FOREIGN KEY ("studentId") REFERENCES "PEOPLE"("_id") ON DELETE CASCADE,
  FOREIGN KEY ("peopleId") REFERENCES "PEOPLE"("_id") ON DELETE SET NULL
);

CREATE INDEX idx_academica_student ON "ACADEMICA"("studentId");
CREATE INDEX idx_academica_numeroid ON "ACADEMICA"("numeroId");
CREATE INDEX idx_academica_nivel ON "ACADEMICA"("nivel");
CREATE INDEX idx_academica_step ON "ACADEMICA"("step");
CREATE INDEX idx_academica_contrato ON "ACADEMICA"("contrato");
CREATE INDEX idx_academica_asesor ON "ACADEMICA"("asesor");
CREATE INDEX idx_academica_inactivo ON "ACADEMICA"("estadoInactivo");
CREATE INDEX idx_academica_people ON "ACADEMICA"("peopleId");

COMMENT ON TABLE "ACADEMICA" IS 'Academic progress tracking for students';
COMMENT ON COLUMN "ACADEMICA"."nivelParalelo" IS 'Parallel level (ESS) that doesn''t block main level progression';

-- ============================================
-- 6. CALENDARIO (Events/Sessions - 5-10K records)
-- Dependency: USUARIOS_ROLES (advisor), NIVELES
-- Priority: ALTA
-- ============================================
CREATE TABLE "CALENDARIO" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "tipo" VARCHAR(50) NOT NULL CHECK ("tipo" IN ('SESSION', 'CLUB', 'WELCOME', 'COMPLEMENTARIA')),
  "fecha" DATE NOT NULL,
  "hora" VARCHAR(10) NOT NULL,
  "advisor" VARCHAR(255) NOT NULL,
  "nivel" VARCHAR(20) NOT NULL,
  "step" VARCHAR(50),
  "club" VARCHAR(100),
  "titulo" TEXT NOT NULL,
  "observaciones" TEXT,
  "linkZoom" TEXT,
  "limiteUsuarios" INTEGER DEFAULT 10,
  "inscritos" INTEGER DEFAULT 0,
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX'
);

CREATE INDEX idx_calendario_fecha ON "CALENDARIO"("fecha");
CREATE INDEX idx_calendario_tipo ON "CALENDARIO"("tipo");
CREATE INDEX idx_calendario_advisor ON "CALENDARIO"("advisor");
CREATE INDEX idx_calendario_nivel ON "CALENDARIO"("nivel");
CREATE INDEX idx_calendario_fecha_hora ON "CALENDARIO"("fecha", "hora");
CREATE INDEX idx_calendario_fecha_tipo ON "CALENDARIO"("fecha", "tipo");

COMMENT ON TABLE "CALENDARIO" IS 'Calendar events for classes, clubs, welcome sessions, and complementary activities';
COMMENT ON COLUMN "CALENDARIO"."inscritos" IS 'Count of enrolled students (denormalized for performance)';

-- ============================================
-- 7. ACADEMICA_BOOKINGS (Enrollments - 50K+ records)
-- Dependency: ACADEMICA, CALENDARIO
-- Priority: ALTA
-- ============================================
CREATE TABLE "ACADEMICA_BOOKINGS" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "studentId" VARCHAR(50) NOT NULL,
  "eventoId" VARCHAR(50) NOT NULL,
  "tipo" VARCHAR(50) NOT NULL,
  "fecha" DATE NOT NULL,
  "hora" VARCHAR(10) NOT NULL,
  "advisor" VARCHAR(255) NOT NULL,
  "nivel" VARCHAR(20) NOT NULL,
  "step" VARCHAR(50),
  "asistencia" BOOLEAN DEFAULT FALSE,
  "asistio" BOOLEAN DEFAULT FALSE,
  "participacion" BOOLEAN DEFAULT FALSE,
  "noAprobo" BOOLEAN DEFAULT FALSE,
  "cancelo" BOOLEAN DEFAULT FALSE,
  "calificacion" INTEGER CHECK ("calificacion" BETWEEN 1 AND 5),
  "anotaciones" TEXT,
  "comentarios" TEXT,
  "advisorAnotaciones" TEXT,
  "actividadPropuesta" TEXT,
  "linkZoom" TEXT,
  "primerNombre" VARCHAR(255),
  "primerApellido" VARCHAR(255),
  "asignadoPor" VARCHAR(255),
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX',
  FOREIGN KEY ("studentId") REFERENCES "PEOPLE"("_id") ON DELETE CASCADE,
  FOREIGN KEY ("eventoId") REFERENCES "CALENDARIO"("_id") ON DELETE CASCADE
);

CREATE INDEX idx_bookings_student ON "ACADEMICA_BOOKINGS"("studentId");
CREATE INDEX idx_bookings_evento ON "ACADEMICA_BOOKINGS"("eventoId");
CREATE INDEX idx_bookings_fecha ON "ACADEMICA_BOOKINGS"("fecha");
CREATE INDEX idx_bookings_advisor ON "ACADEMICA_BOOKINGS"("advisor");
CREATE INDEX idx_bookings_nivel ON "ACADEMICA_BOOKINGS"("nivel");
CREATE INDEX idx_bookings_asistencia ON "ACADEMICA_BOOKINGS"("asistencia");
CREATE INDEX idx_bookings_asistio ON "ACADEMICA_BOOKINGS"("asistio");
CREATE INDEX idx_bookings_student_fecha ON "ACADEMICA_BOOKINGS"("studentId", "fecha");
CREATE INDEX idx_bookings_evento_student ON "ACADEMICA_BOOKINGS"("eventoId", "studentId");

COMMENT ON TABLE "ACADEMICA_BOOKINGS" IS 'Student enrollments in calendar events with attendance and evaluation data';
COMMENT ON COLUMN "ACADEMICA_BOOKINGS"."asistencia" IS 'Legacy field for attendance (use asistio instead)';
COMMENT ON COLUMN "ACADEMICA_BOOKINGS"."asistio" IS 'Attendance flag (boolean)';

-- ============================================
-- 8. FINANCIEROS (Financial Records - 3-5K records)
-- Dependency: PEOPLE (contrato)
-- Priority: MEDIA
-- ============================================
CREATE TABLE "FINANCIEROS" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "contrato" VARCHAR(50) NOT NULL,
  "numeroId" VARCHAR(50),
  "primerNombre" VARCHAR(255),
  "primerApellido" VARCHAR(255),
  "totalPlan" VARCHAR(100),
  "valorCuota" VARCHAR(100),
  "pagoInscripcion" VARCHAR(100),
  "numeroCuotas" INTEGER,
  "cuotasPagadas" INTEGER DEFAULT 0,
  "saldo" VARCHAR(100),
  "fechaPago" DATE,
  "fechaUltimoPago" DATE,
  "medioPago" VARCHAR(100),
  "estado" VARCHAR(50) CHECK ("estado" IN ('Al día', 'En mora', 'Vencido')),
  "vigencia" VARCHAR(50),
  "titularId" VARCHAR(50),
  "documentacion" JSONB DEFAULT '[]',
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX'
);

CREATE INDEX idx_financieros_contrato ON "FINANCIEROS"("contrato");
CREATE INDEX idx_financieros_estado ON "FINANCIEROS"("estado");
CREATE INDEX idx_financieros_numeroid ON "FINANCIEROS"("numeroId");
CREATE INDEX idx_financieros_titular ON "FINANCIEROS"("titularId");

COMMENT ON TABLE "FINANCIEROS" IS 'Financial records associated with contracts';
COMMENT ON COLUMN "FINANCIEROS"."documentacion" IS 'Array of document metadata (URLs, types, dates)';

-- ============================================
-- 9. NIVELES_MATERIAL (Course Materials - 100-200 records)
-- Dependency: NIVELES
-- Priority: BAJA
-- ============================================
CREATE TABLE "NIVELES_MATERIAL" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "nivelCode" VARCHAR(20) NOT NULL,
  "titulo" VARCHAR(255) NOT NULL,
  "descripcion" TEXT,
  "url" TEXT,
  "tipo" VARCHAR(50),
  "orden" INTEGER,
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX'
);

CREATE INDEX idx_material_nivel ON "NIVELES_MATERIAL"("nivelCode");
CREATE INDEX idx_material_orden ON "NIVELES_MATERIAL"("orden");

COMMENT ON TABLE "NIVELES_MATERIAL" IS 'Study materials associated with academic levels';

-- ============================================
-- 10. CLUBS (20-30 records)
-- Dependency: None
-- Priority: BAJA
-- ============================================
CREATE TABLE "CLUBS" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "nombre" VARCHAR(255) NOT NULL UNIQUE,
  "descripcion" TEXT,
  "activo" BOOLEAN DEFAULT TRUE,
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX'
);

CREATE INDEX idx_clubs_activo ON "CLUBS"("activo");
CREATE INDEX idx_clubs_nombre ON "CLUBS"("nombre");

COMMENT ON TABLE "CLUBS" IS 'Club definitions for supplementary activities';

-- ============================================
-- 11. COMMENTS (Comments on PEOPLE/STUDENTS)
-- Dependency: PEOPLE
-- Priority: MEDIA
-- ============================================
CREATE TABLE "COMMENTS" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "targetId" VARCHAR(50) NOT NULL,
  "targetType" VARCHAR(20) NOT NULL CHECK ("targetType" IN ('PERSON', 'STUDENT')),
  "tipo" VARCHAR(50) CHECK ("tipo" IN ('Información', 'Seguimiento', 'Alerta', 'Nota')),
  "prioridad" VARCHAR(50) CHECK ("prioridad" IN ('Baja', 'Media', 'Alta', 'Crítica')),
  "comentario" TEXT NOT NULL,
  "autor" VARCHAR(255) NOT NULL,
  "fechaCreacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX'
);

CREATE INDEX idx_comments_target ON "COMMENTS"("targetId", "targetType");
CREATE INDEX idx_comments_fecha ON "COMMENTS"("fechaCreacion" DESC);
CREATE INDEX idx_comments_autor ON "COMMENTS"("autor");

COMMENT ON TABLE "COMMENTS" IS 'Comments/notes on person or student records';

-- ============================================
-- 12. STEP_OVERRIDES (Step Override Tracking)
-- Dependency: PEOPLE, ACADEMICA
-- Priority: MEDIA
-- ============================================
CREATE TABLE "STEP_OVERRIDES" (
  "_id" VARCHAR(50) PRIMARY KEY,
  "studentId" VARCHAR(50) NOT NULL,
  "idEnAcademica" VARCHAR(50),
  "academicaId" VARCHAR(50),
  "nivel" VARCHAR(20) NOT NULL,
  "step" VARCHAR(50) NOT NULL,
  "isCompleted" BOOLEAN DEFAULT FALSE,
  "primerNombre" VARCHAR(255),
  "primerApellido" VARCHAR(255),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_createdDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_updatedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "_owner" VARCHAR(50),
  "origen" VARCHAR(10) DEFAULT 'WIX',
  FOREIGN KEY ("studentId") REFERENCES "PEOPLE"("_id") ON DELETE CASCADE,
  FOREIGN KEY ("academicaId") REFERENCES "ACADEMICA"("_id") ON DELETE SET NULL
);

CREATE INDEX idx_overrides_student ON "STEP_OVERRIDES"("studentId");
CREATE INDEX idx_overrides_nivel_step ON "STEP_OVERRIDES"("nivel", "step");
CREATE INDEX idx_overrides_completed ON "STEP_OVERRIDES"("isCompleted");

COMMENT ON TABLE "STEP_OVERRIDES" IS 'Manual step completion overrides (jump steps feature)';

-- ============================================
-- Triggers for automatic _updatedDate
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW."_updatedDate" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_niveles_updated_date BEFORE UPDATE ON "NIVELES" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_rol_permisos_updated_date BEFORE UPDATE ON "ROL_PERMISOS" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_usuarios_updated_date BEFORE UPDATE ON "USUARIOS_ROLES" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_people_updated_date BEFORE UPDATE ON "PEOPLE" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_academica_updated_date BEFORE UPDATE ON "ACADEMICA" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_calendario_updated_date BEFORE UPDATE ON "CALENDARIO" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_bookings_updated_date BEFORE UPDATE ON "ACADEMICA_BOOKINGS" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_financieros_updated_date BEFORE UPDATE ON "FINANCIEROS" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_material_updated_date BEFORE UPDATE ON "NIVELES_MATERIAL" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_clubs_updated_date BEFORE UPDATE ON "CLUBS" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_comments_updated_date BEFORE UPDATE ON "COMMENTS" FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_overrides_updated_date BEFORE UPDATE ON "STEP_OVERRIDES" FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ============================================
-- Views for common queries
-- ============================================

-- Active students with their current level and advisor
CREATE VIEW "ACTIVE_STUDENTS" AS
SELECT
  p."_id",
  p."numeroId",
  p."primerNombre",
  p."primerApellido",
  p."email",
  p."nivel",
  p."step",
  p."nivelParalelo",
  p."stepParalelo",
  p."asesor",
  p."contrato",
  p."finalContrato",
  p."estadoInactivo"
FROM "PEOPLE" p
WHERE p."tipoUsuario" = 'BENEFICIARIO'
  AND p."estadoInactivo" = FALSE
ORDER BY p."primerApellido", p."primerNombre";

COMMENT ON VIEW "ACTIVE_STUDENTS" IS 'Active students (BENEFICIARIO) with key academic info';

-- ============================================
-- Grant permissions (customize as needed)
-- ============================================

-- Example: Create role and grant permissions
-- CREATE ROLE lgs_admin_user WITH LOGIN PASSWORD 'your_password';
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lgs_admin_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lgs_admin_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO lgs_admin_user;

-- ============================================
-- Schema version tracking
-- ============================================

CREATE TABLE IF NOT EXISTS "_schema_version" (
  "version" VARCHAR(10) PRIMARY KEY,
  "applied_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "description" TEXT
);

INSERT INTO "_schema_version" ("version", "description")
VALUES ('1.0.0', 'Initial schema with 12 tables migrated from Wix');

-- ============================================
-- End of schema
-- ============================================
