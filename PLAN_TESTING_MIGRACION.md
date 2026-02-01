# 🧪 PLAN DE TESTING - MIGRACIÓN WIX → POSTGRESQL

**Fecha**: 21 de enero de 2026
**Objetivo**: Verificar que todos los endpoints PostgreSQL funcionan correctamente

---

## 📋 Checklist de Testing

### 1. Eventos y Calendario ⏰

#### 1.1 Crear Evento
- [ ] **Endpoint**: `POST /api/postgres/events`
- [ ] Crear evento tipo SESSION
- [ ] Crear evento tipo CLUB
- [ ] Crear evento tipo WELCOME
- [ ] Verificar campos requeridos (dia, tituloONivel, advisor, limiteUsuarios)
- [ ] Verificar campos opcionales (nombreEvento, observaciones, linkZoom)

**Datos de prueba**:
```json
{
  "dia": "2026-02-01T10:00:00Z",
  "evento": "SESSION",
  "tituloONivel": "BN1",
  "advisor": "<advisor_id>",
  "limiteUsuarios": 10,
  "nombreEvento": "Sesión de prueba migración",
  "observaciones": "Testing PostgreSQL",
  "linkZoom": "https://zoom.us/j/123456789"
}
```

#### 1.2 Listar Eventos
- [ ] **Endpoint**: `GET /api/postgres/events/filtered`
- [ ] Filtrar por fecha (desde/hasta)
- [ ] Filtrar por advisor
- [ ] Filtrar por nivel
- [ ] Verificar paginación (skip/limit)
- [ ] Incluir conteo de inscritos (includeBookings=true)

#### 1.3 Ver Detalle de Evento
- [ ] **Endpoint**: `GET /api/postgres/events/{id}`
- [ ] Verificar todos los campos del evento
- [ ] Verificar población de advisor (nombre completo)
- [ ] Verificar conteo de inscritos/asistieron

#### 1.4 Actualizar Evento
- [ ] **Endpoint**: `PUT /api/postgres/events/{id}`
- [ ] Cambiar fecha
- [ ] Cambiar advisor
- [ ] Cambiar límite de usuarios
- [ ] Actualizar observaciones
- [ ] Actualizar link Zoom

#### 1.5 Eliminar Evento
- [ ] **Endpoint**: `DELETE /api/postgres/events/{id}`
- [ ] Eliminar evento sin inscripciones
- [ ] Verificar error al eliminar evento con inscripciones (si aplica)
- [ ] Verificar eliminación en cascada de bookings (si configurado)

---

### 2. Inscripciones a Eventos 👥

#### 2.1 Inscribir Estudiante
- [ ] **Endpoint**: `POST /api/postgres/events/{id}/enroll`
- [ ] Inscribir estudiante a sesión
- [ ] Verificar que no se puede inscribir dos veces
- [ ] Verificar límite de usuarios (no exceder)
- [ ] Verificar campos: idEstudiante, nivel, step

**Datos de prueba**:
```json
{
  "idEstudiante": "<student_id>",
  "nivel": "BN1",
  "step": "Step 1"
}
```

#### 2.2 Listar Inscritos en Evento
- [ ] **Endpoint**: `GET /api/postgres/events/{id}/bookings`
- [ ] Sin includeStudent=true (solo bookings)
- [ ] Con includeStudent=true (datos completos)
- [ ] Verificar campos de asistencia
- [ ] Verificar campos de evaluación

#### 2.3 Marcar Asistencia
- [ ] **Endpoint**: `PUT /api/postgres/events/{eventId}/bookings/{bookingId}`
- [ ] Marcar asistencia = true
- [ ] Marcar asistencia = false
- [ ] Agregar evaluación (1-5 estrellas)
- [ ] Agregar anotación advisor
- [ ] Agregar comentarios estudiante

**Datos de prueba**:
```json
{
  "asistio": true,
  "evaluacion": 5,
  "anotacionAdvisor": "Excelente participación",
  "comentariosEstudiante": "Tema muy interesante"
}
```

#### 2.4 Batch Counts (Performance)
- [ ] **Endpoint**: `POST /api/postgres/events/batch-counts`
- [ ] Probar con 10 eventIds
- [ ] Probar con 50 eventIds
- [ ] Probar con 100 eventIds
- [ ] Verificar tiempo de respuesta < 500ms

---

### 3. Estudiantes y Académico 📚

