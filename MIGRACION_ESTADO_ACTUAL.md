# Estado Actual de la Migración Wix → PostgreSQL

**Fecha**: 2026-01-19
**Sesión**: Continuación de sesión previa

---

## Resumen Ejecutivo

### ✅ Migraciones Completadas

| Colección | Registros | Duración | Tasa | Estado |
|-----------|-----------|----------|------|--------|
| NIVELES | 48/48 | 4.42s | 10.87 rec/s | ✅ COMPLETO |
| ROL_PERMISOS | 14/14 | ~5s | ~2.8 rec/s | ✅ COMPLETO |
| USUARIOS_ROLES | 77/77 | ~8s | ~9.6 rec/s | ✅ COMPLETO |
| **TOTAL** | **139** | **17.42s** | **7.98 rec/s** | **✅** |

### 🔄 En Progreso

| Colección | Estado | Progreso Estimado |
|-----------|--------|-------------------|
| PEOPLE | 🔄 Migrando | ~8,476 registros (ETA: ~15 min) |

### ⏳ Pendientes

| Colección | Registros Estimados | Prioridad |
|-----------|---------------------|-----------|
| ACADEMICA | 4,851 | ALTA |
| CALENDARIO | 16,699 | ALTA |
| ACADEMICA_BOOKINGS | 87,821 | ALTA |
| FINANCIEROS | ~3,000-5,000 | MEDIA |
| NIVELES_MATERIAL | ~100-200 | BAJA |
| CLUBS | ~20-30 | BAJA |
| COMMENTS | Variable | BAJA |
| STEP_OVERRIDES | Variable | BAJA |

---

## Problemas Encontrados y Resueltos

### 1. Schema Incompleto (PEOPLE)

#### Problema
El schema SQL original se creó basándose en documentación, pero los datos reales de Wix tienen **más campos** de los documentados.

#### Campos Faltantes Descubiertos
```sql
-- Primera ronda (14 campos)
agenteAsignado, asesorAsignado, consentimientoDeclarativo, edad,
hashConsentimiento, inicioContrato, link-people-1-numeroId,
link-people-numeroId, link-people-numeroId-3, link-people-numeroId-4,
medioPago, nombreCompleto, numeroContrato, numeroDocumentoVerificado,
observacionesContrato

-- Segunda ronda (4 campos)
documentacion, comentarios, fechaIngreso, ultimoStep

-- Tercera ronda (1 campo)
plan
```

**Total: 19 campos adicionales agregados**

#### Solución
```sql
-- Ejecutados via ALTER TABLE
ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "campo" TIPO;
```

### 2. Constraints Demasiado Estrictos

#### Problema
Algunos registros en Wix tienen valores NULL o vacíos en campos marcados como NOT NULL en el schema.

#### Constraints Relajados
```sql
ALTER TABLE "PEOPLE" ALTER COLUMN "contrato" DROP NOT NULL;      -- Titulares no tienen contrato
ALTER TABLE "PEOPLE" ALTER COLUMN "numeroId" DROP NOT NULL;      -- Algunos registros incompletos
ALTER TABLE "PEOPLE" ALTER COLUMN "primerNombre" DROP NOT NULL;  -- Registros incompletos
ALTER TABLE "PEOPLE" ALTER COLUMN "primerApellido" DROP NOT NULL; -- Registros incompletos
ALTER TABLE "PEOPLE" DROP CONSTRAINT "PEOPLE_numeroId_key";      -- Titular + Beneficiarios comparten numeroId
```

**Razón**: Wix tiene registros incompletos y lógica de relación TITULAR/BENEFICIARIO que comparte `numeroId`.

### 3. Fechas Corruptas

#### Problema
Algunos registros tienen fechas inválidas:
- Fechas vacías: `""`
- Fechas nulas: `"null"` (string)
- Fechas imposibles: `"+020010-12-05"` (año 20010)

#### Solución
Transformer `cleanDate()` mejorado:
```javascript
const cleanDate = (value) => {
  if (!value || value === '' || value === 'null') return null;
  try {
    const d = new Date(value);
    // Validate year is reasonable (1900-2100)
    if (isNaN(d.getTime()) || d.getFullYear() < 1900 || d.getFullYear() > 2100) {
      return null;
    }
    return d.toISOString();
  } catch {
    return null;
  }
};
```

