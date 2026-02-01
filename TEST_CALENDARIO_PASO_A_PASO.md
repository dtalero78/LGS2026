# 🧪 TEST MANUAL: CALENDARIO Y EVENTOS

**Fecha**: 21 de enero de 2026
**Funcionalidad**: Agenda de Sesiones
**Tiempo estimado**: 15-20 minutos

---

## 📋 PREPARACIÓN

### 1. Abrir el navegador
```
URL: http://localhost:3001/login
```

### 2. Hacer login
- Usar credenciales de SUPER_ADMIN o ADMIN
- (Las credenciales están en tu archivo `.env` como `ADMIN_EMAIL` y `ADMIN_PASSWORD`)

### 3. Abrir DevTools
- Presionar `F12` (Windows/Linux) o `Cmd+Option+I` (Mac)
- Ir a tab **Network**
- En el filtro de búsqueda, escribir: `postgres`
- Esto mostrará solo las llamadas a endpoints PostgreSQL

### 4. Navegar al Calendario
```
Menú lateral → Académico → Agenda Sesiones
O directamente: http://localhost:3001/dashboard/academic/agenda-sesiones
```

---

## ✅ TEST 1: CARGAR CALENDARIO DEL MES ACTUAL

### Qué esperar:
- El calendario debe cargar automáticamente los eventos del mes actual
- Loading spinner mientras carga
- Eventos mostrados en formato de lista o calendario

### En DevTools - Network:
Buscar llamada a:
```
GET /api/postgres/events/filtered?desde=2026-01-01&hasta=2026-01-31
```

### Verificar:
- [ ] **Status**: 200 OK
- [ ] **Tiempo**: < 500ms
- [ ] **Response** (tab Preview):
  ```json
  {
    "success": true,
    "events": [...],
    "total": XX
  }
  ```

### En la UI:
- [ ] Se muestran eventos del mes
- [ ] Cada evento muestra: fecha, hora, nivel, advisor, inscritos
- [ ] No hay errores en consola (tab Console)

### ✅ RESULTADO:
- [ ] PASÓ
- [ ] FALLÓ - Anotar error: ___________________________

---

## ✅ TEST 2: FILTRAR POR ADVISOR

### Pasos:
1. En la página de calendario, buscar el filtro "Advisor"
2. Seleccionar un advisor específico del dropdown
3. Aplicar filtro

### En DevTools - Network:
Buscar llamada a:
```
GET /api/postgres/events/filtered?advisor=<advisor_id>&desde=...&hasta=...
```

### Verificar:
- [ ] **Status**: 200 OK
- [ ] **Response**: Solo eventos de ese advisor
- [ ] En UI: Lista filtrada correctamente

### ✅ RESULTADO:
- [ ] PASÓ
- [ ] FALLÓ - Anotar error: ___________________________

---

## ✅ TEST 3: CREAR NUEVO EVENTO

### Pasos:
1. Click en botón **"+ Crear Evento"**
2. Llenar formulario:
   - **Fecha**: Mañana (22 de enero 2026)
   - **Hora**: 10:00 AM
   - **Tipo**: SESSION
   - **Nivel**: BN1
   - **Advisor**: Seleccionar cualquiera
   - **Límite usuarios**: 10
   - **Nombre**: "Test Migración PostgreSQL"
   - **Observaciones**: "Evento de prueba"
   - **Link Zoom**: (opcional)
3. Click en **"Guardar"** o **"Crear"**

### En DevTools - Network:
Buscar llamada a:
```
POST /api/postgres/events
```

### Verificar Request (tab Payload):
```json
{
  "dia": "2026-01-22T10:00:00Z",
  "evento": "SESSION",
  "tituloONivel": "BN1",
  "advisor": "<advisor_id>",
  "limiteUsuarios": 10,
  "nombreEvento": "Test Migración PostgreSQL",
  "observaciones": "Evento de prueba"
}
```

