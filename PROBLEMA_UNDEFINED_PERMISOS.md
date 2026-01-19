# Problema: Permisos guardados como "undefined" desde /admin/permissions

**Fecha**: 2025-01-15
**Severidad**: ALTA
**Estado**: ✅ RESUELTO (pero puede volver a ocurrir)

---

## 🐛 Descripción del Problema

Cuando se guardan permisos desde el endpoint `/admin/permissions`, algunos permisos se guardan en Wix como la string literal `"undefined"` en lugar del valor correcto del permiso.

### Ejemplo del Bug

**Esperado**:
```json
{
  "rol": "TALERO",
  "permisos": ["ACADEMICO.ADVISOR.LISTA_VER"]
}
```

**Lo que se guardó**:
```json
{
  "rol": "TALERO",
  "permisos": ["undefined"]
}
```

---

## 🔍 Causa Raíz

El problema ocurre en la cadena de serialización entre:
1. Frontend (`/admin/permissions` page)
2. TypeScript enums (`src/types/permissions.ts`)
3. Catálogo de permisos (`src/config/permissions.ts`)
4. API de actualización (`/api/permissions/update`)

### Flujo del Bug

1. **Catálogo define permisos usando enums**:
   ```typescript
   // src/config/permissions.ts
   {
     code: AcademicoPermission.LISTA_ADVISORS_VER,  // ← Enum reference
     module: Module.ACADEMICO,
     name: 'Ver Lista Advisors',
   }
   ```

2. **Frontend construye permissionState**:
   ```typescript
   // src/app/admin/permissions/page.tsx:138-139
   matrixData.permissions.forEach((perm) => {
     state[role][perm.code] = rolePerms?.permissions.includes(perm.code) || false;
   });
   ```

   Si `perm.code` no se evalúa correctamente al string, puede ser `undefined`.

3. **Al guardar, se envían keys que son `undefined`**:
   ```typescript
   // src/app/admin/permissions/page.tsx:171-173
   const permissions = Object.entries(permissionState[selectedRole] || {})
     .filter(([_, value]) => value)
     .map(([key, _]) => key as Permission);  // ← Si key es undefined, se envía "undefined"
   ```

4. **Wix guarda literalmente `["undefined"]`**

---

## ✅ Solución Aplicada (TALERO)

### Corrección Inmediata
```bash
curl -X POST "https://www.lgsplataforma.com/_functions/updateRolePermissions" \
  -H "Content-Type: application/json" \
  -d '{"rol":"TALERO","permisos":["ACADEMICO.ADVISOR.LISTA_VER"]}'
```

**Resultado**:
```json
{
  "success": true,
  "rol": "TALERO",
  "permisos": ["ACADEMICO.ADVISOR.LISTA_VER"],
  "fechaActualizacion": "2025-10-14T14:29:33.787Z"
}
```

---

## 🔧 Cómo Prevenir Este Problema

### Opción 1: Usar CSV en lugar de /admin/permissions (RECOMENDADO)

Importar `ROL_PERMISOS_ACTUALIZADO_V2.csv` directamente a Wix evita problemas de serialización:
- ✅ No depende de enums
- ✅ Strings literales directas
- ✅ Más rápido (actualiza 9 roles de golpe)
- ✅ Sin problemas de cache

### Opción 2: Validar permisos antes de guardar

Agregar validación en el frontend antes de enviar:

```typescript
// src/app/admin/permissions/page.tsx:171-173
const permissions = Object.entries(permissionState[selectedRole] || {})
  .filter(([_, value]) => value)
  .map(([key, _]) => key as Permission)
  .filter(perm => perm !== undefined && perm !== 'undefined');  // ← Agregar esto

// Validar que no hay undefined
if (permissions.some(p => !p || p === 'undefined')) {
  alert('Error: Algunos permisos no se cargaron correctamente. Recarga la página.');
  return;
}
```

### Opción 3: Verificar en el API endpoint

Agregar validación en `/api/permissions/update`:

```typescript
// src/app/api/permissions/update/route.ts:63-68
if (!Array.isArray(permissions)) {
  return NextResponse.json(
    { error: 'permissions debe ser un array' },
    { status: 400 }
  );
}

// Agregar validación de undefined
const invalidPerms = permissions.filter(p => !p || p === 'undefined' || p === undefined);
if (invalidPerms.length > 0) {
  console.error('❌ Permisos inválidos detectados:', invalidPerms);
  return NextResponse.json(
    {
      error: 'Algunos permisos son inválidos (undefined)',
      details: `${invalidPerms.length} permisos inválidos detectados`,
      hint: 'Recarga la página /admin/permissions e intenta nuevamente'
    },
    { status: 400 }
  );
}
```

---

## 🚨 Cómo Detectar Si Tienes Este Problema

### 1. Verificar desde API
```bash
curl "https://www.lgsplataforma.com/_functions/rolePermissions?rol=NOMBRE_ROL" | jq '.permisos'
```

Si ves `["undefined"]` o `"undefined"` en el array, tienes el problema.

### 2. Verificar en logs del navegador
Si ves en console:
```
User permissions: Array(1)
  0: "undefined"
```

Es el problema.

### 3. Verificar comportamiento
Si un usuario NO ve secciones que debería ver según su rol, verificar sus permisos en Wix.

---

## 📋 Cómo Corregir Si Ocurre

### Método 1: Via API (Más Rápido)
```bash
# Reemplazar ROLNAME y ["PERM1","PERM2"] con los valores correctos
curl -X POST "https://www.lgsplataforma.com/_functions/updateRolePermissions" \
  -H "Content-Type: application/json" \
  -d '{"rol":"ROLNAME","permisos":["PERM1","PERM2"]}'
```

### Método 2: Via Wix Dashboard
1. Ir a Wix Dashboard → Database → ROL_PERMISOS
2. Buscar el rol afectado
3. Editar campo `permisos`
4. Reemplazar `["undefined"]` con el array correcto
5. Guardar

### Método 3: Reimportar CSV
1. Hacer backup actual
2. Eliminar registros
3. Importar `ROL_PERMISOS_ACTUALIZADO_V2.csv`
4. Verificar

---

## 🎯 Roles Afectados Conocidos

| Rol | Estado | Fecha Corregido | Método |
|-----|--------|-----------------|--------|
| TALERO | ✅ Corregido | 2025-10-14 14:29 | API directa |

---

## 🔄 Testing Después de Corregir

1. **Verificar en Wix**:
   ```bash
   curl "https://www.lgsplataforma.com/_functions/rolePermissions?rol=TALERO" | jq '.permisos'
   # Esperado: ["ACADEMICO.ADVISOR.LISTA_VER"]
   ```

2. **Logout y Login** como el usuario afectado

3. **Verificar en navegador** (console):
   ```
   User permissions: Array(1)
     0: "ACADEMICO.ADVISOR.LISTA_VER"  ✅ Correcto
   ```

4. **Verificar acceso** a las secciones correspondientes

---

## 📚 Referencias

- **Archivo afectado (frontend)**: `src/app/admin/permissions/page.tsx:171-173`
- **Archivo afectado (API)**: `src/app/api/permissions/update/route.ts:46-68`
- **Catálogo de permisos**: `src/config/permissions.ts:268-273`
- **Enums de permisos**: `src/types/permissions.ts:117`
- **CSV correcto**: `wix-database/ROL_PERMISOS_ACTUALIZADO_V2.csv`

---

## ⚠️ Recomendación Final

**NO usar `/admin/permissions` para actualizaciones masivas o críticas.**

**USO RECOMENDADO**:
- ✅ Importar CSV a Wix (más seguro y rápido)
- ✅ Usar `/admin/permissions` solo para verificar permisos visualment e
- ✅ Usar API directa si necesitas cambiar 1 o 2 permisos

---

**Última actualización**: 2025-10-14
**Estado**: Documentado y resuelto para TALERO