#### 3.1 Buscar Estudiante
- [ ] **Endpoint**: `GET /api/postgres/students/search`
- [ ] Buscar por nombre parcial
- [ ] Buscar por documento completo
- [ ] Buscar por contrato
- [ ] Verificar paginación

#### 3.2 Ver Detalle de Estudiante
- [ ] **Endpoint**: `GET /api/postgres/students/{id}`
- [ ] Verificar datos personales (PEOPLE)
- [ ] Verificar registros académicos (ACADEMICA)
- [ ] Verificar nivel actual y step
- [ ] Verificar nivel paralelo (si tiene ESS)

#### 3.3 Progreso Académico "¿Cómo voy?"
- [ ] **Endpoint**: `GET /api/postgres/students/{id}/progress`
- [ ] Verificar progreso por steps
- [ ] Verificar conteo de asistencias por step
- [ ] Verificar steps completados (5 asistencias o override)
- [ ] Verificar porcentaje de progreso
- [ ] Verificar tabla "Todas las clases"
- [ ] Verificar que excluya ESS del diagnóstico

#### 3.4 Actualizar Step del Estudiante
- [ ] **Endpoint**: `PUT /api/postgres/students/{id}/step`
- [ ] Cambiar a step siguiente en nivel principal
- [ ] Cambiar a nivel paralelo (ESS)
- [ ] Verificar actualización en PEOPLE y ACADEMICA
- [ ] Verificar campo `nivelParalelo` y `stepParalelo`

**Datos de prueba**:
```json
{
  "newStep": "Step 2",
  "nivel": "BN1"
}
```

#### 3.5 Step Overrides
- [ ] **Endpoint**: `POST /api/postgres/students/{id}/step-override`
- [ ] Marcar step como completado manualmente
- [ ] Desmarcar override
- [ ] Verificar que override anule regla de 5 asistencias

---

### 4. Aprobaciones 📋

#### 4.1 Listar Aprobaciones Pendientes
- [ ] **Endpoint**: `GET /api/postgres/approvals/pending`
- [ ] Estado = PENDIENTE (default)
- [ ] Estado = APROBADO
- [ ] Estado = RECHAZADO
- [ ] Verificar JOIN con PEOPLE (nombre estudiante)

#### 4.2 Aprobar Contrato
- [ ] **Endpoint**: `PUT /api/postgres/approvals/{id}`
- [ ] Estado = APROBADO
- [ ] Verificar campos de auditoría (aprobadoPor, fechaAprobacion)
- [ ] Agregar comentarios

**Datos de prueba**:
```json
{
  "estado": "APROBADO",
  "comentarios": "Contrato aprobado - todo en orden"
}
```

#### 4.3 Rechazar Contrato
- [ ] **Endpoint**: `PUT /api/postgres/approvals/{id}`
- [ ] Estado = RECHAZADO
- [ ] Verificar campos de auditoría
- [ ] Agregar comentarios obligatorios

---

### 5. Contratos y Financiero 💰

#### 5.1 Crear Contrato Completo
- [ ] **Endpoint**: `POST /api/postgres/contracts`
- [ ] Crear TITULAR
- [ ] Crear BENEFICIARIO(S) (1-3 beneficiarios)
- [ ] Crear registros ACADEMICA para cada beneficiario
- [ ] Crear registro FINANCIERO
- [ ] Verificar campos: contrato, vigencia, finalContrato

**Datos de prueba**:
```json
{
  "contrato": "TEST-2026-001",
  "titular": {
    "numeroId": "1234567890",
    "primerNombre": "Juan",
    "primerApellido": "Pérez",
    "email": "juan.perez@test.com",
    "telefono": "+57 300 1234567"
  },
  "beneficiarios": [{
    "numeroId": "0987654321",
    "primerNombre": "María",
    "primerApellido": "Pérez",
    "nivel": "BN1"
  }],
  "financiero": {
    "valorTotal": 1000000,
    "valorCuota": 100000,
    "numeroCuotas": 10
  }
}
```

#### 5.2 Buscar Contratos
- [ ] **Endpoint**: `GET /api/postgres/contracts/search`
- [ ] Buscar por patrón de contrato
- [ ] Buscar por estado (activo/inactivo)
- [ ] Verificar JOIN con PEOPLE