### Verificar Response:
- [ ] **Status**: 201 Created
- [ ] **Response**:
  ```json
  {
    "success": true,
    "event": {
      "_id": "evt_...",
      ...
    }
  }
  ```

### En la UI:
- [ ] Aparece mensaje de éxito
- [ ] Evento aparece en la lista automáticamente
- [ ] Datos mostrados correctamente

### ✅ RESULTADO:
- [ ] PASÓ - Anotar ID del evento: ___________________________
- [ ] FALLÓ - Anotar error: ___________________________

---

## ✅ TEST 4: VER DETALLE DEL EVENTO

### Pasos:
1. Click en el evento recién creado ("Test Migración PostgreSQL")
2. Debe abrir modal o página de detalle

### En DevTools - Network:
Buscar llamada a:
```
GET /api/postgres/events/<event_id>
```

### Verificar Response:
- [ ] **Status**: 200 OK
- [ ] **Response**:
  ```json
  {
    "success": true,
    "event": {
      "_id": "...",
      "tituloONivel": "BN1",
      "nombreEvento": "Test Migración PostgreSQL",
      "advisor": { ... },  // ← Populated con datos del advisor
      "limiteUsuarios": 10,
      "inscritos": 0,
      "asistieron": 0
    }
  }
  ```

### En la UI:
- [ ] Todos los campos se muestran correctamente
- [ ] Nombre del advisor se muestra (no solo ID)
- [ ] Fecha formateada correctamente
- [ ] Botón "Ver Inscritos" visible

### ✅ RESULTADO:
- [ ] PASÓ
- [ ] FALLÓ - Anotar error: ___________________________

---

## ✅ TEST 5: VER LISTA DE INSCRITOS (VACÍA)

### Pasos:
1. Desde el detalle del evento, click en "Ver Inscritos" o tab "Estudiantes"
2. Debe mostrar lista vacía (evento nuevo, sin inscripciones)

### En DevTools - Network:
Buscar llamada a:
```
GET /api/postgres/events/<event_id>/bookings?includeStudent=true
```

### Verificar Response:
- [ ] **Status**: 200 OK
- [ ] **Response**:
  ```json
  {
    "success": true,
    "bookings": [],
    "total": 0
  }
  ```

### En la UI:
- [ ] Mensaje: "No hay usuarios inscritos en este evento" (o similar)
- [ ] No hay errores

### ✅ RESULTADO:
- [ ] PASÓ
- [ ] FALLÓ - Anotar error: ___________________________

---

## ✅ TEST 6: EDITAR EL EVENTO

### Pasos:
1. Desde el detalle del evento, click en "Editar" o ícono de lápiz
2. Cambiar:
   - **Límite usuarios**: 10 → 15
   - **Observaciones**: Agregar " - EDITADO"
3. Guardar cambios

### En DevTools - Network:
Buscar llamada a:
```
PUT /api/postgres/events/<event_id>
```

### Verificar Request (tab Payload):
```json
{
  "limiteUsuarios": 15,
  "observaciones": "Evento de prueba - EDITADO"
}
```

### Verificar Response:
- [ ] **Status**: 200 OK
- [ ] **Response**:
  ```json
  {
    "success": true,
    "event": {
      "_id": "...",
      "limiteUsuarios": 15,
      "observaciones": "Evento de prueba - EDITADO",
      "_updatedDate": "2026-01-21T..."
    }
  }
  ```

### En la UI:
- [ ] Mensaje de éxito
- [ ] Cambios reflejados inmediatamente
- [ ] Límite actualizado a 15

### ✅ RESULTADO:
- [ ] PASÓ
- [ ] FALLÓ - Anotar error: ___________________________

---

## ✅ TEST 7: EXPORTAR CSV DEL CALENDARIO

### Pasos:
1. En la página principal del calendario
2. Click en botón **"📥 Exportar CSV"**
3. Debe descargar archivo CSV

### En DevTools - Network:
Buscar llamada a:
```
GET /api/postgres/calendar/export-csv
```

