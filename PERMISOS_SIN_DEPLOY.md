# Guía: Modificar Permisos SIN Hacer Deploy

## El Problema que Resolvimos

**ANTES:**
```
1. Modificar permisos en /admin/permissions
2. Se guarda en archivo local
3. git add + git commit + git push
4. Digital Ocean redeploya (2-5 minutos)
5. ❌ Proceso lento y tedioso
```

**AHORA:**
```
1. Modificar permisos en /admin/permissions
2. Click "Guardar"
3. ✅ Se guarda en Wix
4. ✅ Cache se invalida
5. ✅ Cambios aplicados en 1 segundo
```

---

## Cómo Funciona

### **Arquitectura:**

```
┌──────────────────────────────────────────────────────────┐
│ 1. Usuario modifica permisos en /admin/permissions      │
│    - Marca/desmarca checkboxes                          │
│    - Click "Guardar Cambios"                            │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│ 2. POST /api/permissions/update                          │
│    - Envía: { role: "ADVISOR", permissions: [...] }     │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│ 3. POST /api/wix-proxy/role-permissions                  │
│    - Llama a Wix: POST /updateRolePermissions            │
│    - Body: { rol: "ADVISOR", permisos: [...] }          │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│ 4. WIX actualiza tabla ROL_PERMISOS                      │
│    UPDATE ROL_PERMISOS                                   │
│    SET permisos = [...]                                  │
│    WHERE rol = "ADVISOR"                                 │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│ 5. Next.js INVALIDA CACHE                                │
│    invalidatePermissionsCache("ADVISOR")                 │
│    - Borra permisos del cache en memoria                 │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│ 6. ✅ PRÓXIMO REQUEST USA DATOS FRESCOS                  │
│    - getPermissionsByRole("ADVISOR")                     │
│    - Cache vacío → Consulta Wix                          │
│    - Retorna permisos actualizados                       │
└──────────────────────────────────────────────────────────┘
```

---

## Setup Inicial (Solo Una Vez)

### **Paso 1: Crear Tabla en Wix**

1. Abre Wix Studio
2. Ve a CMS → Colecciones
3. Crea nueva colección llamada **`ROL_PERMISOS`**
4. Configuración:
   - Title: `ROL_PERMISOS`
   - Permissions: **Public** (solo lectura)
   - Campos:
     - `rol` (Text) - Required, Unique
     - `permisos` (Array) - Required
     - `activo` (Boolean) - Required
     - `descripcion` (Text)
     - `fechaCreacion` (Date)
     - `fechaActualizacion` (Date)

### **Paso 2: Importar Datos Iniciales**

1. En Wix CMS, abre la colección `ROL_PERMISOS`
2. Click "Import" → "From CSV"
3. Selecciona el archivo: **`wix-database/ROL_PERMISOS.csv`**
4. Map columns correctamente
5. Import

### **Paso 3: Publicar Endpoints en Wix**

1. Abre Wix Code en Wix Studio
2. En backend, abre **`http-functions.js`**
3. Copia las funciones desde:
   - `/src/backend/FUNCIONES WIX/http-functions.js` líneas 3648-3810
   - Funciones: `get_rolePermissions`, `post_updateRolePermissions`, y sus OPTIONS
4. Click **"Publish"** en Wix Studio
5. Verifica que los endpoints estén activos:
   - `https://www.lgsplataforma.com/_functions/rolePermissions?rol=ADVISOR`
   - `https://www.lgsplataforma.com/_functions/updateRolePermissions`

### **Paso 4: Deploy en Digital Ocean**

```bash
git add .
git commit -m "feat: permisos dinámicos desde Wix sin deploy"
git push origin deployment-cleanup
```

Digital Ocean deploy automático (última vez que necesitas hacerlo para permisos).

---

## Uso Diario: Modificar Permisos

### **Proceso Completo:**

1. **Login como SUPER_ADMIN**
   - Ve a https://paneladministrativolgs-25e3k.ondigitalocean.app/login
   - Email: `superadmin@lgs.com`
   - Password: `Test123!`

2. **Ir a Permisos**
   - Click en "Permisos" en el menú lateral

3. **Seleccionar Rol**
   - Dropdown: Selecciona rol (ej: `ADVISOR`)
   - Se cargan los permisos actuales desde Wix

4. **Modificar Permisos**
   - Marca/desmarca checkboxes según necesites
   - Ejemplo: Agregar `COMERCIAL.CONTRATO.MODIFICAR` a ADVISOR

5. **Guardar**
   - Click "Guardar Cambios"
   - Espera mensaje: "Permisos de ADVISOR actualizados correctamente"
   - ✅ **LISTO - Sin deploy**

6. **Verificar**
   - Logout y login como `advisor@lgs.com`
   - Los nuevos permisos están activos inmediatamente

---

## Sistema de Cache (5 Minutos)

### **¿Por qué hay cache?**

