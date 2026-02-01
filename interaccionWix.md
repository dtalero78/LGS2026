# Listado de Interacciones con Wix

Este documento detalla todos los puntos de interacción entre el Admin Panel de LGS y las bases de datos de Wix, clasificados por colección y tipo de operación.

---

## Resumen Estadístico

- **Total de endpoints**: 58
- **Operaciones READ**: 32 (55%)
- **Operaciones WRITE**: 26 (45%)

---

## PEOPLE Collection (Perfiles de Usuarios)

### READ Operations (7)
1. `student-by-id` - Obtener datos completos de estudiante por ID
2. `person-by-id` - Obtener datos de persona por ID
3. `search` - Buscar personas por nombre/documento/contrato
4. `advisors` - Listar asesores activos
5. `related-persons` - Obtener personas relacionadas (titular/beneficiarios)
6. `beneficiarios-sin-registro` - Listar beneficiarios sin registro académico
7. `person-comments` - Obtener comentarios de una persona

### WRITE Operations (8)
8. `create-person` - Crear nuevo titular o beneficiario
9. `toggle-user-status` - Activar/desactivar usuario
10. `toggle-student-onhold` - Activar/desactivar OnHold con auto-extensión
11. `toggle-onhold-status` - Cambiar estado de OnHold
12. `extend-vigencia` - Extender fecha de fin de contrato
13. `update-aprobacion` - Actualizar estado de aprobación
14. `add-comment` - Agregar comentario a persona
15. `inactivate-user` - Inactivar usuario permanentemente

---

## ACADEMICA Collection (Registros Académicos)

### READ Operations (4)
16. `academica-user` - Obtener registro académico de usuario
17. `event-bookings` - Obtener inscripciones a eventos
18. `evento-inscritos` - Obtener estudiantes inscritos en evento
19. `student-progress` - Obtener diagnóstico "¿Cómo voy?" del estudiante

### WRITE Operations (8)
20. `update-student-step` - Actualizar nivel/step del estudiante (soporta niveles paralelos)
21. `step-override` (POST) - Crear override de step
22. `step-override` (DELETE) - Eliminar override de step
23. `update-class-record` - Actualizar registro de clase (asistencia, evaluación, comentarios)
24. `create-class-event` - Crear evento de clase con inscripciones
25. `update-class` - Actualizar datos de clase existente
26. `delete-class` - Eliminar clase y sus inscripciones
27. `generate-student-activity` - Generar actividades para estudiante
28. `generate-session-activities` - Generar actividades para sesión completa

---

## CALENDARIO Collection (Eventos y Sesiones)

### READ Operations (10)
29. `calendario-eventos` - Obtener eventos del calendario (legacy)
30. `calendario-events` - Obtener eventos filtrados por rango de fechas
31. `calendar-event` - Obtener evento específico por ID
32. `event-bookings` - Obtener inscripciones de evento
33. `evento-inscritos` - Obtener lista de inscritos en evento
34. `eventos-inscritos-batch` - Obtener inscripciones en lote (múltiples eventos)
35. `all-sessions` - Obtener todas las sesiones
36. `calendar-events-by-advisor` - Obtener eventos por advisor
37. `welcome-events` - Obtener eventos de tipo Welcome
38. `export-calendar-csv` - Exportar calendario a CSV

### WRITE Operations (3)
39. `create-calendario-event` - Crear nuevo evento en calendario
40. `update-calendario-event` - Actualizar evento existente
41. `delete-calendario-event` - Eliminar evento del calendario

---

## NIVELES Collection (Definición de Niveles)

### READ Operations (4)
42. `niveles` - Obtener todos los niveles disponibles
43. `level-steps` - Obtener steps de un nivel específico
44. `debug-niveles` - Información de debug de niveles
45. `nivel-material` - Obtener material de un nivel

**Nota**: Esta colección es READ-ONLY, no hay operaciones de escritura.

---

## ROL_PERMISOS Collection (Control de Acceso)

### READ Operations (2)
46. `role-permissions` (GET) - Obtener permisos de un rol
47. `all-roles` - Obtener todos los roles y sus permisos

### WRITE Operations (2)
48. `role-permissions` (POST) - Actualizar permisos de un rol
49. `create-role` - Crear nuevo rol con permisos

---

## USUARIOS_ROLES Collection (Autenticación)

### READ Operations (1)
50. `user-role` - Obtener rol de un usuario

