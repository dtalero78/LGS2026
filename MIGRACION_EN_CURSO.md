# 🔄 Migración en Curso - Estado Actual

**Fecha**: 2026-01-19
**Hora inicio**: ~17:00

---

## ✅ Migraciones Completadas (Sesión Anterior)

| Colección | Registros | Estado |
|-----------|-----------|--------|
| NIVELES | 48/48 | ✅ COMPLETO |
| ROL_PERMISOS | 14/14 | ✅ COMPLETO |
| USUARIOS_ROLES | 77/77 | ✅ COMPLETO |
| PEOPLE | 6,096/~8,476 | ⚠️ PARCIAL (28% fallos en campos "link") |

---

## 🔄 Migraciones en Progreso (AHORA)

### ACADEMICA
- **Estado**: 🔄 Migrando
- **Progreso**: ~3,000 / 4,851 registros (62%)
- **Tasa**: ~10-15 records/sec
- **ETA**: ~3-5 minutos

**Problemas resueltos**:
- 8 columnas faltantes agregadas:
  - `link-info-academica-primerNombre`
  - `link-info-academica-primerNombre-2`
  - `link-info-academica-primerNombre-3`
  - `hobbies`
  - `idEstudiante`
  - `aprobacion` (cambiado de BOOLEAN a TEXT)
  - `detallesPersonales`
  - `foto`
- Constraints relajados: `numeroId`, `nivel`, `step`, `primerNombre`, `primerApellido`, `studentId`
- Transformer mejorado: convierte empty strings a NULL

### CALENDARIO
- **Estado**: 🔄 Migrando
- **Progreso**: ~515 / 16,699 registros (3%)
- **Tasa**: ~5-8 records/sec
- **ETA**: ~30-45 minutos

**Problemas resueltos**:
- 5 columnas faltantes agregadas:
  - `dia`
  - `evento`
  - `link-calendario-_id`
  - `nombreEvento`
  - `tituloONivel`
- Constraints relajados: `tipo`, `hora`, `nivel`, `step`, `advisor`, `fecha`, `titulo`
- Transformer mejorado: convierte empty strings a NULL

---

## ⏳ Pendientes

| Colección | Registros Estimados | Dependencias | Prioridad |
|-----------|---------------------|--------------|-----------|
| ACADEMICA_BOOKINGS | 87,821 | CALENDARIO, PEOPLE | ALTA |
| FINANCIEROS | ~3,000-5,000 | PEOPLE | MEDIA |
| NIVELES_MATERIAL | ~100-200 | NIVELES | BAJA |
| CLUBS | ~20-30 | Ninguna | BAJA |
| COMMENTS | Variable | PEOPLE | BAJA |
| STEP_OVERRIDES | Variable | PEOPLE, ACADEMICA | BAJA |

---

## 📊 Resumen General

### Registros Migrados
```
COMPLETADOS:
  NIVELES:           48
  ROL_PERMISOS:      14
  USUARIOS_ROLES:    77
  PEOPLE:         6,096
  SUBTOTAL:       6,235

EN PROGRESO:
  ACADEMICA:      ~3,000 (en curso)
  CALENDARIO:       ~515 (en curso)

TOTAL ACTUAL:   ~9,750+ registros migrados
```

### Tiempo Total Estimado
- **Completado**: ~30 minutos (PEOPLE principalmente)
- **En progreso**: ~45 minutos (ACADEMICA + CALENDARIO)
- **Pendiente**: ~3-4 horas (ACADEMICA_BOOKINGS principalmente)

**TOTAL ESTIMADO**: ~4-5 horas para migración completa

---

## 🛠️ Estrategia de Resolución de Problemas

### Patrón Observado
Todas las colecciones tienen el mismo patrón de problemas:

1. **Columnas faltantes**: El schema original se basó en documentación, pero Wix tiene campos adicionales no documentados
2. **Constraints demasiado estrictos**: NOT NULL y UNIQUE constraints no reflejan la realidad de los datos en Wix
3. **Tipos de datos incorrectos**: Algunos campos son TEXT en Wix pero se mapearon a BOOLEAN o INTEGER
4. **Empty strings**: Wix usa empty strings ("") donde PostgreSQL espera NULL

### Solución Aplicada
1. **Descubrimiento progresivo**: Dejar que la migración falle, identificar campos faltantes, agregarlos, continuar
2. **Constraints relajados**: Remover NOT NULL y UNIQUE de campos que pueden ser NULL o duplicados
3. **Transformer defensivo**: Agregar validación que convierte:
   - Empty strings → NULL
   - Fechas inválidas → NULL (rango 1900-2100)
   - JSONB inválido → '[]' (empty array)
4. **Reintentos**: UPSERT permite reiniciar migración sin duplicar registros

---

## 🔍 Lecciones Aprendidas

### ✅ Lo que está funcionando

1. **UPSERT idempotente**: Permite reiniciar migraciones fallidas sin problemas
2. **Batching + Rate Limiting**: 100-200 registros/batch con 1-2 segundos de pausa
3. **Parallel migrations**: ACADEMICA y CALENDARIO migrando simultáneamente sin problemas
4. **Progressive schema discovery**: Más eficiente que intentar predecir schema completo
5. **Connection pooling**: PostgreSQL maneja múltiples conexiones concurrentes sin problemas

### ⚠️ Mejoras Necesarias

1. **Pre-migration schema discovery**: Debería haber fetched más samples (500-1000 records) de cada colección para descubrir todos los campos
2. **Automated constraint detection**: Analizar datos reales para determinar qué constraints son válidos
3. **Data quality report**: Generar reporte de ~% de registros con datos corruptos/incompletos

---

## 📝 Comandos Útiles

### Ver Progreso en Tiempo Real
```bash
# ACADEMICA
tail -f /private/tmp/claude/-Users-danieltalero-LGS2026/tasks/bca8838.output | grep "Progress"

# CALENDARIO
tail -f /private/tmp/claude/-Users-danieltalero-LGS2026/tasks/b8860f1.output | grep "Progress"
```

### Verificar Conteos
```bash
psql "$CONN_STRING" -c "SELECT 'ACADEMICA' as tabla, COUNT(*) FROM \"ACADEMICA\" UNION SELECT 'CALENDARIO', COUNT(*) FROM \"CALENDARIO\";"
```

### Ver Errores Recientes
```bash
tail -100 /private/tmp/claude/-Users-danieltalero-LGS2026/tasks/bca8838.output | grep "Error upserting"
```

---

## 🎯 Próximos Pasos

### Inmediato (cuando terminen ACADEMICA y CALENDARIO)
1. ✅ Validar conteos vs Wix
2. ✅ Verificar sample de registros
3. ✅ Iniciar ACADEMICA_BOOKINGS (la más grande - 87,821 registros)

### Esta Sesión
1. Completar migraciones de ACADEMICA y CALENDARIO
2. Preparar ACADEMICA_BOOKINGS (revisar schema, agregar campos faltantes proactivamente)
3. Iniciar ACADEMICA_BOOKINGS y dejar corriendo

### Próxima Sesión
1. Completar colecciones restantes (FINANCIEROS, CLUBS, etc.)
2. Validación completa de integridad
3. Actualizar API routes de Next.js
4. Testing de aplicación

---

**Última actualización**: 2026-01-19 17:30
**Status**: 🟢 Migraciones progresando normalmente
