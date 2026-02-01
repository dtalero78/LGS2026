# Inventario de Endpoints Faltantes - Migración Wix → PostgreSQL

**Fecha**: 2026-01-21
**Estado Actual**: 25/104 endpoints migrados (24%)
**Meta**: 100% migración completa

---

## Resumen Ejecutivo

Análisis completo de `grep` revela **~50 endpoints wix-proxy** aún en uso en el frontend. De estos:
- ✅ **25 ya migrados a PostgreSQL**
- 🔴 **~25 endpoints críticos pendientes**

---

## Categorización por Prioridad

### 🔴 PRIORIDAD CRÍTICA (Bloquean funcionalidad core)

#### 1. Event Management (6 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/calendario-event?id=` | Detalles de un evento | sesion/[id]/page.tsx |
| `GET /api/wix-proxy/event-bookings` | Inscripciones de un evento | sesion/[id]/page.tsx, EventDetailModal.tsx |
| `POST /api/wix-proxy/create-class-event` | Crear evento de clase | StudentAcademic.tsx |
| `PUT /api/wix-proxy/update-class?id=` | Actualizar clase | StudentAcademic.tsx |
| `DELETE /api/wix-proxy/delete-class?id=` | Eliminar clase | StudentAcademic.tsx |
| `GET /api/wix-proxy/calendario-eventos?nivel=&tipoEvento=` | Eventos filtrados por nivel/tipo | StudentAcademic.tsx |

**Nota**: Algunos de estos ya existen parcialmente:
- ✅ `POST /api/postgres/events` ya existe (create-class-event)
- ✅ `PUT /api/postgres/events/[id]` ya existe (update-class)
- ✅ `DELETE /api/postgres/events/[id]` ya existe (delete-class)
- 🔴 Falta: GET single event, GET filtered events, GET event bookings

#### 2. Advisor Operations (4 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/advisor-by-email?email=` | Obtener advisor por email | panel-advisor/page.tsx |
| `GET /api/wix-proxy/calendario-events-by-advisor` | Eventos de un advisor | panel-advisor/page.tsx |
| `GET /api/wix-proxy/advisor-stats` | Estadísticas de advisor | AdvisorsStatistics.tsx |
| `GET /api/wix-proxy/advisor-name?advisorId=` | Nombre de advisor | StudentAcademic.tsx |

**Nota**:
- ✅ `GET /api/postgres/advisors` ya existe (lista general)
- 🔴 Falta: Búsqueda por email, eventos por advisor, stats, nombre

#### 3. Student Academic Operations (8 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/student-by-id?id=` | Detalles completos del estudiante | StudentAcademic.tsx, wix.ts |
| `GET /api/wix-proxy/level-steps?nivel=` | Steps de un nivel | StudentAcademic.tsx |
| `POST /api/wix-proxy/update-student-step` | Cambiar step del estudiante | StudentChangeStep.tsx |
| `POST /api/wix-proxy/step-override` | Marcar/desmarcar step override | StudentAcademic.tsx |
| `DELETE /api/wix-proxy/step-override?studentId=&step=` | Eliminar step override | StudentAcademic.tsx |
| `POST /api/wix-proxy/academica-user` | Crear registro académico | EventDetailModal.tsx |
| `POST /api/wix-proxy/generate-student-activity` | Generar actividad estudiante | SessionStudentsTab.tsx |
| `POST /api/wix-proxy/update-class-record` | Actualizar registro de clase | SessionStudentsTab.tsx |

**Nota**:
- ✅ `GET /api/postgres/students/[id]` ya existe (parcial)
- ✅ `GET /api/postgres/niveles` ya existe
- 🔴 Falta: update-student-step, step-override, academica-user, generate-student-activity, update-class-record

#### 4. Comments System (2 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/person-comments?id=` | Comentarios de una persona | PersonComments.tsx, StudentComments.tsx |
| `POST /api/wix-proxy/add-comment` | Agregar comentario | PersonComments.tsx, StudentComments.tsx |

