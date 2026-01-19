# Plan de Sincronización de Permisos - Wix vs Código

**Fecha**: 2025-01-15
**Objetivo**: Alcanzar 100% de sincronización entre Wix ROL_PERMISOS y TypeScript

---

## Problema Actual

**Sincronización**: 58% (40 de 70 permisos coinciden)
- ❌ 30 permisos solo en código (no en Wix)
- ❌ 1 permiso solo en Wix (no en código)
- ✅ 40 permisos en ambos

---

## Estrategia Recomendada

### Opción A: Wix como Fuente de Verdad (RECOMENDADA) ✅
Eliminar del código todos los permisos que no existen en Wix, excepto los que se van a agregar a Wix.

**Ventajas**:
- Wix es la base de datos de producción
- Evita confusión con permisos fantasma
- Más fácil de mantener

### Opción B: Código como Fuente de Verdad
Agregar a Wix todos los 30 permisos que faltan.

**Desventajas**:
- Muchos permisos no están en uso real
- Contamina la base de datos con permisos innecesarios

---

## Plan de Acción Detallado

### FASE 1: Agregar Permisos Críticos a Wix (URGENTE)

#### 1.1 Permisos ACADEMICO.ADVISOR.* (CRÍTICO - EN USO)
Estos permisos están activamente usados en middleware y dashboard:

```json
{
  "modulo": "ACADEMICO.ADVISOR",
  "permisos_a_agregar": [
    "ACADEMICO.ADVISOR.LISTA_VER",      // ⚠️ URGENTE - Usado para TALERO
    "ACADEMICO.ADVISOR.VER_ENLACE",     // Usado en middleware
    "ACADEMICO.ADVISOR.AGREGAR",        // Usado en middleware
    "ACADEMICO.ADVISOR.ESTADISTICA"     // Usado en middleware
  ]
}
```

**Acción Wix**:
```javascript
// Agregar estos permisos a los roles correspondientes en ROL_PERMISOS
// TALERO ya tiene asignado ACADEMICO.ADVISOR.LISTA_VER según logs
// Verificar que esté en Wix
```

**Archivos afectados**:
- `src/lib/middleware-permissions.ts` (líneas 78, 121-124)
- `src/components/layout/DashboardLayout.tsx` (línea 250)

#### 1.2 Permiso ACADEMICO.AGENDA.VER_ENLACE (desde Wix)
Este permiso existe en Wix pero NO en TypeScript.

**Acción Código**:
```typescript
// Agregar en src/types/permissions.ts
export enum AcademicoPermission {
  // ... existing
  VER_ENLACE_AGENDA = 'ACADEMICO.AGENDA.VER_ENLACE',
}
```

---

### FASE 2: Limpiar Permisos No Usados del Código (MEDIA PRIORIDAD)

#### 2.1 ELIMINAR: PERSON.ADMIN.* (no usado)
Estos permisos solo están definidos, nunca usados en el código.

**Acción**: Eliminar de `src/types/permissions.ts`:
```typescript
// ELIMINAR estas líneas
export enum PersonPermission {
  ACTIVAR_DESACTIVAR = 'PERSON.ADMIN.ACTIVAR_DESACTIVAR', // ❌
  APROBAR = 'PERSON.ADMIN.APROBAR',                       // ❌
}
```

#### 2.2 ELIMINAR: STUDENT.CONTRATO.* (no usado)
Estos permisos solo están definidos, nunca usados.

**Acción**: Eliminar de `src/types/permissions.ts`:
```typescript
// ELIMINAR estas líneas
export enum StudentPermission {
  CONSULTA = 'STUDENT.CONTRATO.CONSULTA',                      // ❌
  ACTIVAR_HOLD = 'STUDENT.CONTRATO.ACTIVAR_HOLD',              // ❌
  EXTENDER_VIGENCIA = 'STUDENT.CONTRATO.EXTENDER_VIGENCIA',    // ❌
}
```

#### 2.3 ELIMINAR: STUDENT.FINANCIERA.* (no usado)
Estos permisos solo están definidos, nunca usados.

