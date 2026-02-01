# ⚠️ Problema de Conectividad a PostgreSQL

## 🔴 Error Actual

```
Error: connect ETIMEDOUT 138.197.34.129:25060
```

**Causa**: La base de datos PostgreSQL en Digital Ocean está bloqueando conexiones desde tu IP actual.

---

## ✅ Solución: Configurar Trusted Sources en Digital Ocean

### Opción 1: Agregar tu IP Actual (Recomendado para desarrollo)

1. **Ir al Dashboard de Digital Ocean**:
   - https://cloud.digitalocean.com/databases
   - Seleccionar tu cluster: `lgs-db`

2. **Ir a Settings → Trusted Sources**:
   - Click en "Edit"
   - Agregar tu IP actual

3. **Obtener tu IP pública**:
   ```bash
   curl -4 ifconfig.me
   ```
   O visitar: https://www.whatismyip.com/

4. **Agregar la IP en Digital Ocean**:
   - Click en "Add trusted source"
   - Pegar tu IP
   - Click en "Save"

5. **Reintentar conexión** (esperar 1-2 minutos):
   ```bash
   node test-postgres-connection.js
   ```

---

### Opción 2: Permitir TODAS las IPs (⚠️ Menos seguro - solo para testing)

Si quieres permitir acceso desde cualquier IP:

1. Ir a Settings → Trusted Sources
2. Agregar: `0.0.0.0/0` (todas las IPs)
3. ⚠️ **Advertencia**: Esto permite conexiones desde cualquier lugar. Solo recomendado para testing temporal.

---

### Opción 3: Solo permitir desde Digital Ocean App Platform

Si solo vas a acceder desde tu app deployada en Digital Ocean:

1. Ir a Settings → Trusted Sources
2. Seleccionar "Digital Ocean Resources"
3. Elegir tu App Platform app

Esto permite conexiones solo desde la app deployada (más seguro para producción).

---

## 🧪 Verificar Conexión

Una vez configurado, ejecutar:

```bash
# Test 1: Conexión directa con psql
psql "postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?sslmode=require" -c "SELECT NOW();"

# Test 2: Conexión desde Node.js
node test-postgres-connection.js

# Test 3: Contar registros
node test-postgres-connection.js
```

**Output esperado**:
```
✅ PostgreSQL client connected
✅ Query executed in 45ms (1 rows)
   Time: 2026-01-19T...
   Version: PostgreSQL 16.4...

✅ Found 12 tables:
   - ACADEMICA
   - ACADEMICA_BOOKINGS
   - CALENDARIO
   - ... etc

✅ Records per table:
   NIVELES: 48
   ROL_PERMISOS: 14
   USUARIOS_ROLES: 77
   PEOPLE: 6096
   ...
```

---

## 📝 Siguiente Paso

Una vez que la conexión funcione:

1. ✅ Verificar que `test-postgres-connection.js` pase todos los tests
2. ✅ Actualizar `src/app/api/auth/[...nextauth]/route.ts` para usar `auth-postgres.ts`
3. ✅ Crear endpoints de búsqueda en `src/app/api/postgres/`
4. ✅ Testing de login con PostgreSQL

---

## 🆘 Troubleshooting

### Si el error persiste después de agregar la IP:

1. **Verificar que la IP agregada es correcta**:
   ```bash
   curl -4 ifconfig.me
   # Comparar con la IP en Digital Ocean
   ```

2. **Esperar 1-2 minutos** después de agregar la IP (propagación)

3. **Verificar que el puerto 25060 no está bloqueado por tu firewall local**:
   ```bash
   nc -zv lgs-db-do-user-19197755-0.e.db.ondigitalocean.com 25060
   ```

4. **Probar con el connection string completo**:
   ```bash
   psql "postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?sslmode=require"
   ```

### Si estás en una red corporativa/universidad:

Es posible que tu firewall corporativo bloquee el puerto 25060. Opciones:

1. Usar una VPN
2. Usar tu conexión móvil (hotspot)
3. Trabajar desde casa/otra red

---

## 🔐 Seguridad

**Recomendaciones**:

- ✅ En desarrollo: Agregar solo tu IP actual
- ✅ En producción: Solo permitir acceso desde Digital Ocean App Platform
- ❌ NUNCA usar `0.0.0.0/0` en producción
- ✅ Rotar la contraseña de la DB periódicamente
- ✅ Usar variables de entorno (nunca hardcodear credenciales)

---

## 📊 Estado Actual

- ✅ Base de datos creada en Digital Ocean
- ✅ 109,271 registros migrados exitosamente
- ✅ Cliente PostgreSQL listo en `src/lib/postgres.ts`
- ⏳ **Pendiente**: Configurar acceso desde tu IP
- ⏳ **Pendiente**: Testing de conexión desde Next.js

**Siguiente acción**: Agregar tu IP en Digital Ocean Trusted Sources