#### 5. Contract Operations (4 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `POST /api/wix-proxy/create-contract` | Crear contrato completo | crear-contrato/page.tsx |
| `GET /api/wix-proxy/contracts-by-pattern` | Buscar contratos por patrón | create-contract/route.ts |
| `POST /api/wix-proxy/extend-vigencia` | Extender vigencia | StudentContract.tsx |
| `POST /api/wix-proxy/toggle-contract-status` | Activar/desactivar contrato | PersonAdmin.tsx |

#### 6. Person Management (2 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `POST /api/wix-proxy/create-person` | Crear persona (titular/beneficiario) | create-contract/route.ts |
| `POST /api/wix-proxy/create-financial` | Crear registro financiero | create-contract/route.ts |

**Nota**:
- ✅ `GET /api/postgres/students/[id]` ya existe (lectura)
- 🔴 Falta: Crear persona, crear financiero

---

### 🟡 PRIORIDAD ALTA (Funcionalidad importante)

#### 7. Approval Workflow (2 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/pending-approvals` | Aprobaciones pendientes | aprobacion/page.tsx |
| `POST /api/wix-proxy/update-aprobacion` | Actualizar estado de aprobación | aprobacion/page.tsx |

#### 8. Service Management (3 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/welcome-events` | Eventos Welcome | welcome-session/page.tsx |
| `GET /api/wix-proxy/all-sessions` | Todas las sesiones | lista-sesiones/page.tsx |
| `GET /api/wix-proxy/beneficiarios-sin-registro` | Beneficiarios sin registro | sin-registro/page.tsx |

#### 9. Materials (2 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/material-usuario?step=` | Material de usuario por step | panel-advisor/page.tsx |
| `GET /api/wix-proxy/nivel-material?step=` | Material del nivel por step | SessionMaterialTab.tsx |

**Nota**: Estos endpoints YA EXISTEN en wix-proxy pero deben migrarse a postgres:
- ✅ Ya están implementados en `/api/wix-proxy/material-usuario/route.ts`
- ✅ Ya están implementados en `/api/wix-proxy/nivel-material/route.ts`
- 🔴 Falta: Migrar a PostgreSQL (tabla NIVELES_MATERIAL)

#### 10. Export/CSV (1 endpoint)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/export-calendar-csv` | Exportar calendario a CSV | agenda-sesiones/page.tsx |

**Nota**: Ya existe `/api/postgres/export/events` pero frontend sigue llamando a wix-proxy

---

### 🟢 PRIORIDAD MEDIA (Funcionalidad complementaria)

#### 11. Batch Operations (1 endpoint)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/eventos-inscritos-batch` | Conteos de inscripciones múltiples eventos | agenda-sesiones/page.tsx, panel-advisor/page.tsx |

**Nota**: Endpoint muy usado para performance (obtiene counts de múltiples eventos en 1 request)

#### 12. Role/Permission Management (5 endpoints)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/role-permissions?rol=` | Permisos de un rol | config/roles.ts, roles/create/route.ts |
| `POST /api/wix-proxy/role-permissions` | Actualizar permisos | permissions/update/route.ts |
| `POST /api/wix-proxy/create-role` | Crear nuevo rol | roles/create/route.ts |
| `GET /api/wix-proxy/user-role?email=` | Rol de usuario | http-functions.js (backend) |
| `POST /api/wix-proxy/update-user-role` | Actualizar rol de usuario | http-functions.js (backend) |

**Nota**:
- ✅ `GET /api/postgres/permissions` ya existe
- 🔴 Falta: CRUD completo de roles y permisos

#### 13. Student Progress (1 endpoint)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/student-progress?id=` | Diagnóstico "¿Cómo voy?" | StudentProgress.tsx |

**Nota**: Este endpoint ya existe en wix-proxy, pero requiere lógica compleja (debe migrarse)

---

### 🔵 PRIORIDAD BAJA (Debugging/Admin)

#### 14. Debug/Utilities (1 endpoint)
| Endpoint Wix | Uso | Frontend Files |
|--------------|-----|----------------|
| `GET /api/wix-proxy/debug-niveles?nivel=` | Debug de niveles | SessionStudentsTab.tsx |

---

## Resumen por Categoría

