# Migración Wix → PostgreSQL - LGS Admin Panel

## 🚀 Quick Start

### Prerequisitos

1. **PostgreSQL instalado y corriendo**
2. **Node.js 18+**
3. **Dependencias instaladas**:
   ```bash
   npm install pg node-fetch dotenv
   ```

### Paso 1: Configurar variables de entorno

Copia `.env.example.migration` a `.env` y configura tus credenciales:

```bash
cp .env.example.migration .env
nano .env  # Edita con tus credenciales
```

**Variables críticas:**
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=lgs_admin
POSTGRES_USER=tu_usuario
POSTGRES_PASSWORD=tu_password
WIX_API_BASE_URL=https://www.lgsplataforma.com/_functions
```

### Paso 2: Crear el schema en PostgreSQL

```bash
# Conectar a PostgreSQL
psql -U tu_usuario -d postgres

# Crear la base de datos
CREATE DATABASE lgs_admin;

# Salir
\q

# Aplicar el schema
psql -U tu_usuario -d lgs_admin -f migration/schema.sql
```

**Verificar que se crearon las tablas:**
```bash
psql -U tu_usuario -d lgs_admin -c "\dt"
```

Deberías ver 12 tablas:
- NIVELES
- ROL_PERMISOS
- USUARIOS_ROLES
- PEOPLE
- ACADEMICA
- CALENDARIO
- ACADEMICA_BOOKINGS
- FINANCIEROS
- NIVELES_MATERIAL
- CLUBS
- COMMENTS
- STEP_OVERRIDES

### Paso 3: Probar con NIVELES (Tabla pequeña)

```bash
# Test completo (migra todos los registros)
node migration/test-niveles.js

# Dry run (no escribe en DB, solo simula)
node migration/test-niveles.js --dry-run

# Limitar a 5 registros para testing rápido
node migration/test-niveles.js --max=5
```

**Output esperado:**
```
🧪 TESTING NIVELES EXPORT
======================================================================
📋 Step 1: Testing PostgreSQL connection...
✅ PostgreSQL connected
...
✅ TEST COMPLETED SUCCESSFULLY
======================================================================
Summary:
  - Records processed: 20
  - Inserted: 20
  - Updated: 0
  - Failed: 0
  - Duration: 2.35s
  - Rate: 8.51 records/sec
```

### Paso 4: Verificar los datos migrados

```bash
# Contar registros
psql -U tu_usuario -d lgs_admin -c 'SELECT COUNT(*) FROM "NIVELES";'

# Ver sample de datos
psql -U tu_usuario -d lgs_admin -c 'SELECT "code", "step", "esParalelo" FROM "NIVELES" LIMIT 5;'

# Verificar JSONB fields
psql -U tu_usuario -d lgs_admin -c 'SELECT "code", "material", "clubs" FROM "NIVELES" LIMIT 2;'
```

---

## 📁 Estructura de Archivos

```
migration/
├── schema.sql                      # DDL de 12 tablas PostgreSQL
├── config.js                       # Configuración centralizada
├── test-niveles.js                 # Script de prueba para NIVELES
├── exporters/
│   └── 01-niveles.js              # Exporter para NIVELES (ejemplo)
└── README.md                       # Este archivo

src/lib/
└── postgres.ts                     # Cliente PostgreSQL para Next.js
```

---

## 🔧 Troubleshooting

### Error: "relation NIVELES does not exist"

**Causa**: El schema no se aplicó correctamente.

**Solución**:
```bash
psql -U tu_usuario -d lgs_admin -f migration/schema.sql
```

### Error: "password authentication failed"

**Causa**: Credenciales incorrectas en `.env`.

**Solución**:
1. Verifica tu usuario y password de PostgreSQL
2. Actualiza `.env` con las credenciales correctas
3. Reinicia PostgreSQL si cambiaste la configuración

### Error: "Wix API error: 404"

**Causa**: Endpoint de Wix no existe o URL incorrecta.

**Solución**:
1. Verifica que `WIX_API_BASE_URL` en `.env` sea correcto
2. Prueba el endpoint manualmente:
   ```bash
   curl "https://www.lgsplataforma.com/_functions/exportarNiveles?skip=0&limit=5"
   ```

### Error: "ECONNREFUSED" al conectar a PostgreSQL

**Causa**: PostgreSQL no está corriendo.

**Solución**:
```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Verificar status
psql --version
```

### Los campos JSONB se ven raros

**Causa**: PostgreSQL devuelve JSONB como objetos JavaScript automáticamente.

**Esto es correcto**:
```javascript
{
  material: [{ url: "...", title: "..." }],  // ← Objeto JS, no string
  clubs: ["PRONUNCIATION", "GRAMMAR"]
}
```

---

## 📋 Próximos Pasos

Una vez que el test de NIVELES funcione correctamente:

1. ✅ **Crear exporters para las otras 11 colecciones**
   - Copiar `01-niveles.js` y adaptar para cada colección
   - Ajustar `transformRecord()` según campos específicos

2. ✅ **Crear orchestrator.js**
   - Script maestro que ejecuta todos los exporters en orden
   - Manejo de errores y rollback
   - Progress tracking general

3. ✅ **Migración completa en desarrollo**
   - Ejecutar migración de todas las colecciones
   - Validar integridad de datos
   - Medir performance

4. ✅ **Actualizar Next.js para usar PostgreSQL**
   - Cambiar 58 API routes de Wix a PostgreSQL
   - Actualizar `src/lib/auth.ts`
   - Actualizar `src/lib/middleware-permissions.ts`

5. ✅ **Testing exhaustivo**
   - Login con todos los roles
   - CRUD operations
   - Features complejos (OnHold, ESS paralelo)

6. ✅ **Migración a producción**
   - Backup de Wix
   - Downtime coordinado
   - Migración completa
   - Validación post-migración

---

## 🆘 Ayuda Adicional

Si encuentras problemas:

1. **Revisa los logs**: El script imprime información detallada de cada paso
2. **Verifica variables de entorno**: `cat .env | grep POSTGRES`
3. **Prueba conexión manual**:
   ```bash
   psql -U tu_usuario -h localhost -d lgs_admin -c "SELECT NOW();"
   ```
4. **Revisa el plan completo**: Abre el archivo del plan en `~/.claude/plans/`

---

## ✨ Features del Sistema de Migración

- ✅ **UPSERT automático**: ON CONFLICT DO UPDATE (idempotente)
- ✅ **Retry con backoff exponencial**: Reintentos automáticos
- ✅ **Progress tracking**: Logging detallado de progreso
- ✅ **Dry-run mode**: Simula sin escribir en DB
- ✅ **JSONB handling**: Stringify/parse automático
- ✅ **Rate limiting**: Pausas entre batches
- ✅ **camelCase preservado**: Sin conversión de nombres
- ✅ **Validation**: Pre-insert y post-migration checks

---

**Versión**: 1.0.0
**Última actualización**: 2026-01-19