### Verificar:
- [ ] **Status**: 200 OK
- [ ] **Content-Type**: text/csv
- [ ] Archivo descargado (nombre: calendar_YYYY-MM-DD.csv)

### Verificar archivo CSV:
1. Abrir con Excel o editor de texto
2. Verificar headers:
   ```
   Fecha,Hora,Tipo,Nivel,Nombre,Advisor,Límite,Inscritos,Link Zoom
   ```
3. Verificar datos:
   - [ ] Evento "Test Migración PostgreSQL" aparece
   - [ ] Datos correctos
   - [ ] Encoding UTF-8 (caracteres especiales visibles)

### ✅ RESULTADO:
- [ ] PASÓ
- [ ] FALLÓ - Anotar error: ___________________________

---

## ✅ TEST 8: ELIMINAR EL EVENTO DE PRUEBA

### Pasos:
1. Desde el detalle del evento (o desde lista)
2. Click en "Eliminar" o ícono de basura
3. Confirmar eliminación en diálogo

### En DevTools - Network:
Buscar llamada a:
```
DELETE /api/postgres/events/<event_id>
```

### Verificar Response:
- [ ] **Status**: 200 OK
- [ ] **Response**:
  ```json
  {
    "success": true,
    "message": "Event deleted successfully"
  }
  ```

### En la UI:
- [ ] Mensaje de éxito
- [ ] Evento removido de la lista automáticamente
- [ ] Caché invalidado (si recargas, sigue sin aparecer)

### ✅ RESULTADO:
- [ ] PASÓ
- [ ] FALLÓ - Anotar error: ___________________________

---

## ✅ TEST 9: VERIFICAR CACHÉ (OPCIONAL)

### Pasos:
1. Cargar calendario (debe hacer request a /events/filtered)
2. Cambiar de mes y volver (O refrescar página)
3. Verificar si usa caché

### En DevTools - Network:
- Primera carga: Request real a API
- Segunda carga (dentro de 5 min): Puede usar caché localStorage

### Verificar:
- [ ] Caché funciona (no request duplicado en <5min)
- [ ] Después de CRUD, caché se invalida (sí hace nuevo request)

### ✅ RESULTADO:
- [ ] PASÓ
- [ ] FALLÓ - Anotar error: ___________________________

---

## 📊 RESUMEN DE RESULTADOS

| Test | Estado | Tiempo | Notas |
|------|--------|--------|-------|
| 1. Cargar calendario | ⬜ | ___ ms | |
| 2. Filtrar por advisor | ⬜ | ___ ms | |
| 3. Crear evento | ⬜ | ___ ms | |
| 4. Ver detalle | ⬜ | ___ ms | |
| 5. Ver inscritos | ⬜ | ___ ms | |
| 6. Editar evento | ⬜ | ___ ms | |
| 7. Exportar CSV | ⬜ | ___ ms | |
| 8. Eliminar evento | ⬜ | ___ ms | |
| 9. Verificar caché | ⬜ | ___ ms | |

**Total Pasados**: ___/9
**Tasa de Éxito**: ___%

---

## 🐛 ISSUES ENCONTRADOS

### Issue #1
**Endpoint**: _______________________
**Error**: _______________________
**Reproducción**: _______________________
**Prioridad**: 🔴 Alta / 🟡 Media / 🟢 Baja

### Issue #2
**Endpoint**: _______________________
**Error**: _______________________
**Reproducción**: _______________________
**Prioridad**: 🔴 Alta / 🟡 Media / 🟢 Baja

---

## ✅ CONCLUSIÓN

Si **7/9 tests pasaron** (≥78%):
- ✅ **Funcionalidad crítica operativa**
- Proceder con siguiente fase de testing

Si **5-6 tests pasaron** (56-67%):
- ⚠️ **Issues moderados encontrados**
- Resolver antes de continuar

Si **<5 tests pasaron** (<56%):
- ❌ **Issues críticos**
- Investigar y resolver antes de continuar

---

**Testeado por**: ___________________
**Fecha**: ___________________
**Duración**: ___________________