**Acción**: Eliminar de `src/types/permissions.ts`:
```typescript
// ELIMINAR estas líneas
export enum StudentPermission {
  GENERAR_ESTADO = 'STUDENT.FINANCIERA.GENERAR_ESTADO',        // ❌
  REGISTRAR_PAGO = 'STUDENT.FINANCIERA.REGISTRAR_PAGO',        // ❌
  ENVIO_RECORDATORIO = 'STUDENT.FINANCIERA.ENVIO_RECORDATORIO', // ❌
}
```

#### 2.4 ELIMINAR: ACADEMICO.ACADEMICA.* (no usado)
Categoría completa no usada:

**Acción**: Eliminar de `src/types/permissions.ts`:
```typescript
// ELIMINAR estas líneas
export enum AcademicoPermission {
  AGENDAMIENTO = 'ACADEMICO.ACADEMICA.AGENDAMIENTO',           // ❌
  ESTADISTICAS = 'ACADEMICO.ACADEMICA.ESTADISTICAS',           // ❌
  EXPORTAR_CSV = 'ACADEMICO.ACADEMICA.EXPORTAR_CSV',           // ❌
  EXPORTAR_STATS_CSV = 'ACADEMICO.ACADEMICA.EXPORTAR_STATS_CSV', // ❌
  VER = 'ACADEMICO.ACADEMICA.VER',                             // ❌
}
```

#### 2.5 ELIMINAR: APROBACION.GLOBAL.* (no usado)

**Acción**: Eliminar de `src/types/permissions.ts`:
```typescript
// ELIMINAR estas líneas
export enum AprobacionPermission {
  ACTUALIZAR = 'APROBACION.GLOBAL.ACTUALIZAR',     // ❌
  EXPORTAR_CSV = 'APROBACION.GLOBAL.EXPORTAR_CSV', // ❌
}
```

#### 2.6 REVISAR: STUDENT.ACADEMIA.* (algunos usados)
Hay 7 permisos solo en código, pero algunos podrían estar en uso:

**Acción**: Auditar primero antes de eliminar:
```bash
# Verificar uso de cada uno
grep -r "ANOTACION_ADVISOR" src/
grep -r "ASIGNAR_STEP" src/
grep -r "COMENTARIOS_ESTUDIANTE" src/
grep -r "ELIMINAR_EVENTO" src/
grep -r "TABLA_DESCARGAR" src/
grep -r "TABLA_FILTROS" src/
```

**Decisión pendiente**: Si no están en uso → Eliminar. Si están en uso → Agregar a Wix.

#### 2.7 REVISAR: ACADEMICO.AGENDA extras
Hay permisos similares con naming diferente:

**En Wix**: `ACADEMICO.AGENDA.VER_CALENDARIO`
**En Código**: `ACADEMICO.AGENDA.CALENDARIO_VER` (invertido)

**Acción**: Eliminar `CALENDARIO_VER` del código (usar solo `VER_CALENDARIO`).

---

### FASE 3: Actualizar Archivos de Configuración

#### 3.1 Actualizar middleware-permissions.ts
Después de las limpiezas, actualizar las rutas:

**Archivo**: `src/lib/middleware-permissions.ts`

**Cambios**:
```typescript
// Asegurar que todos los permisos en ROUTE_PERMISSIONS existan en Wix
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/dashboard/academic/advisors': [
    'ACADEMICO.ADVISOR.LISTA_VER' as Permission, // ✅ Debe existir en Wix
  ],
  // ... verificar todos los demás
};
```

#### 3.2 Actualizar DashboardLayout.tsx
**Archivo**: `src/components/layout/DashboardLayout.tsx`

Verificar que todos los permisos en `pagePermissions` existan en Wix.

#### 3.3 Actualizar ARQUITECTURA_PERMISOS.md
Documentar todos los cambios realizados.

---

## Checklist de Ejecución

### ✅ INMEDIATO (HOY)
- [ ] Verificar en Wix si `ACADEMICO.ADVISOR.LISTA_VER` existe
  - Si NO existe: Agregarlo al rol TALERO
  - Si existe: Verificar que esté bien escrito
