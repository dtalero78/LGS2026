# 📋 Plan de Migración Next.js → PostgreSQL

**Fecha inicio**: 2026-01-19
**Estimado**: 3-4 días (~16 horas)
**Prerequisito**: ✅ Acceso a PostgreSQL configurado

---

## 🎯 Objetivo

Migrar todos los endpoints de Next.js de Wix a PostgreSQL manteniendo la misma estructura de datos (camelCase) para evitar cambios en el frontend.

---

## 📊 Estado Actual

### ✅ Completado
- PostgreSQL con 109,271 registros (7 colecciones)
- Cliente PostgreSQL (`src/lib/postgres.ts`)
- Sistema de autenticación con PostgreSQL (`src/lib/auth-postgres.ts`)
- Script de testing de conexión (`test-postgres-connection.js`)

### ⏳ Pendiente
- Configurar acceso a PostgreSQL desde tu IP
- Crear 58 endpoints nuevos en `src/app/api/postgres/`
- Actualizar rutas de la aplicación
- Testing exhaustivo

---

## 🚀 Fase 1: Preparación y Testing (30 min)

### 1.1 Configurar Acceso a PostgreSQL
Ver guía: [CONFIGURAR_ACCESO_POSTGRES.md](CONFIGURAR_ACCESO_POSTGRES.md)

- [ ] Agregar IP a Digital Ocean Trusted Sources
- [ ] Verificar conexión: `node test-postgres-connection.js`
- [ ] Confirmar que los 5 tests pasan

### 1.2 Crear Estructura de Carpetas

```bash
mkdir -p src/app/api/postgres/{auth,search,students,calendar,events,academic,permissions}
```

---

## 🔐 Fase 2: Endpoints Críticos - Autenticación y Permisos (Día 1 - 4h)

### 2.1 Autenticación (1h)

**Archivo a modificar**: `src/app/api/auth/[...nextauth]/route.ts`

**Cambio**:
```typescript
// ANTES:
import { authOptions } from '@/lib/auth'

// DESPUÉS:
import { authOptions } from '@/lib/auth-postgres'
```

**Testing**:
- [ ] Login con cada rol (SUPER_ADMIN, ADMIN, ADVISOR, etc.)
- [ ] Verificar que fallback a Wix funciona
- [ ] Verificar que fallback a test users funciona
- [ ] Verificar JWT token contiene rol correcto

**SQL queries involucradas**:
```sql
SELECT "_id", "email", "password", "nombre", "rol", "activo"
FROM "USUARIOS_ROLES"
WHERE "email" = $1
```

---

### 2.2 Permisos (1h)

**Archivo nuevo**: `src/app/api/postgres/permissions/route.ts`

**Funcionalidad**:
- Obtener permisos de un rol específico
- Obtener todos los roles con sus permisos

**Implementación**:
```typescript
import { NextResponse } from 'next/server';
import { queryOne, queryMany } from '@/lib/postgres';

// GET /api/postgres/permissions?rol=ADMIN
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rol = searchParams.get('rol');

  if (rol) {
    // Get specific role permissions
    const result = await queryOne(
      `SELECT "rol", "permisos", "descripcion", "activo"
       FROM "ROL_PERMISOS"
       WHERE "rol" = $1`,
      [rol]
    );

    if (!result) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      rol: result.rol,
      permisos: result.permisos, // Already parsed as array by PostgreSQL
      descripcion: result.descripcion,
    });
  } else {
    // Get all roles
    const results = await queryMany(
      `SELECT "rol", "permisos", "descripcion", "activo"
       FROM "ROL_PERMISOS"
       WHERE "activo" = true
       ORDER BY "rol"`
    );

    return NextResponse.json({
      success: true,
      roles: results,
    });
  }
}
```

**Testing**:
- [ ] GET `/api/postgres/permissions?rol=ADMIN`
- [ ] GET `/api/postgres/permissions` (todos los roles)
- [ ] Verificar que `permisos` es array de strings
- [ ] Verificar que menú se filtra correctamente

**Archivo a modificar**: `src/lib/middleware-permissions.ts`

Cambiar función `getPermissionsForRoleFromWix`:
```typescript
// ANTES: fetch a Wix
const response = await fetch(...)

// DESPUÉS: query a PostgreSQL
import { queryOne } from './postgres';

const result = await queryOne(
  `SELECT "permisos" FROM "ROL_PERMISOS" WHERE "rol" = $1`,
  [role]
);
return result?.permisos || [];
```

---

### 2.3 Búsqueda de Estudiantes (2h)