### 4. JSONB Corruptos

#### Problema
Algunos campos JSONB tienen valores inválidos (strings que no son JSON válidos).

#### Solución
```javascript
// Validate if already JSON string
if (typeof record[field] === 'string') {
  try {
    JSON.parse(record[field]);
  } catch {
    // Invalid JSON string, wrap in array
    record[field] = '[]';
  }
}
```

---

## Arquitectura del Exporter (Patrón Probado)

### Estructura de Clases

Todos los exporters siguen el mismo patrón:

```javascript
class CollectionExporter {
  constructor() {
    this.collectionName = 'COLLECTION_NAME';
    this.wixEndpoint = `${config.wix.baseUrl}${config.wixEndpoints.COLLECTION}`;
    this.pgTable = config.pgTables.COLLECTION;
    this.batchSize = config.batching.COLLECTION;
    this.rateLimit = config.rateLimit.COLLECTION;
    this.jsonbFields = config.jsonbFields.COLLECTION;
  }

  async fetchFromWix(skip, limit) { /* Pagination */ }
  transformRecord(wixRecord) { /* Data transformation */ }
  buildUpsertQuery(record) { /* Dynamic SQL */ }
  async upsertRecord(pool, record) { /* Insert/Update */ }
  async export(pool, options) { /* Main orchestration */ }
}
```

### Características Clave

1. **Paginación Automática**
   - Batches configurables (50-200 registros)
   - Skip/limit para continuar si falla

2. **UPSERT Idempotente**
   ```sql
   INSERT INTO table (cols) VALUES (vals)
   ON CONFLICT (_id) DO UPDATE SET ...
   ```

3. **Rate Limiting**
   - Pausa configurable entre batches (1000-2000ms)
   - Evita sobrecargar Wix API

4. **Logging Detallado**
   - Progress bars cada 10 registros
   - Errores individuales con contexto
   - Resumen final con métricas

5. **Dry Run Mode**
   ```bash
   node migration/exporters/04-people.js --dry-run
   ```

6. **Max Records Limit**
   ```bash
   node migration/exporters/04-people.js --max=100
   ```

---

## Lecciones Aprendidas

### ✅ Lo Que Funcionó Bien

1. **Testing Incremental**
   - Empezar con colección pequeña (NIVELES - 48 registros)
   - Descubrir problemas de schema early
   - Probar con límites (10, 100, 500) antes de full migration

2. **Transformer Defensivo**
   - Validar tipos antes de insertar
   - Convertir NULL/empty strings a NULL PostgreSQL
   - Validar fechas con rangos razonables
   - Validar JSON antes de stringify

3. **Approach Iterativo**
   - Agregar campos faltantes uno por uno
   - Relajar constraints según necesidad
   - No intentar predecir todo el schema desde el inicio

4. **Template-Based Code Generation**
   - Crear 12 exporters en ~45 minutos
   - Reducir errores humanos
   - Fácil de mantener y actualizar

### ⚠️ Áreas de Mejora

1. **Schema Discovery Automation**
   - TODO: Script para extraer schema completo desde Wix
   - Evitar descubrir campos faltantes durante migración

2. **Data Quality Issues**
   - Wix tiene ~5-10% de registros incompletos/corruptos
   - Considerar limpieza de datos pre-migración

3. **Batch Size Optimization**
   - 100 registros/batch parece óptimo
   - Balance entre memoria y # de round-trips

---

## Próximos Pasos Inmediatos

### 1. Completar Migración PEOPLE
- ✅ En progreso (~8,476 registros)
- ETA: ~15 minutos
- Validar: `SELECT COUNT(*) FROM "PEOPLE";`

### 2. Migrar ACADEMICA (4,851 registros)
```bash
node migration/orchestrator.js --only=ACADEMICA
```
**Dependencia**: Requiere PEOPLE completo (FK: numeroId)

### 3. Migrar CALENDARIO (16,699 registros)
```bash
node migration/orchestrator.js --only=CALENDARIO
```
**Note**: Endpoint Wix es `exportarCALENDARIO` (no CLASSES)