- [ ] Probar acceso de TALERO a `/dashboard/academic/advisors`
- [ ] Agregar `ACADEMICO.AGENDA.VER_ENLACE` al enum TypeScript

### ⏳ ESTA SEMANA
- [ ] Agregar permisos `ACADEMICO.ADVISOR.*` a Wix (4 permisos)
- [ ] Asignar permisos ADVISOR a los roles correspondientes
- [ ] Eliminar permisos PERSON.ADMIN.* del código
- [ ] Eliminar permisos STUDENT.CONTRATO.* del código
- [ ] Eliminar permisos STUDENT.FINANCIERA.* del código
- [ ] Eliminar permisos ACADEMICO.ACADEMICA.* del código
- [ ] Eliminar permisos APROBACION.GLOBAL.* del código

### ⏳ PRÓXIMA SEMANA
- [ ] Auditar uso de STUDENT.ACADEMIA.* extras
- [ ] Decidir sobre cada permiso: eliminar o agregar a Wix
- [ ] Limpiar duplicados (VER_CALENDARIO vs CALENDARIO_VER)
- [ ] Actualizar ARQUITECTURA_PERMISOS.md
- [ ] Actualizar CLAUDE.md con decisiones finales

### ⏳ VERIFICACIÓN FINAL
- [ ] Ejecutar auditoría nuevamente
- [ ] Confirmar 100% sincronización
- [ ] Probar cada rol con sus permisos
- [ ] Commit y deployment

---

## Scripts de Verificación

### Script 1: Verificar Wix tiene permisos críticos
```bash
# Verificar que estos permisos existan en Wix
curl "https://www.lgsplataforma.com/_functions/rolePermissions?rol=TALERO" | jq '.permisos'

# Debe incluir: "ACADEMICO.ADVISOR.LISTA_VER"
```

### Script 2: Extraer permisos únicos después de limpieza
```bash
# Ejecutar después de las eliminaciones
grep -E "^\s+[A-Z_]+ = '[A-Z_]+\.[A-Z_]+\.[A-Z_]+'" src/types/permissions.ts | \
  sed "s/.*= '//g" | sed "s/'.*//g" | sort -u > /tmp/code_perms.txt

cat wix-database/ROL_PERMISOS.csv | \
  grep -oE '"[A-Z_]+\.[A-Z_]+\.[A-Z_]+"' | sed 's/"//g' | \
  sort -u > /tmp/wix_perms.txt

# Comparar
echo "=== Solo en código ==="
comm -23 /tmp/code_perms.txt /tmp/wix_perms.txt

echo "=== Solo en Wix ==="
comm -13 /tmp/code_perms.txt /tmp/wix_perms.txt

echo "=== En ambos ==="
comm -12 /tmp/code_perms.txt /tmp/wix_perms.txt | wc -l
```

---

## Resultado Esperado

Después de ejecutar todas las fases:

- **Sincronización**: 100%
- **Permisos en Wix**: ~45 permisos
- **Permisos en código**: ~45 permisos (mismo número)
- **Permisos únicos**: 0 (todos coinciden)
- **Roles funcionando**: 9/9
- **Rutas protegidas**: 100%

---

## Notas Importantes

1. **TALERO es caso especial**: Según logs, Wix tiene `ACADEMICO.ADVISOR.LISTA_VER` pero el CSV original tiene 15 permisos diferentes. Clarificar qué es correcto.

2. **No eliminar permisos de Wix**: Solo limpiar código. Wix es la fuente de verdad.

3. **Probar después de cada fase**: No hacer todos los cambios de golpe.

4. **Cache de 5 minutos**: Después de cambios en Wix, esperar 5 minutos o invalidar cache manualmente.

5. **Backup antes de limpiar**: Hacer commit antes de eliminar permisos del código.

---

## Contacto para Dudas

Si tienes dudas sobre si un permiso debe eliminarse o agregarse, verificar:
1. Búsqueda en código: `grep -r "PERMISO" src/`
2. Verificar en Wix: `curl rolePermissions API`
3. Consultar con el equipo de producto sobre funcionalidades

---

**Última actualización**: 2025-01-15
**Estado**: Plan aprobado, pendiente ejecución