**Archivos nuevos**:
1. `src/app/api/postgres/search/by-name/route.ts`
2. `src/app/api/postgres/search/by-document/route.ts`
3. `src/app/api/postgres/search/by-contract/route.ts`

#### 2.3.1 Búsqueda por Nombre

```typescript
// src/app/api/postgres/search/by-name/route.ts
import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/postgres';

// GET /api/postgres/search/by-name?query=juan
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query || query.length < 2) {
    return NextResponse.json({
      error: 'Query must be at least 2 characters'
    }, { status: 400 });
  }

  try {
    const results = await queryMany(
      `SELECT
        "_id",
        "numeroId",
        "primerNombre",
        "segundoNombre",
        "primerApellido",
        "segundoApellido",
        "tipoUsuario",
        "email",
        "contrato",
        "nivel",
        "step",
        "estadoInactivo",
        "vigencia",
        "finalContrato"
       FROM "PEOPLE"
       WHERE
         (LOWER("primerNombre") LIKE LOWER($1) OR
          LOWER("segundoNombre") LIKE LOWER($1) OR
          LOWER("primerApellido") LIKE LOWER($1) OR
          LOWER("segundoApellido") LIKE LOWER($1))
       ORDER BY "primerNombre", "primerApellido"
       LIMIT 100`,
      [`%${query}%`]
    );

    return NextResponse.json({
      success: true,
      items: results,
      total: results.length,
    });
  } catch (error: any) {
    console.error('Error searching by name:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

#### 2.3.2 Búsqueda por Documento

```typescript
// src/app/api/postgres/search/by-document/route.ts
import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/postgres';