#### 5.3 Extender Vigencia
- [ ] **Endpoint**: `PUT /api/postgres/students/{id}/extend-vigencia`
- [ ] Extender 30 días
- [ ] Extender 60 días
- [ ] Extender 90 días
- [ ] Verificar actualización de `finalContrato`
- [ ] Verificar entrada en `extensionHistory`

---

### 6. OnHold y Estados 🔒

#### 6.1 Activar OnHold
- [ ] **Endpoint**: `POST /api/postgres/students/{id}/onhold`
- [ ] Marcar estadoInactivo = true
- [ ] Establecer fechaOnHold y fechaFinOnHold
- [ ] Agregar motivo
- [ ] Verificar entrada en `onHoldHistory`

**Datos de prueba**:
```json
{
  "setOnHold": true,
  "fechaOnHold": "2026-03-01",
  "fechaFinOnHold": "2026-03-31",
  "motivo": "Vacaciones"
}
```

#### 6.2 Desactivar OnHold (Auto-extensión)
- [ ] **Endpoint**: `POST /api/postgres/students/{id}/onhold`
- [ ] Marcar estadoInactivo = false
- [ ] Verificar cálculo de días pausados (30 días)
- [ ] Verificar extensión automática de `finalContrato` (+30 días)
- [ ] Verificar entrada en `extensionHistory` con motivo automático
- [ ] Verificar incremento de `extensionCount`

---

### 7. Roles y Permisos 🔐

#### 7.1 Listar Roles
- [ ] **Endpoint**: `GET /api/postgres/roles`
- [ ] Verificar 9 roles existentes
- [ ] Filtrar por activo=true
- [ ] Verificar campo `permisos` (JSONB array)

#### 7.2 Ver Permisos de Rol
- [ ] **Endpoint**: `GET /api/postgres/roles/{rol}/permissions`
- [ ] SUPER_ADMIN (41 permisos)
- [ ] ADMIN (40 permisos)
- [ ] ADVISOR (16 permisos)
- [ ] TALERO (1 permiso)
- [ ] READONLY (2 permisos)

#### 7.3 Actualizar Permisos de Rol
- [ ] **Endpoint**: `PUT /api/postgres/roles/{rol}/permissions`
- [ ] Agregar nuevo permiso
- [ ] Remover permiso existente
- [ ] Verificar actualización en `ROL_PERMISOS`

#### 7.4 Crear Nuevo Rol
- [ ] **Endpoint**: `POST /api/postgres/roles`
- [ ] Crear rol TEST_ROLE
- [ ] Asignar 5 permisos
- [ ] Verificar activo=true por default

---

### 8. Materiales y Niveles 📖

#### 8.1 Listar Niveles
- [ ] **Endpoint**: `GET /api/postgres/niveles`
- [ ] Verificar todos los niveles (WELCOME, BN1-BN4, IN1-IN4, etc.)
- [ ] Verificar campo `esParalelo` (ESS = true)
- [ ] Verificar campo `steps` (array)

#### 8.2 Ver Steps de Nivel
- [ ] **Endpoint**: `GET /api/postgres/niveles/{codigo}/steps`
- [ ] Nivel regular (BN1) - multiple steps
- [ ] Nivel paralelo (ESS) - step único
- [ ] Con studentId - incluir progreso

#### 8.3 Material de Usuario
- [ ] **Endpoint**: `GET /api/postgres/materials/usuario`
- [ ] Por step específico
- [ ] Verificar campo `materialUsuario`
- [ ] Verificar orden correcto

#### 8.4 Material de Nivel
- [ ] **Endpoint**: `GET /api/postgres/materials/nivel`
- [ ] Por nivel y step
- [ ] Verificar campo `material` (desde NIVELES)
- [ ] Verificar clubs asociados

---

### 9. Exportación y Reportes 📊

#### 9.1 Exportar Calendario CSV
- [ ] **Endpoint**: `GET /api/postgres/calendar/export-csv`
- [ ] Verificar formato CSV correcto
- [ ] Verificar headers (fecha, evento, nivel, advisor, etc.)
- [ ] Verificar encoding UTF-8
- [ ] Descargar archivo y abrir en Excel

#### 9.2 Batch Operations
- [ ] **Endpoint**: `POST /api/postgres/events/batch-counts`
- [ ] 100 eventos simultáneos
- [ ] Verificar tiempo < 1 segundo
- [ ] Verificar conteos correctos

---

### 10. Autenticación y Middleware 🔑

