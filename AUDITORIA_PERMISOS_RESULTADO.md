# Auditoría de Permisos - Comparación Wix vs Código

**Fecha**: 2025-01-15
**Objetivo**: Identificar discrepancias entre permisos en Wix (ROL_PERMISOS.csv) y código TypeScript

---

## Resumen Ejecutivo

- **Permisos en Wix CSV**: 41 permisos únicos
- **Permisos en TypeScript**: 70 permisos únicos
- **Permisos en ambos**: 40 permisos
- **Solo en TypeScript**: 30 permisos (NO EXISTEN EN WIX)
- **Solo en Wix**: 1 permiso (NO EXISTE EN CÓDIGO)

⚠️ **CRÍTICO**: 30 permisos definidos en código pero no existen en Wix podrían causar problemas de autorización.

---

## 1. Permisos SOLO en TypeScript (no en Wix) - 30 permisos

### ACADEMICO (9 permisos)
```
❌ ACADEMICO.ACADEMICA.AGENDAMIENTO
❌ ACADEMICO.ACADEMICA.ESTADISTICAS
❌ ACADEMICO.ACADEMICA.EXPORTAR_CSV
❌ ACADEMICO.ACADEMICA.EXPORTAR_STATS_CSV
❌ ACADEMICO.ACADEMICA.VER
❌ ACADEMICO.ADVISOR.AGREGAR
❌ ACADEMICO.ADVISOR.ESTADISTICA
❌ ACADEMICO.ADVISOR.LISTA_VER           ⚠️ CRÍTICO - Se usa en middleware para TALERO
❌ ACADEMICO.ADVISOR.VER_ENLACE
```

### ACADEMICO.AGENDA (2 permisos)
```
❌ ACADEMICO.AGENDA.CALENDARIO_VER
❌ ACADEMICO.AGENDA.LISTA_VER
```

**Nota**: En Wix existe `VER_CALENDARIO` pero en TypeScript existe `CALENDARIO_VER` (orden invertido).

### APROBACION (2 permisos)
```
❌ APROBACION.GLOBAL.ACTUALIZAR
❌ APROBACION.GLOBAL.EXPORTAR_CSV
```

### PERSON.ADMIN (2 permisos - Categoría completa no existe en Wix)
```
❌ PERSON.ADMIN.ACTIVAR_DESACTIVAR
❌ PERSON.ADMIN.APROBAR
```

**Nota**: Wix usa `PERSON.INFO.*` para todas las operaciones de persona.

### STUDENT.ACADEMIA (7 permisos)
```
❌ STUDENT.ACADEMIA.ANOTACION_ADVISOR
❌ STUDENT.ACADEMIA.ASIGNAR_STEP
❌ STUDENT.ACADEMIA.COMENTARIOS_ESTUDIANTE
❌ STUDENT.ACADEMIA.ELIMINAR_EVENTO
❌ STUDENT.ACADEMIA.TABLA_DESCARGAR
❌ STUDENT.ACADEMIA.TABLA_FILTROS
```

### STUDENT.CONTRATO (3 permisos - Categoría completa no existe en Wix)
```
❌ STUDENT.CONTRATO.ACTIVAR_HOLD
❌ STUDENT.CONTRATO.CONSULTA
❌ STUDENT.CONTRATO.EXTENDER_VIGENCIA
```

### STUDENT.FINANCIERA (3 permisos - Categoría completa no existe en Wix)
```
❌ STUDENT.FINANCIERA.ENVIO_RECORDATORIO
❌ STUDENT.FINANCIERA.GENERAR_ESTADO
❌ STUDENT.FINANCIERA.REGISTRAR_PAGO
```

### STUDENT.GLOBAL (1 permiso)
```
❌ STUDENT.GLOBAL.GUARDAR_PLANTILLA
```

---

## 2. Permisos SOLO en Wix (no en código) - 1 permiso

```
❌ ACADEMICO.AGENDA.VER_ENLACE
```

**Impacto**: Este permiso existe en Wix pero no está definido en TypeScript enums. Sin embargo, `ACADEMICO.ADVISOR.VER_ENLACE` SÍ existe en TypeScript, puede ser un error de categorización.

---

## 3. Permisos en AMBOS (40 permisos) ✅

### ACADEMICO.AGENDA (6 permisos)
```
✅ ACADEMICO.AGENDA.CREAR_EVENTO
✅ ACADEMICO.AGENDA.EDITAR
✅ ACADEMICO.AGENDA.ELIMINAR
✅ ACADEMICO.AGENDA.FILTRO
✅ ACADEMICO.AGENDA.NUEVO_EVENTO
✅ ACADEMICO.AGENDA.VER_AGENDA
✅ ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA
✅ ACADEMICO.AGENDA.VER_CALENDARIO
```