Para evitar consultar Wix en cada request (miles por día), cacheamos permisos en memoria por 5 minutos.

### **Flujo del Cache:**

```
Request 1 (12:00:00):
- Cache vacío
- Consulta Wix → Obtiene permisos
- Guarda en cache con timestamp
- Retorna permisos

Request 2 (12:02:30):
- Cache existe y es fresco (2.5 min de antigüedad)
- Retorna desde cache (rápido)
- NO consulta Wix

Request 3 (12:06:00):
- Cache existe pero expiró (6 min de antigüedad)
- Consulta Wix → Obtiene permisos actualizados
- Actualiza cache
- Retorna permisos

Modificación de permisos:
- POST /api/permissions/update
- Actualiza Wix
- ❗ INVALIDA CACHE inmediatamente
- Próximo request consulta Wix con datos frescos
```

### **Invalidación Manual del Cache (Opcional):**

Si modificas permisos directamente en Wix (no desde /admin/permissions), invalida el cache:

```bash
curl -X POST https://paneladministrativolgs-25e3k.ondigitalocean.app/api/admin/invalidate-permissions-cache \
  -H "Content-Type: application/json" \
  -d '{"role": "ADVISOR"}'
```

O invalida TODO:

```bash
curl -X POST https://paneladministrativolgs-25e3k.ondigitalocean.app/api/admin/invalidate-permissions-cache \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Fallback Automático

### **Si Wix está caído:**

```typescript
try {
  // Intentar consultar Wix
  const permisos = await fetch('/api/wix-proxy/role-permissions?rol=ADVISOR');
} catch (error) {
  // Wix no responde
  console.warn('⚠️ Usando permisos FALLBACK para ADVISOR');
  // Retorna permisos hardcodeados en src/config/roles.ts
  return FALLBACK_PERMISSIONS_MAP['ADVISOR'];
}
```

**Ventajas del Fallback:**
- ✅ Sistema funciona incluso si Wix cae
- ✅ Usa permisos base definidos en código
- ✅ No bloquea la aplicación

**Desventajas del Fallback:**
- ❌ No refleja cambios recientes hechos en Wix
- ❌ Usa permisos "de emergencia"

---

## Troubleshooting

### **Problema: Cambios no se aplican**

**Síntomas:**
- Modificas permisos en /admin/permissions
- Click "Guardar" → Mensaje de éxito
- Pero el usuario sigue sin ver/con los permisos

**Soluciones:**

1. **Verificar que guardó en Wix:**
   - Ve a Wix Studio → CMS → ROL_PERMISOS
   - Busca el rol modificado
   - Verifica campo `permisos` tiene los cambios
   - Verifica `fechaActualizacion` es reciente

2. **Invalidar cache manualmente:**
   ```bash
   curl -X POST http://localhost:3001/api/admin/invalidate-permissions-cache \
     -H "Content-Type: application/json" \
     -d '{"role": "ADVISOR"}'
   ```

3. **Usuario debe hacer logout/login:**
   - Los permisos se cargan al hacer login
   - El JWT contiene el rol, pero los permisos se consultan en cada request
   - Cierra sesión y vuelve a entrar

4. **Verificar logs del servidor:**
   ```
   ✅ Permisos de ADVISOR desde Wix (16 permisos)
   ```
   vs
   ```
   ❌ Error cargando permisos de ADVISOR desde Wix
   ⚠️ Usando permisos FALLBACK para ADVISOR
   ```

---

### **Problema: "Error al actualizar permisos en Wix"**

**Causa:** Endpoints de Wix no publicados o tabla no existe

**Solución:**

1. Verificar tabla existe:
   - Wix Studio → CMS → ROL_PERMISOS debe existir

2. Verificar endpoints publicados:
   - Wix Studio → Code → Backend → http-functions.js
   - Busca: `export async function get_rolePermissions`
   - Busca: `export async function post_updateRolePermissions`
   - Si no existen, copia desde `/src/backend/FUNCIONES WIX/http-functions.js`

3. Publicar sitio Wix:
   - Click "Publish" en Wix Studio
   - Espera que termine la publicación

4. Probar endpoint manualmente:
   ```bash
   curl "https://www.lgsplataforma.com/_functions/rolePermissions?rol=ADVISOR"
   ```

---

### **Problema: Permisos se resetean después de deploy**

**Causa:** Esto NO debería pasar con el nuevo sistema

**Antes (sistema viejo):**
- Permisos en archivo → Deploy borra cambios

**Ahora (sistema nuevo):**
- Permisos en Wix → Deploy NO afecta Wix
- ✅ Permisos persisten

**Si se resetean:**
- Verifica que realmente se guardaron en Wix (ver Paso 1 arriba)
- Verifica que el código usa `getPermissionsByRole()` (async) y NO `getPermissionsByRoleSync()`

---

## Comparación: Antes vs Ahora

| Aspecto | ANTES (Archivos) | AHORA (Wix) |
|---------|------------------|-------------|
| **Modificar permisos** | Editar código TypeScript | UI /admin/permissions |
| **Guardar cambios** | git commit + push | Click "Guardar" |
| **Deploy necesario** | ✅ Sí (2-5 min) | ❌ No |
| **Tiempo total** | 5-10 minutos | 1 segundo |
| **Conocimiento técnico** | TypeScript + Git | Solo UI |
| **Cambios persisten** | Sí (versionado en Git) | Sí (tabla Wix) |
| **Rollback** | `git revert` | Modificar en Wix otra vez |
| **Historial** | Git commits | Campo `fechaActualizacion` |
| **Fallback si falla** | N/A | Permisos hardcoded |

---

## Archivos Importantes

### **Backend Wix:**
- `/src/backend/FUNCIONES WIX/http-functions.js` (líneas 3648-3810)
  - `get_rolePermissions` - Consulta permisos de un rol
  - `post_updateRolePermissions` - Actualiza permisos de un rol

### **Next.js API Routes:**
- `/src/app/api/wix-proxy/role-permissions/route.ts` - Proxy a Wix
- `/src/app/api/permissions/update/route.ts` - Guardar permisos (actualizado)
- `/src/app/api/admin/invalidate-permissions-cache/route.ts` - Invalidar cache

### **Configuración:**
- `/src/config/roles.ts` - Permisos con cache y fallback
  - `getPermissionsByRole()` - Consulta Wix con cache
  - `invalidatePermissionsCache()` - Invalida cache

### **Datos:**
- `/wix-database/ROL_PERMISOS.csv` - Datos iniciales para importar

### **Documentación:**
- `/PERMISOS_SIN_DEPLOY.md` - Este archivo
- `/FLUJO_AUTENTICACION_COMPLETO.md` - Flujo de autenticación
- `/wix-database/README_WIX_PERMISOS.md` - Setup de Wix
- `/wix-database/INSTRUCCIONES_PUBLICAR_WIX.md` - Publicar en Wix

---

## FAQ

**Q: ¿Los permisos se pierden si redeploy en Digital Ocean?**
A: No, los permisos están en Wix, no en el código.

**Q: ¿Puedo modificar permisos directamente en Wix CMS?**
A: Sí, pero debes invalidar el cache manualmente después.

**Q: ¿Qué pasa si modifico el archivo `src/config/roles.ts`?**
A: Los permisos hardcodeados son solo fallback. Wix tiene prioridad.

**Q: ¿Puedo volver al sistema antiguo (permisos en archivos)?**
A: Sí, usa `getPermissionsByRoleSync()` en lugar de `getPermissionsByRole()`.

**Q: ¿Cuánto tarda en aplicarse un cambio de permisos?**
A: 1 segundo (tiempo de guardar en Wix + invalidar cache).

**Q: ¿Necesito hacer logout/login después de cambiar permisos?**
A: No, los permisos se consultan en cada request (con cache de 5 min).

**Q: ¿Puedo ver el historial de cambios de permisos?**
A: El campo `fechaActualizacion` muestra cuándo se modificó por última vez.

**Q: ¿Qué roles pueden modificar permisos?**
A: Solo SUPER_ADMIN (y legacy 'admin').

---

## Logs de Verificación

### **Al guardar permisos:**

```
🔐 POST /api/permissions/update - Starting...
👤 User role: SUPER_ADMIN
🔄 Actualizando permisos de ADVISOR en Wix (16 permisos)
🗑️ Cache invalidado para ADVISOR
✅ Permisos actualizados exitosamente en Wix

════════════════════════════════════════════════════════════
✅  PERMISOS ACTUALIZADOS SIN DEPLOY
════════════════════════════════════════════════════════════

Rol: ADVISOR
Permisos: 16
Guardado en: Wix tabla ROL_PERMISOS
Cache: Invalidado - Próximo request carga datos frescos

✅ NO necesitas hacer deploy ni commit
✅ Los cambios se aplican INMEDIATAMENTE

════════════════════════════════════════════════════════════
```

### **Al consultar permisos (primera vez):**

```
🔍 [API] Consultando permisos para rol: ADVISOR
✅ [API] Permisos encontrados para ADVISOR: 16 permisos
✅ Permisos de ADVISOR desde Wix (16 permisos)
```

### **Al consultar permisos (desde cache):**

```
✅ Permisos de ADVISOR desde cache (23s de antigüedad)
```

### **Si Wix falla:**

```
❌ Error cargando permisos de ADVISOR desde Wix: fetch failed
⚠️ Usando permisos FALLBACK para ADVISOR
```

---

**Fecha de creación:** 2025-10-12
**Última actualización:** 2025-10-12
**Branch:** deployment-cleanup
**Versión:** 2.0 (Permisos dinámicos con Wix)