#### 10.1 Login
- [ ] Login con SUPER_ADMIN
- [ ] Login con ADVISOR
- [ ] Login con READONLY
- [ ] Verificar JWT token generado
- [ ] Verificar sesión en NextAuth

#### 10.2 Middleware de Permisos
- [ ] Acceder a ruta protegida con permisos correctos
- [ ] Intentar acceder sin permisos (expect 403)
- [ ] Verificar caché de permisos (5 minutos)
- [ ] Verificar logs de middleware

---

## 🎯 Criterios de Aceptación

### Performance
- [ ] Queries simples (GET by ID): < 100ms
- [ ] Queries complejos (JOIN multiple): < 300ms
- [ ] Batch operations (100 items): < 1s
- [ ] Creación de registros: < 200ms

### Integridad de Datos
- [ ] Foreign keys respetados (no huérfanos)
- [ ] JSONB fields válidos
- [ ] Fechas en formato ISO 8601
- [ ] Arrays poblados correctamente

### Seguridad
- [ ] Todas las rutas requieren autenticación
- [ ] Permisos verificados en middleware
- [ ] SQL injection prevenido (parameterized queries)
- [ ] Datos sensibles no expuestos en logs

### UI/UX
- [ ] Mensajes de error claros
- [ ] Loading states funcionan
- [ ] Caché invalidado correctamente
- [ ] Redirects funcionan

---

## 🛠️ Herramientas de Testing

### Testing Manual
- **Browser**: Chrome DevTools Network tab
- **REST Client**: Thunder Client / Insomnia
- **Database**: TablePlus / pgAdmin

### Testing Automatizado (Opcional)
```bash
# Instalar dependencias de testing
npm install --save-dev @playwright/test

# Crear tests E2E
# tests/e2e/eventos.spec.ts
# tests/e2e/estudiantes.spec.ts
# tests/e2e/aprobaciones.spec.ts
```

### Scripts de Testing
```bash
# Test de conexión PostgreSQL
npm run test:db

# Test de todos los endpoints
npm run test:api

# Test de UI completo
npm run test:e2e
```

---

## 📝 Registro de Resultados

### Template de Resultado
```
✅ PASÓ | ❌ FALLÓ | ⚠️ PARCIAL

Endpoint: [METHOD] /api/postgres/...
Resultado: [✅/❌/⚠️]
Tiempo: [XXms]
Notas: [Observaciones]
```

### Ejemplo
```
✅ PASÓ
Endpoint: POST /api/postgres/events
Resultado: ✅
Tiempo: 145ms
Notas: Evento creado correctamente con todos los campos
```

---

## 🚨 Issues Encontrados

### Template de Issue
```markdown
## [PRIORIDAD] Título del Issue

**Endpoint**: [METHOD] /api/postgres/...
**Descripción**: [Qué falló]
**Reproducción**: [Pasos para reproducir]
**Esperado**: [Comportamiento esperado]
**Actual**: [Comportamiento actual]
**Fix sugerido**: [Cómo arreglarlo]
```

---

## 📊 Dashboard de Progreso

| Categoría | Total Tests | Pasados | Fallados | Progreso |
|-----------|-------------|---------|----------|----------|
| Eventos | 15 | 0 | 0 | 0% |
| Inscripciones | 8 | 0 | 0 | 0% |
| Estudiantes | 12 | 0 | 0 | 0% |
| Aprobaciones | 6 | 0 | 0 | 0% |
| Contratos | 8 | 0 | 0 | 0% |
| OnHold | 4 | 0 | 0 | 0% |
| Roles | 8 | 0 | 0 | 0% |
| Materiales | 8 | 0 | 0 | 0% |
| Exportación | 4 | 0 | 0 | 0% |
| Auth | 6 | 0 | 0 | 0% |
| **TOTAL** | **79** | **0** | **0** | **0%** |

---

## ✅ Checklist Final Pre-Deployment

- [ ] Todos los tests críticos pasando (80%+)
- [ ] Performance dentro de rangos aceptables
- [ ] No issues bloqueantes encontrados
- [ ] Documentación de cambios actualizada
- [ ] Rollback plan documentado
- [ ] Monitoreo configurado (logs, alertas)
- [ ] Backup de base de datos creado
- [ ] Equipo notificado del deployment

---

**Inicio de Testing**: [FECHA]
**Fin de Testing**: [FECHA]
**Ejecutado por**: [NOMBRE]
**Aprobado por**: [NOMBRE]