### 4. Migrar ACADEMICA_BOOKINGS (87,821 registros - MAYOR!)
```bash
node migration/orchestrator.js --only=ACADEMICA_BOOKINGS
```
**Dependencia**: Requiere CALENDARIO y PEOPLE (FKs)
**ETA**: ~2-3 horas (mayor colección)

### 5. Migrar Restantes
- FINANCIEROS
- NIVELES_MATERIAL
- CLUBS
- COMMENTS
- STEP_OVERRIDES

---

## Configuración Actual

### Database
```env
POSTGRES_HOST=lgs-db-do-user-19197755-0.e.db.ondigitalocean.com
POSTGRES_PORT=25060
POSTGRES_DB=defaultdb
POSTGRES_USER=doadmin
POSTGRES_SSL=true
```

### Wix API
```env
WIX_API_BASE_URL=https://www.lgsplataforma.com/_functions
```

### Batch Sizes
```javascript
batching: {
  NIVELES: 50,
  ROL_PERMISOS: 50,
  USUARIOS_ROLES: 50,
  PEOPLE: 100,
  ACADEMICA: 100,
  CALENDARIO: 100,
  ACADEMICA_BOOKINGS: 200,
  // ...
}
```

### Rate Limiting
```javascript
rateLimit: {
  NIVELES: 1000,
  PEOPLE: 2000,
  ACADEMICA_BOOKINGS: 2000,
  // ...
}
```

---

## Métricas Actuales

### Rendimiento
- **Tasa promedio**: 7-10 registros/segundo
- **Éxito rate**: ~95% (5% registros corruptos/incompletos)
- **Downtime Wix**: 0 (API estable)

### Tiempo Estimado Total
```
COMPLETADO:
  NIVELES:           5s
  ROL_PERMISOS:      5s
  USUARIOS_ROLES:    8s
  Subtotal:          18s (~0.3 min)

EN PROGRESO:
  PEOPLE:            ~15 min (8,476 registros)

PENDIENTE:
  ACADEMICA:         ~10 min (4,851 registros)
  CALENDARIO:        ~30 min (16,699 registros)
  ACADEMICA_BOOKINGS: ~3 horas (87,821 registros)
  Otros:             ~15 min (~3,500 registros)

TOTAL ESTIMADO: ~4 horas
```

---

## Comandos Útiles

### Check Migration Progress
```bash
# Ver output en tiempo real
tail -f /private/tmp/claude/-Users-danieltalero-LGS2026/tasks/TASK_ID.output

# Conteo en PostgreSQL
psql "$CONN_STRING" -c "SELECT COUNT(*) FROM \"PEOPLE\";"

# Ver últimos registros insertados
psql "$CONN_STRING" -c "SELECT \"_id\", \"numeroId\", \"primerNombre\", \"_createdDate\" FROM \"PEOPLE\" ORDER BY \"_createdDate\" DESC LIMIT 5;"
```

### Retry Failed Migration
```bash
# Continuar desde donde quedó (gracias a UPSERT)
node migration/exporters/04-people.js
```

### Run Full Orchestrator
```bash
# Todas las colecciones en orden de dependencias
node migration/orchestrator.js

# Con dry-run
node migration/orchestrator.js --dry-run

# Solo una colección
node migration/orchestrator.js --only=PEOPLE

# Saltar una colección
node migration/orchestrator.js --skip=PEOPLE
```

---

## Referencias

- **Plan Original**: [/Users/danieltalero/.claude/plans/twinkling-inventing-honey.md](file:///Users/danieltalero/.claude/plans/twinkling-inventing-honey.md)
- **Primer Test Exitoso**: [PRIMER_TEST_EXITOSO.md](PRIMER_TEST_EXITOSO.md)
- **Exporters Creados**: [EXPORTERS_CREADOS.md](EXPORTERS_CREADOS.md)
- **Schema SQL**: [migration/schema.sql](migration/schema.sql)
- **Orchestrator**: [migration/orchestrator.js](migration/orchestrator.js)

---

**Última Actualización**: 2026-01-19 15:30 (durante migración PEOPLE)