| Categoría | Endpoints | Prioridad |
|-----------|-----------|-----------|
| Event Management | 6 | 🔴 CRÍTICA |
| Advisor Operations | 4 | 🔴 CRÍTICA |
| Student Academic | 8 | 🔴 CRÍTICA |
| Comments | 2 | 🔴 CRÍTICA |
| Contract Operations | 4 | 🔴 CRÍTICA |
| Person Management | 2 | 🔴 CRÍTICA |
| **Subtotal Crítico** | **26** | |
| Approval Workflow | 2 | 🟡 ALTA |
| Service Management | 3 | 🟡 ALTA |
| Materials | 2 | 🟡 ALTA |
| Export/CSV | 1 | 🟡 ALTA |
| **Subtotal Alta** | **8** | |
| Batch Operations | 1 | 🟢 MEDIA |
| Role/Permission Mgmt | 5 | 🟢 MEDIA |
| Student Progress | 1 | 🟢 MEDIA |
| **Subtotal Media** | **7** | |
| Debug/Utilities | 1 | 🔵 BAJA |
| **Subtotal Baja** | **1** | |
| **TOTAL PENDIENTES** | **42** | |

---

## Plan de Ejecución Sugerido

### Fase 1: Event Management Core (2-3 horas)
1. `GET /api/postgres/events/[id]/route.ts` - GET single event
2. `GET /api/postgres/events/[id]/bookings/route.ts` - GET event bookings
3. `GET /api/postgres/events/filtered/route.ts` - GET filtered events

### Fase 2: Advisor Operations (1-2 horas)
4. `GET /api/postgres/advisors/by-email/[email]/route.ts`
5. `GET /api/postgres/advisors/[id]/events/route.ts`
6. `GET /api/postgres/advisors/[id]/stats/route.ts`
7. `GET /api/postgres/advisors/[id]/name/route.ts`

### Fase 3: Student Academic Core (3-4 horas)
8. `PUT /api/postgres/students/[id]/step/route.ts` - Update step
9. `POST /api/postgres/students/[id]/step-override/route.ts` - Step override
10. `DELETE /api/postgres/students/[id]/step-override/route.ts`
11. `POST /api/postgres/academic/user/route.ts` - Create academica record
12. `POST /api/postgres/academic/activity/route.ts` - Generate activity
13. `PUT /api/postgres/academic/[id]/route.ts` - Update class record
14. `GET /api/postgres/niveles/[codigo]/steps/route.ts` - Level steps

### Fase 4: Comments & Contracts (2-3 horas)
15. `GET /api/postgres/people/[id]/comments/route.ts`
16. `POST /api/postgres/people/[id]/comments/route.ts`
17. `POST /api/postgres/contracts/route.ts` - Create contract
18. `GET /api/postgres/contracts/search/route.ts` - Search by pattern
19. `POST /api/postgres/people/route.ts` - Create person
20. `POST /api/postgres/financial/route.ts` - Create financial
21. `PUT /api/postgres/students/[id]/extend/route.ts` - Extend vigencia
22. `PUT /api/postgres/students/[id]/toggle-status/route.ts`

### Fase 5: Approval & Service (1-2 horas)
23. `GET /api/postgres/approvals/pending/route.ts`
24. `PUT /api/postgres/approvals/[id]/route.ts`
25. `GET /api/postgres/events/welcome/route.ts`
26. `GET /api/postgres/events/sessions/route.ts`
27. `GET /api/postgres/people/beneficiarios-sin-registro/route.ts`

### Fase 6: Materials & Batch (1 hora)
28. `GET /api/postgres/materials/usuario/route.ts`
29. `GET /api/postgres/materials/nivel/route.ts`
30. `POST /api/postgres/events/batch-counts/route.ts`

### Fase 7: Roles & Progress (2 horas)
31. `GET /api/postgres/roles/[rol]/permissions/route.ts`
32. `PUT /api/postgres/roles/[rol]/permissions/route.ts`
33. `POST /api/postgres/roles/route.ts`
34. `GET /api/postgres/users/[email]/role/route.ts`
35. `PUT /api/postgres/users/[email]/role/route.ts`
36. `GET /api/postgres/students/[id]/progress/route.ts`

