# 📤 Instrucciones para Publicar en Wix Studio

Este documento explica cómo publicar los archivos de backend actualizados en Wix Studio.

## 📁 Archivos que Debes Publicar

### 1. **search.jsw**
**Ubicación local**: `src/backend/FUNCIONES WIX/search.jsw`
**Ubicación en Wix**: `backend/search.jsw`

**Nuevas funciones agregadas** (líneas 4404-4642):
- ✅ `getUserRole(email)` - Obtiene el rol de un usuario
- ✅ `getUserPermissions(email)` - Obtiene permisos personalizados
- ✅ `updateUserRole(email, nuevoRol)` - Actualiza el rol de un usuario
- ✅ `updateUserPermissions(email, permisos)` - Actualiza permisos personalizados

### 2. **http-functions.js**
**Ubicación local**: `src/backend/FUNCIONES WIX/http-functions.js`
**Ubicación en Wix**: `backend/http-functions.js`

**Nuevos endpoints agregados** (líneas 3339-3646):
- ✅ `GET /user-role?email=xxx` - Endpoint HTTP para obtener rol
- ✅ `GET /user-permissions?email=xxx` - Endpoint HTTP para obtener permisos
- ✅ `POST /update-user-role` - Endpoint HTTP para actualizar rol
- ✅ `POST /update-user-permissions` - Endpoint HTTP para actualizar permisos

---

## 🚀 Paso a Paso para Publicar

### Paso 1: Abrir Wix Studio