### APROBACION.MODIFICAR (6 permisos)
```
✅ APROBACION.MODIFICAR.ACTUALIZAR
✅ APROBACION.MODIFICAR.APROBACION_AUTONOMA
✅ APROBACION.MODIFICAR.CONTRATO
✅ APROBACION.MODIFICAR.DESCARGAR
✅ APROBACION.MODIFICAR.ENVIAR_PDF
✅ APROBACION.MODIFICAR.EXPORTAR_CSV
```

### COMERCIAL.CONTRATO (4 permisos)
```
✅ COMERCIAL.CONTRATO.APROBACION_AUTONOMA
✅ COMERCIAL.CONTRATO.DESCARGAR
✅ COMERCIAL.CONTRATO.ENVIAR_PDF
✅ COMERCIAL.CONTRATO.MODIFICAR
```

### COMERCIAL.PROSPECTOS (1 permiso)
```
✅ COMERCIAL.PROSPECTOS.VER
```

### PERSON.INFO (8 permisos)
```
✅ PERSON.INFO.ADICION_DOCUMENTACION
✅ PERSON.INFO.AGREGAR_BENEFICIARIO
✅ PERSON.INFO.CAMBIAR_ESTADO
✅ PERSON.INFO.CAMBIO_CELULAR
✅ PERSON.INFO.DESCARGAR_CONTRATO
✅ PERSON.INFO.ELIMINAR
✅ PERSON.INFO.MODIFICAR
✅ PERSON.INFO.VER_DOCUMENTACION
✅ PERSON.INFO.WHATSAPP
```

### SERVICIO.SESIONES (2 permisos)
```
✅ SERVICIO.SESIONES.CARGAR_EVENTOS
✅ SERVICIO.SESIONES.EXPORTAR_CSV
```

### SERVICIO.USUARIOS (2 permisos)
```
✅ SERVICIO.USUARIOS.ACTUALIZAR
✅ SERVICIO.USUARIOS.EXPORTAR_CSV
```

### SERVICIO.WELCOME (2 permisos)
```
✅ SERVICIO.WELCOME.CARGAR_EVENTOS
✅ SERVICIO.WELCOME.EXPORTAR_CSV
```

### STUDENT.ACADEMIA (3 permisos)
```
✅ STUDENT.ACADEMIA.AGENDAR_CLASE
✅ STUDENT.ACADEMIA.EVALUACION
✅ STUDENT.ACADEMIA.MARCAR_STEP
```

### STUDENT.GLOBAL (3 permisos)
```
✅ STUDENT.GLOBAL.CONSULTA_CONTRATO
✅ STUDENT.GLOBAL.ENVIAR_MENSAJE
✅ STUDENT.GLOBAL.GENERAR_ESTADO_CUENTA
```

---

## 4. Discrepancias Críticas

### 🚨 PROBLEMA CRÍTICO #1: ACADEMICO.ADVISOR.LISTA_VER
**Ubicación**: Usado en middleware y dashboard para rol TALERO
**Estado**: ❌ NO EXISTE EN WIX
**Impacto**: ALTO - El middleware espera este permiso pero Wix no lo tiene
**Acción requerida**:
- Opción A: Agregar `ACADEMICO.ADVISOR.LISTA_VER` a Wix ROL_PERMISOS
- Opción B: Cambiar middleware para usar un permiso que SÍ existe en Wix

**Archivos afectados**:
- `src/lib/middleware-permissions.ts:78` (ROUTE_PERMISSIONS)
- `src/components/layout/DashboardLayout.tsx:250` (pagePermissions)

### 🚨 PROBLEMA CRÍTICO #2: Permisos PERSON.ADMIN.*
**Estado**: ❌ Categoría completa no existe en Wix
**Permisos afectados**:
- `PERSON.ADMIN.ACTIVAR_DESACTIVAR`
- `PERSON.ADMIN.APROBAR`

**Impacto**: MEDIO - Si algún rol en Wix tiene estos permisos, no funcionarán
**Acción requerida**: Eliminar estos permisos del código o añadirlos a Wix

### 🚨 PROBLEMA CRÍTICO #3: Categorías STUDENT no sincronizadas
**Categorías en código pero no en Wix**:
- `STUDENT.CONTRATO.*` (3 permisos)
- `STUDENT.FINANCIERA.*` (3 permisos)

**Impacto**: MEDIO - Funcionalidades definidas en código pero sin control de acceso real
**Acción requerida**: Decidir si agregar a Wix o eliminar del código

### ⚠️ PROBLEMA MENOR #4: ACADEMICO.AGENDA.VER_ENLACE
**Estado**: ✅ Existe en Wix, ❌ No en código TypeScript
**Impacto**: BAJO - Wix tiene permiso que no está tipado
**Acción requerida**: Agregar a enum `AcademicoPermission` en TypeScript