// GET /api/postgres/search/by-document?query=1234567890
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query || query.length < 3) {
    return NextResponse.json({
      error: 'Query must be at least 3 characters'
    }, { status: 400 });
  }

  try {
    const results = await queryMany(
      `SELECT
        "_id",
        "numeroId",
        "primerNombre",
        "segundoNombre",
        "primerApellido",
        "segundoApellido",
        "tipoUsuario",
        "email",
        "contrato",
        "nivel",
        "step",
        "estadoInactivo",
        "vigencia",
        "finalContrato"
       FROM "PEOPLE"
       WHERE "numeroId" LIKE $1
       ORDER BY "primerNombre", "primerApellido"
       LIMIT 100`,
      [`%${query}%`]
    );

    return NextResponse.json({
      success: true,
      items: results,
      total: results.length,
    });
  } catch (error: any) {
    console.error('Error searching by document:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

#### 2.3.3 Búsqueda por Contrato

```typescript
// src/app/api/postgres/search/by-contract/route.ts
import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/postgres';

// GET /api/postgres/search/by-contract?query=CON-2024-001
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query || query.length < 3) {
    return NextResponse.json({
      error: 'Query must be at least 3 characters'
    }, { status: 400 });
  }

  try {
    const results = await queryMany(
      `SELECT
        "_id",
        "numeroId",
        "primerNombre",
        "segundoNombre",
        "primerApellido",
        "segundoApellido",
        "tipoUsuario",
        "email",
        "contrato",
        "nivel",
        "step",
        "estadoInactivo",
        "vigencia",
        "finalContrato"
       FROM "PEOPLE"
       WHERE "contrato" LIKE $1
       ORDER BY "primerNombre", "primerApellido"
       LIMIT 100`,
      [`%${query}%`]
    );

    return NextResponse.json({
      success: true,
      items: results,
      total: results.length,
    });
  } catch (error: any) {
    console.error('Error searching by contract:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

**Testing**:
- [ ] Búsqueda por nombre: "juan", "maria", "pérez"
- [ ] Búsqueda por documento: "123456", "CC", "TI"
- [ ] Búsqueda por contrato: "CON", "2024"
- [ ] Verificar límite de 100 resultados
- [ ] Verificar case-insensitive search
- [ ] Verificar que frontend muestra resultados correctamente

---

## 📚 Fase 3: Endpoints de Lectura - Perfiles y Calendario (Día 2 - 4h)

### 3.1 Student Profile (1.5h)

**Archivo nuevo**: `src/app/api/postgres/students/[id]/route.ts`

```typescript
// GET /api/postgres/students/[id]
import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/postgres';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const student = await queryOne(
      `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
      [params.id]
    );

    if (!student) {
      return NextResponse.json({
        error: 'Student not found'
      }, { status: 404 });
    }

    // Parse JSONB fields if needed
    if (typeof student.onHoldHistory === 'string') {
      student.onHoldHistory = JSON.parse(student.onHoldHistory || '[]');
    }
    if (typeof student.extensionHistory === 'string') {
      student.extensionHistory = JSON.parse(student.extensionHistory || '[]');
    }

    return NextResponse.json({
      success: true,
      student,
    });
  } catch (error: any) {
    console.error('Error getting student:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

**Archivo nuevo**: `src/app/api/postgres/students/[id]/academic/route.ts`

```typescript
// GET /api/postgres/students/[id]/academic
import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/postgres';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const numeroId = searchParams.get('numeroId');

  if (!numeroId) {
    return NextResponse.json({
      error: 'numeroId required'
    }, { status: 400 });
  }

  try {
    const classes = await queryMany(
      `SELECT * FROM "ACADEMICA"
       WHERE "numeroId" = $1
       ORDER BY "_createdDate" DESC`,
      [numeroId]
    );

    return NextResponse.json({
      success: true,
      classes,
      total: classes.length,
    });
  } catch (error: any) {
    console.error('Error getting academic records:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

**Testing**:
- [ ] GET `/api/postgres/students/[id]` - Obtener perfil completo
- [ ] GET `/api/postgres/students/[id]/academic?numeroId=XXX` - Historial académico
- [ ] Verificar que JSONB se parsea correctamente
- [ ] Verificar que frontend muestra datos correctamente

---

### 3.2 Calendario (2h)

**Archivo nuevo**: `src/app/api/postgres/calendar/events/route.ts`

```typescript
// GET /api/postgres/calendar/events?month=2024-01
import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/postgres';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // Format: YYYY-MM

  if (!month) {
    return NextResponse.json({
      error: 'month parameter required (YYYY-MM)'
    }, { status: 400 });
  }

  try {
    // Parse month to get start/end dates
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const events = await queryMany(
      `SELECT * FROM "CALENDARIO"
       WHERE "fecha" >= $1 AND "fecha" <= $2
       ORDER BY "fecha", "hora"`,
      [startDate.toISOString(), endDate.toISOString()]
    );

    return NextResponse.json({
      success: true,
      events,
      total: events.length,
      month,
    });
  } catch (error: any) {
    console.error('Error getting calendar events:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

**Archivo nuevo**: `src/app/api/postgres/calendar/bookings/route.ts`

```typescript
// GET /api/postgres/calendar/bookings?eventId=XXX
import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/postgres';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({
      error: 'eventId required'
    }, { status: 400 });
  }

  try {
    const bookings = await queryMany(
      `SELECT
        ab.*,
        p."primerNombre",
        p."primerApellido",
        p."email"
       FROM "ACADEMICA_BOOKINGS" ab
       LEFT JOIN "PEOPLE" p ON ab."studentId" = p."_id"
       WHERE ab."eventoId" = $1
       ORDER BY p."primerNombre", p."primerApellido"`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      bookings,
      total: bookings.length,
    });
  } catch (error: any) {
    console.error('Error getting bookings:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

**Testing**:
- [ ] GET `/api/postgres/calendar/events?month=2024-01`
- [ ] GET `/api/postgres/calendar/bookings?eventId=XXX`
- [ ] Verificar que JOIN funciona correctamente
- [ ] Verificar rendimiento con meses con muchos eventos
- [ ] Verificar cache del frontend

---

### 3.3 Advisors (30min)

**Archivo nuevo**: `src/app/api/postgres/advisors/route.ts`

```typescript
// GET /api/postgres/advisors
import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/postgres';

export async function GET() {
  try {
    const advisors = await queryMany(
      `SELECT
        "email",
        "nombre",
        "rol",
        "activo",
        "_createdDate"
       FROM "USUARIOS_ROLES"
       WHERE "rol" IN ('ADVISOR', 'ADMIN', 'SUPER_ADMIN')
         AND "activo" = true
       ORDER BY "nombre"`
    );

    return NextResponse.json({
      success: true,
      advisors,
      total: advisors.length,
    });
  } catch (error: any) {
    console.error('Error getting advisors:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

**Testing**:
- [ ] GET `/api/postgres/advisors`
- [ ] Verificar que solo muestra usuarios activos
- [ ] Verificar orden alfabético

---

## ✏️ Fase 4: Endpoints de Escritura - Updates y CRUD (Día 3 - 4h)

### 4.1 Update Student (1h)

**Archivo nuevo**: `src/app/api/postgres/students/[id]/update/route.ts`

```typescript
// PUT /api/postgres/students/[id]/update
import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Allowed fields to update
    const allowedFields = [
      'primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido',
      'email', 'celular', 'nivel', 'step', 'nivelParalelo', 'stepParalelo',
      'estadoInactivo', 'vigencia', 'finalContrato'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({
        error: 'No valid fields to update'
      }, { status: 400 });
    }

    // Add _updatedDate
    updates.push(`"_updatedDate" = NOW()`);

    // Add student ID as last parameter
    values.push(params.id);

    const result = await query(
      `UPDATE "PEOPLE"
       SET ${updates.join(', ')}
       WHERE "_id" = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({
        error: 'Student not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      student: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating student:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

**Testing**:
- [ ] PUT `/api/postgres/students/[id]/update` - Actualizar nombre
- [ ] PUT `/api/postgres/students/[id]/update` - Actualizar nivel
- [ ] Verificar que `_updatedDate` se actualiza automáticamente
- [ ] Verificar que campos no permitidos se ignoran

---

### 4.2 Asistencia y Evaluación (1.5h)

**Archivo nuevo**: `src/app/api/postgres/academic/attendance/route.ts`

```typescript
// POST /api/postgres/academic/attendance
import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, asistencia, evaluacion, comentarios } = body;

    if (!bookingId) {
      return NextResponse.json({
        error: 'bookingId required'
      }, { status: 400 });
    }

    const result = await query(
      `UPDATE "ACADEMICA_BOOKINGS"
       SET
         "asistencia" = $1,
         "evaluacion" = $2,
         "comentarios" = $3,
         "_updatedDate" = NOW()
       WHERE "_id" = $4
       RETURNING *`,
      [asistencia, evaluacion, comentarios, bookingId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({
        error: 'Booking not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      booking: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error marking attendance:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

**Testing**:
- [ ] POST `/api/postgres/academic/attendance` - Marcar presente
- [ ] POST `/api/postgres/academic/attendance` - Marcar ausente
- [ ] Verificar evaluación y comentarios se guardan
- [ ] Verificar que frontend refleja cambios

---

### 4.3 OnHold y Contratos (1.5h)

**Archivo nuevo**: `src/app/api/postgres/students/onhold/route.ts`

```typescript
// POST /api/postgres/students/onhold
import { NextResponse } from 'next/server';
import { query, transaction } from '@/lib/postgres';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, setOnHold, fechaOnHold, fechaFinOnHold, motivo } = body;

    if (!studentId) {
      return NextResponse.json({
        error: 'studentId required'
      }, { status: 400 });
    }

    if (setOnHold) {
      // Activate OnHold
      const result = await query(
        `UPDATE "PEOPLE"
         SET
           "estadoInactivo" = true,
           "fechaOnHold" = $1,
           "fechaFinOnHold" = $2,
           "onHoldCount" = COALESCE("onHoldCount", 0) + 1,
           "onHoldHistory" =
             COALESCE("onHoldHistory", '[]'::jsonb) ||
             jsonb_build_object(
               'fechaActivacion', NOW(),
               'fechaOnHold', $1,
               'fechaFinOnHold', $2,
               'motivo', $3,
               'activadoPor', $4
             )::jsonb,
           "_updatedDate" = NOW()
         WHERE "_id" = $5
         RETURNING *`,
        [fechaOnHold, fechaFinOnHold, motivo, 'Admin', studentId]
      );

      return NextResponse.json({
        success: true,
        student: result.rows[0],
      });
    } else {
      // Deactivate OnHold - Calculate extension
      // Note: This is a simplified version
      // Full version should calculate days and extend finalContrato
      const result = await query(
        `UPDATE "PEOPLE"
         SET
           "estadoInactivo" = false,
           "fechaOnHold" = NULL,
           "fechaFinOnHold" = NULL,
           "_updatedDate" = NOW()
         WHERE "_id" = $1
         RETURNING *`,
        [studentId]
      );

      return NextResponse.json({
        success: true,
        student: result.rows[0],
      });
    }
  } catch (error: any) {
    console.error('Error toggling OnHold:', error);
    return NextResponse.json({
      error: 'Database error',
      details: error.message
    }, { status: 500 });
  }
}
```

**Testing**:
- [ ] POST `/api/postgres/students/onhold` - Activar OnHold
- [ ] POST `/api/postgres/students/onhold` - Desactivar OnHold
- [ ] Verificar que `onHoldHistory` se actualiza
- [ ] Verificar extensión automática del contrato

---

## 🎨 Fase 5: Endpoints Restantes - Eventos y Reportes (Día 3-4 - 4h)

### 5.1 Crear/Actualizar/Eliminar Eventos (2h)

Ver implementación completa en [interaccionWix.md](interaccionWix.md) líneas 200-400.

**Archivos nuevos**:
- `src/app/api/postgres/events/create/route.ts`
- `src/app/api/postgres/events/[id]/update/route.ts`
- `src/app/api/postgres/events/[id]/delete/route.ts`

**Testing**:
- [ ] POST `/api/postgres/events/create` - Crear evento
- [ ] PUT `/api/postgres/events/[id]/update` - Actualizar evento
- [ ] DELETE `/api/postgres/events/[id]/delete` - Eliminar evento
- [ ] Verificar que bookings relacionados se actualizan

---

### 5.2 Comentarios (1h)

**Archivo nuevo**: `src/app/api/postgres/comments/route.ts`

Implementación similar a eventos.

---

### 5.3 Exports y Reportes (1h)

Mantener lógica actual, cambiar solo el data source de Wix a PostgreSQL.

---

## 🧪 Fase 6: Testing Exhaustivo (Día 4 - 4h)

### 6.1 Testing Funcional

- [ ] Login con todos los roles
- [ ] Búsqueda (nombre, documento, contrato)
- [ ] Ver perfil de estudiante
- [ ] Ver historial académico
- [ ] Calendario (ver eventos, ver inscripciones)
- [ ] Marcar asistencia
- [ ] Crear evento
- [ ] Actualizar evento
- [ ] Eliminar evento
- [ ] Activar/Desactivar OnHold
- [ ] Exportar a CSV/Excel

### 6.2 Testing de Performance

- [ ] Login: < 500ms
- [ ] Búsqueda: < 1s
- [ ] Cargar perfil: < 500ms
- [ ] Cargar calendario mes: < 1s
- [ ] Marcar asistencia: < 500ms

### 6.3 Testing de Permisos

- [ ] SUPER_ADMIN ve todo
- [ ] ADMIN ve todo menos eliminar personas
- [ ] ADVISOR ve solo su área
- [ ] TALERO ve solo lista de advisors
- [ ] READONLY no puede editar nada

---

## 🚀 Fase 7: Deploy a Producción (30min)

### 7.1 Preparación

- [ ] Backup de PostgreSQL
- [ ] Crear tag de git: `v2.0.0-postgres`
- [ ] Actualizar variables de entorno en Digital Ocean

### 7.2 Deploy

- [ ] Push a main branch
- [ ] Monitorear logs de deploy
- [ ] Verificar que app arranca sin errores

### 7.3 Validación Post-Deploy

- [ ] Login en producción
- [ ] Smoke test de funcionalidades críticas
- [ ] Monitorear logs por 1 hora
- [ ] Verificar métricas de performance

### 7.4 Apagar Wix

- [ ] Después de 24h sin issues, considerar apagar Wix
- [ ] Mantener backup de Wix por 30 días

---

## 📊 Métricas de Éxito

| Métrica | Target | Actual |
|---------|--------|--------|
| Login time | < 500ms | - |
| Search time | < 1s | - |
| Page load | < 2s | - |
| Uptime | > 99% | - |
| Errors | < 0.1% | - |

---

## 🔄 Plan de Rollback

Si algo falla después del deploy:

1. **Revertir código** a versión anterior
2. **Cambiar variable de entorno** para usar Wix
3. **Redeploy** (5-10 minutos de downtime)

---

## 📝 Notas Importantes

### Diferencias Wix vs PostgreSQL

1. **Fechas**: PostgreSQL usa `TIMESTAMP WITH TIME ZONE`, Wix usa ISO strings
2. **JSONB**: PostgreSQL auto-parsea, Wix retorna strings
3. **NULL vs empty string**: PostgreSQL distingue, Wix a veces mezcla
4. **Case sensitivity**: PostgreSQL respeta case en quoted identifiers

### Tips de Performance

1. **Usar índices**: Ya están creados en el schema
2. **Limitar resultados**: Siempre usar `LIMIT`
3. **Evitar SELECT ***: Seleccionar solo campos necesarios
4. **Connection pooling**: Ya configurado (max 20)

---

## ✅ Checklist Final

- [ ] 58 endpoints migrados
- [ ] Testing completo (6.1, 6.2, 6.3)
- [ ] Documentación actualizada
- [ ] Variables de entorno configuradas
- [ ] Deploy exitoso
- [ ] Monitoreo activo
- [ ] Wix apagado (después de 24h)

---

**Próximo paso**: Configurar acceso a PostgreSQL y comenzar Fase 1 🚀