**Nota**: Esta colección es READ-ONLY desde el panel, la escritura se hace desde Wix directamente.

---

## FINANCIEROS Collection (Registros Financieros)

### WRITE Operations (1)
51. `create-financial` - Crear registro financiero asociado a contrato

---

## Contratos y Datos de Soporte

### READ Operations (5)
52. `contracts-by-pattern` - Buscar contratos por patrón
53. `contratos-by-tipo` - Obtener contratos por tipo (TITULAR/BENEFICIARIO)
54. `pending-approvals` - Obtener aprobaciones pendientes
55. `advisor-stats` - Obtener estadísticas de advisor
56. `material-usuario` - Obtener material asignado a usuario

### WRITE Operations (2)
57. `create-contract` - Crear nuevo contrato (auto-numeración CC-NNNNN-YY)
58. `toggle-contract-status` - Activar/desactivar contrato

---

## Arquitectura de Proxy

Todas las operaciones con Wix pasan por endpoints proxy ubicados en:
```
/api/wix-proxy/*
```

### Ventajas del Proxy
- **Seguridad**: No expone credenciales de Wix al frontend
- **Caché**: Implementa caché en middleware y localStorage
- **Validación**: Valida permisos antes de ejecutar operaciones
- **Logging**: Centraliza logs de operaciones con Wix
- **URL Resolution**: Maneja correctamente URLs en server-side (usa `NEXTAUTH_URL`)

---

## Características Especiales

### 1. OnHold con Auto-Extensión
- **Endpoint**: `toggle-student-onhold`
- **Comportamiento**: Al desactivar OnHold, automáticamente extiende `finalContrato` por los días pausados
- **Colecciones afectadas**: PEOPLE, ACADEMICA
- **Historial**: Registra tanto en `onHoldHistory` como en `extensionHistory`

### 2. Niveles Paralelos (ESS)
- **Endpoint**: `update-student-step`
- **Comportamiento**: Detecta si el step pertenece a un nivel paralelo (`esParalelo: true` en NIVELES)
- **Colecciones afectadas**: ACADEMICA, PEOPLE
- **Campos**: Actualiza `nivelParalelo`/`stepParalelo` o `nivel`/`step` según corresponda

### 3. Sistema de Permisos (RBAC)
- **Caché**: 5 minutos en memoria (middleware)
- **Roles disponibles**: 9 roles (SUPER_ADMIN, ADMIN, ADVISOR, COMERCIAL, etc.)
- **Verificación**: Middleware, Frontend (PermissionGuard), API routes
- **Source of Truth**: Tabla `ROL_PERMISOS` en Wix

### 4. Caché de Calendario
- **Estrategia**: localStorage con TTL de 5 minutos
- **Invalidación**: Automática en operaciones CRUD de eventos
- **Granularidad**: Por mes/fecha para invalidación selectiva

### 5. Auto-Numeración de Contratos
- **Formato**: `CC-NNNNN-YY` (ej: CC-00001-26)
- **Lógica**: Consulta último contrato y genera siguiente número
- **Endpoint**: `create-contract`

---

## Notas de Implementación

### Server-Side vs Client-Side
- **Server-side**: Usar `process.env.NEXTAUTH_URL` como baseUrl
- **Client-side**: Usar `''` (string vacío) como baseUrl para URLs relativas

### TypeScript Types
Todas las interfaces están definidas en:
```
src/types/index.ts
```

### Manejo de Errores
Todos los endpoints retornan:
```typescript
{
  success: boolean
  data?: any
  error?: string
  message?: string
}
```

### Logging
Los endpoints incluyen logging detallado:
- `🔄` Request recibido
- `✅` Operación exitosa
- `❌` Error en operación
- `📋` Datos procesados

---

## Mantenimiento

### Agregar Nueva Operación
1. Crear endpoint en `/api/wix-proxy/[nombre]/route.ts`
2. Implementar función correspondiente en Wix backend (`search.jsw`)
3. Actualizar tipos en `src/types/index.ts`
4. Agregar verificación de permisos si es necesario
5. Actualizar este documento

### Modificar Operación Existente
1. Actualizar función en Wix backend
2. Si cambian campos: actualizar tipos TypeScript
3. Limpiar caché si es necesario (permisos o calendario)
4. Probar en dev antes de deploy a producción

---

**Última actualización**: Enero 2026
**Versión**: 1.0.0