---

## 5. Análisis por Módulo

### ACADEMICO
- **En ambos**: 8 permisos ✅
- **Solo en código**: 11 permisos ❌
- **Solo en Wix**: 1 permiso ❌
- **Sincronización**: 40% (muy bajo)

### APROBACION
- **En ambos**: 6 permisos ✅
- **Solo en código**: 2 permisos ❌
- **Sincronización**: 75%

### COMERCIAL
- **En ambos**: 5 permisos ✅
- **Solo en código**: 0 permisos
- **Sincronización**: 100% ✅

### PERSON
- **En ambos**: 9 permisos ✅
- **Solo en código**: 2 permisos (categoría ADMIN) ❌
- **Sincronización**: 82%

### SERVICIO
- **En ambos**: 6 permisos ✅
- **Solo en código**: 0 permisos
- **Sincronización**: 100% ✅

### STUDENT
- **En ambos**: 6 permisos ✅
- **Solo en código**: 13 permisos ❌
- **Sincronización**: 32% (muy bajo)

---

## 6. Recomendaciones

### Acción Inmediata (CRÍTICO)
1. **Agregar `ACADEMICO.ADVISOR.LISTA_VER` a Wix** o cambiar el middleware para usar un permiso existente como `ACADEMICO.AGENDA.VER_AGENDA`

### Acción Prioritaria (ALTA)
2. **Decidir sobre permisos huérfanos**: Los 30 permisos en código pero no en Wix deben ser:
   - Agregados a Wix si son funcionalidades reales
   - Eliminados del código si son legacy/no usados

3. **Agregar `ACADEMICO.AGENDA.VER_ENLACE` al enum TypeScript**

### Acción Recomendada (MEDIA)
4. **Auditar uso real**: Revisar si los 30 permisos "solo en código" están realmente siendo usados en la aplicación
5. **Consolidar categorías**: Decidir si mantener `PERSON.ADMIN.*` o migrar todo a `PERSON.INFO.*`
6. **Documentar decisiones**: Actualizar ARQUITECTURA_PERMISOS.md con la decisión final

### Proceso Continuo
7. **Establecer proceso de sincronización**: Cada nuevo permiso debe agregarse simultáneamente a:
   - Wix ROL_PERMISOS
   - TypeScript enums
   - ARQUITECTURA_PERMISOS.md
   - Middleware route mappings (si aplica)

---

## 7. Próximos Pasos Sugeridos

1. ✅ Revisar middleware y dashboard para verificar qué permisos están realmente en uso
2. ⏳ Crear lista de permisos a agregar a Wix
3. ⏳ Crear lista de permisos a eliminar del código
4. ⏳ Ejecutar cambios en Wix
5. ⏳ Actualizar TypeScript enums
6. ⏳ Probar con todos los roles
7. ⏳ Actualizar documentación

---

## 8. Impacto en Roles Existentes

Según el CSV, TALERO tiene en el archivo original:
```json
["PERSON.INFO.VER_DOCUMENTACION", "PERSON.INFO.WHATSAPP", "STUDENT.GLOBAL.ENVIAR_MENSAJE",
 "STUDENT.GLOBAL.CONSULTA_CONTRATO", "STUDENT.GLOBAL.GENERAR_ESTADO_CUENTA",
 "ACADEMICO.AGENDA.VER_CALENDARIO", "ACADEMICO.AGENDA.VER_AGENDA", "ACADEMICO.AGENDA.FILTRO",
 "ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA", "SERVICIO.WELCOME.CARGAR_EVENTOS",
 "SERVICIO.WELCOME.EXPORTAR_CSV", "SERVICIO.SESIONES.CARGAR_EVENTOS",
 "SERVICIO.SESIONES.EXPORTAR_CSV", "SERVICIO.USUARIOS.ACTUALIZAR", "SERVICIO.USUARIOS.EXPORTAR_CSV"]
```

Pero según el resumen de la sesión anterior, en Wix actual TALERO tiene:
```json
["ACADEMICO.ADVISOR.LISTA_VER"]
```

⚠️ **INCONSISTENCIA**: El CSV muestra 15 permisos pero Wix real tiene 1 permiso que ni siquiera está en el CSV.

---

## Conclusión

La sincronización entre Wix y el código está en **58%** (40 de 70 permisos coinciden). Se requiere una limpieza importante para lograr consistencia al 100%.

La prioridad máxima es resolver el permiso `ACADEMICO.ADVISOR.LISTA_VER` que actualmente bloquea el acceso de TALERO a la ruta `/dashboard/academic/advisors`.