1. Ve a [Wix Studio](https://www.wix.com/studio)
2. Inicia sesión con tu cuenta
3. Abre el proyecto de LGS Platform

### Paso 2: Navegar a Backend Code

1. En el menú lateral, haz clic en **"Code Files"** o **"Developer Tools"**
2. Busca la carpeta **"backend"**
3. Deberías ver los archivos:
   - `search.jsw`
   - `http-functions.js`

### Paso 3: Actualizar search.jsw

#### Opción A: Copiar y Pegar (Recomendado)

1. **Abre el archivo local**: `src/backend/FUNCIONES WIX/search.jsw`
2. **Copia TODO el contenido** del archivo (Ctrl+A, Ctrl+C)
3. **Abre** `backend/search.jsw` en Wix Studio
4. **Reemplaza TODO el contenido** con lo que copiaste (Ctrl+A, Ctrl+V)
5. **Guarda** el archivo (Ctrl+S)

#### Opción B: Solo Agregar las Funciones Nuevas

1. **Abre** `backend/search.jsw` en Wix Studio
2. **Ve al final del archivo** (última línea)
3. **Copia las líneas 4404-4642** del archivo local
4. **Pega** al final del archivo en Wix
5. **Guarda** el archivo (Ctrl+S)

**Código a agregar**:
```javascript
// ============================================================================
// FUNCIONES DE PERMISOS Y ROLES
// ============================================================================

export async function getUserRole(email) {
  // ... (todo el código)
}

export async function getUserPermissions(email) {
  // ... (todo el código)
}

export async function updateUserRole(email, nuevoRol) {
  // ... (todo el código)
}

export async function updateUserPermissions(email, permisos) {
  // ... (todo el código)
}
```

### Paso 4: Actualizar http-functions.js

#### Opción A: Copiar y Pegar (Recomendado)

1. **Abre el archivo local**: `src/backend/FUNCIONES WIX/http-functions.js`
2. **Copia TODO el contenido** del archivo
3. **Abre** `backend/http-functions.js` en Wix Studio
4. **Reemplaza TODO el contenido** con lo que copiaste
5. **Guarda** el archivo

#### Opción B: Solo Agregar los Endpoints Nuevos

1. **Abre** `backend/http-functions.js` en Wix Studio
2. **Ve al final del archivo** (después de `options_generateSessionActivities`)
3. **Copia las líneas 3339-3646** del archivo local
4. **Pega** al final del archivo en Wix
5. **Guarda** el archivo

**Código a agregar**:
```javascript
// ============================================================================
// ENDPOINTS DE PERMISOS Y ROLES
// ============================================================================

export async function get_userRole(request) {
  // ... (todo el código)
}

export function options_userRole(request) {
  // ... (todo el código)
}

export async function get_userPermissions(request) {
  // ... (todo el código)
}

export function options_userPermissions(request) {
  // ... (todo el código)
}

export async function post_updateUserRole(request) {
  // ... (todo el código)
}

export function options_updateUserRole(request) {
  // ... (todo el código)
}

export async function post_updateUserPermissions(request) {
  // ... (todo el código)
}

export function options_updateUserPermissions(request) {
  // ... (todo el código)
}
```

### Paso 5: Configurar Permisos de las Funciones

**IMPORTANTE**: Las funciones deben ser públicas para que el Admin Panel pueda llamarlas.

1. En Wix Studio, ve a **"Backend Code Settings"** o **"Code Settings"**
2. Busca cada función nueva:
   - `getUserRole`
   - `getUserPermissions`
   - `updateUserRole`
   - `updateUserPermissions`
3. Para cada una, marca **"Public"** o **"Web Module"**
4. Guarda los cambios

### Paso 6: Publicar el Sitio

1. Haz clic en el botón **"Publish"** en la esquina superior derecha
2. Confirma la publicación
3. Espera a que se complete (puede tardar 1-2 minutos)

---

## ✅ Verificar que Funciona

### Test 1: Verificar Endpoint de Rol

Abre esta URL en el navegador (reemplaza el email):
```
https://www.lgsplataforma.com/_functions/user-role?email=advisor@lgs.com
```

**Respuesta esperada**:
```json
{
  "success": true,
  "email": "advisor@lgs.com",
  "rol": "ADVISOR",
  "nombre": "Advisor de Prueba",
  "activo": true
}
```

**Si obtienes error 404**: Las funciones no están publicadas correctamente.
**Si obtienes error 500**: Verifica los logs de Wix.

### Test 2: Verificar Endpoint de Permisos

```
https://www.lgsplataforma.com/_functions/user-permissions?email=advisor@lgs.com
```

**Respuesta esperada**:
```json
{
  "success": true,
  "email": "advisor@lgs.com",
  "permisos": []
}
```

### Test 3: Desde el Admin Panel

1. Accede al Admin Panel: https://paneladministrativolgs-25e3k.ondigitalocean.app
2. Haz login con cualquier usuario
3. Abre la consola del navegador (F12)
4. Deberías ver logs de permisos cargándose

---

## 🐛 Troubleshooting

### Error: "Function not found"

**Causa**: La función no está exportada o no es pública.

**Solución**:
1. Verifica que la función tenga `export` al inicio
2. Ve a Backend Code Settings
3. Marca la función como "Public"
4. Publica de nuevo

### Error: "USUARIOS_ROLES is not defined"

**Causa**: La colección no existe en Wix.

**Solución**:
1. Ve a CMS (Content Manager)
2. Crea la colección `USUARIOS_ROLES`
3. Importa el CSV: `wix-database/USUARIOS_ROLES.csv`

### Error: "Cannot read property 'rol' of undefined"

**Causa**: El registro del usuario no existe.

**Solución**:
1. Ve a CMS → `USUARIOS_ROLES`
2. Verifica que el email del usuario exista
3. Agrega el usuario si no está

### Los cambios no se aplican

**Causa**: El sitio no se ha publicado.

**Solución**:
1. Asegúrate de hacer clic en **"Publish"**
2. Espera a que termine la publicación
3. Limpia la caché del navegador (Ctrl+Shift+Delete)
4. Prueba de nuevo

---

## 📊 Endpoints Disponibles Después de Publicar

### 1. GET /user-role
```
GET https://www.lgsplataforma.com/_functions/user-role?email=usuario@lgs.com
```

### 2. GET /user-permissions
```
GET https://www.lgsplataforma.com/_functions/user-permissions?email=usuario@lgs.com
```

### 3. POST /update-user-role
```
POST https://www.lgsplataforma.com/_functions/update-user-role
Content-Type: application/json

{
  "email": "usuario@lgs.com",
  "nuevoRol": "ADVISOR"
}
```

### 4. POST /update-user-permissions
```
POST https://www.lgsplataforma.com/_functions/update-user-permissions
Content-Type: application/json

{
  "email": "usuario@lgs.com",
  "permisos": ["PERSON.INFO.VER_DOCUMENTACION", "STUDENT.GLOBAL.ENVIAR_MENSAJE"]
}
```

---

## 📋 Checklist de Publicación

- [ ] Abrir Wix Studio
- [ ] Actualizar `backend/search.jsw`
- [ ] Actualizar `backend/http-functions.js`
- [ ] Configurar funciones como públicas
- [ ] Publicar el sitio
- [ ] Verificar endpoint `/user-role`
- [ ] Verificar endpoint `/user-permissions`
- [ ] Probar desde Admin Panel
- [ ] Verificar logs en consola del navegador

---

## 🎯 Próximos Pasos

Una vez publicado:
1. ✅ Crear colecciones en Wix (USUARIOS_ROLES, PERMISOS_PERSONALIZADOS)
2. ✅ Importar CSVs con datos iniciales
3. ✅ Actualizar Admin Panel para usar Wix (auth.ts)
4. ✅ Probar con diferentes usuarios
5. ✅ Documentar para el equipo

---

## 📞 Soporte

Si tienes problemas al publicar:
1. Revisa los logs de Wix Studio (pestaña Console)
2. Verifica que las colecciones existan en CMS
3. Asegúrate de que las funciones sean públicas
4. Limpia caché y prueba de nuevo

¿Necesitas ayuda? Revisa:
- [README_WIX_PERMISOS.md](./README_WIX_PERMISOS.md) - Documentación completa
- [ARQUITECTURA_PERMISOS.md](./ARQUITECTURA_PERMISOS.md) - Diagrama del sistema
- [Wix Velo Documentation](https://www.wix.com/velo/reference)