**Total estimado**: ~15-20 horas de desarrollo

---

## Notas Importantes

### Endpoints que YA NO se necesitan migrar:
- ✅ `GET /api/wix-proxy/calendario-events` → Ya existe `/api/postgres/calendar/events`
- ✅ `GET /api/wix-proxy/advisors` → Ya existe `/api/postgres/advisors`
- ✅ `GET /api/wix-proxy/niveles` → Ya existe `/api/postgres/niveles`
- ✅ `GET /api/wix-proxy/person-by-id` → Ya existe `/api/postgres/students/[id]`
- ✅ `POST /api/wix-proxy/create-calendario-event` → Ya existe `/api/postgres/events` (POST)
- ✅ `PUT /api/wix-proxy/update-calendario-event` → Ya existe `/api/postgres/events/[id]` (PUT)
- ✅ `DELETE /api/wix-proxy/delete-calendario-event` → Ya existe `/api/postgres/events/[id]` (DELETE)

### Endpoints con lógica compleja que requieren cuidado:
- 🟠 `student-progress` - Genera diagnóstico con múltiples queries y lógica de negocio
- 🟠 `create-contract` - Crea titular, beneficiario(s), académico, financiero en transacción
- 🟠 `eventos-inscritos-batch` - Performance crítico (batch query)
- 🟠 `generate-student-activity` - Genera reportes complejos

---

## Archivos del Frontend a Actualizar Después

Una vez migrados todos los endpoints, hay que actualizar las llamadas en estos archivos:

**Críticos (26 archivos)**:
1. `src/app/sesion/[id]/page.tsx`
2. `src/app/dashboard/aprobacion/page.tsx`
3. `src/app/dashboard/comercial/crear-contrato/page.tsx`
4. `src/components/advisors/AdvisorsStatistics.tsx`
5. `src/components/session/SessionMaterialTab.tsx`
6. `src/components/calendar/EventModal.tsx`
7. `src/app/dashboard/academic/agenda-sesiones/page.tsx`
8. `src/components/advisor/AdvisorStats.tsx`
9. `src/components/session/SessionStudentsTab.tsx`
10. `src/components/advisor/AdvisorCalendar.tsx`
11. `src/components/person/PersonComments.tsx`
12. `src/components/person/PersonAdmin.tsx`
13. `src/app/panel-advisor/page.tsx`
14. `src/components/student/StudentComments.tsx`
15. `src/app/dashboard/academic/agenda-academica/page.tsx`
16. `src/components/student/StudentContract.tsx`
17. `src/components/academic/EventDetailModal.tsx`
18. `src/components/student/StudentProgress.tsx`
19. `src/app/dashboard/academic/advisors/page.tsx`
20. `src/components/student/StudentChangeStep.tsx`
21. `src/app/dashboard/servicio/lista-sesiones/page.tsx`
22. `src/components/student/StudentAcademic.tsx`
23. `src/components/student/StudentOnHold.tsx`
24. `src/app/dashboard/servicio/sin-registro/page.tsx`
25. `src/app/dashboard/servicio/welcome-session/page.tsx`
26. `src/lib/wix.ts`

**Patrón de actualización**:
```typescript
// ANTES:
const response = await fetch('/api/wix-proxy/event-bookings', { ... });

// DESPUÉS:
const response = await fetch('/api/postgres/events/[id]/bookings', { ... });
```

---

## Progreso Esperado

| Fase | Endpoints | Progreso Acumulado |
|------|-----------|-------------------|
| Estado Actual | 25 | 25/67 (37%) |
| Fase 1 | +3 | 28/67 (42%) |
| Fase 2 | +4 | 32/67 (48%) |
| Fase 3 | +7 | 39/67 (58%) |
| Fase 4 | +8 | 47/67 (70%) |
| Fase 5 | +5 | 52/67 (78%) |
| Fase 6 | +3 | 55/67 (82%) |
| Fase 7 | +6 | 61/67 (91%) |
| Testing & Fixes | +6 | 67/67 (100%) |

**Meta final**: 67 endpoints postgres (100% cobertura)
