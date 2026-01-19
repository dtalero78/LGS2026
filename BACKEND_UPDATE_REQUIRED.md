# 🚨 Actualización Requerida en Backend Wix

## Problema Actual

El frontend está solicitando datos de **asistencias** pero el backend de Wix NO está retornando esta información.

**Evidencia en logs:**
```
✅ Conteo múltiple de asistencias recibido: 0 eventos
```

Todos los eventos muestran `0` asistencias porque el campo `asistenciasPorEvento` viene vacío desde Wix.

---

## Funciones de Wix que Necesitan Actualización

### 1. **`getMultipleEventsInscritosCount`**

**Ubicación:** Backend Wix Functions
**Endpoint:** `https://www.lgsplataforma.com/_functions/getMultipleEventsInscritosCount`

**Cambio Requerido:**

Además de retornar `inscritosPorEvento`, debe retornar también `asistenciasPorEvento`.

**Formato de respuesta actual:**
```javascript
{
  success: true,
  inscritosPorEvento: {
    "evento-id-1": 5,
    "evento-id-2": 10,
    // ...
  },
  totalEventos: 100,
  totalBookings: 523
}
```

**Formato de respuesta REQUERIDO:**
```javascript
{
  success: true,
  inscritosPorEvento: {
    "evento-id-1": 5,
    "evento-id-2": 10,
    // ...
  },
  asistenciasPorEvento: {  // ⬅️ NUEVO CAMPO
    "evento-id-1": 3,      // Usuarios con asistencia: true
    "evento-id-2": 7,      // Usuarios con asistencia: true
    // ...
  },
  totalEventos: 100,
  totalBookings: 523
}
```

**Lógica requerida:**
```javascript
// Para cada evento en la lista de IDs recibidos:
// 1. Contar todos los registros en BOOKING donde calendarioEvento === eventoId
// 2. Contar solo los registros donde asistencia === true
// 3. Retornar ambos conteos

const inscritosPorEvento = {}
const asistenciasPorEvento = {}

for (const eventoId of eventIds) {
  // Obtener todos los bookings del evento
  const bookings = await wixData.query("BOOKING")
    .eq("calendarioEvento", eventoId)
    .find()

  inscritosPorEvento[eventoId] = bookings.items.length

  // Contar solo los que asistieron
  asistenciasPorEvento[eventoId] = bookings.items.filter(
    b => b.asistencia === true
  ).length
}
```

---

### 2. **`getEventInscritosCount`**

**Ubicación:** Backend Wix Functions
**Endpoint:** `https://www.lgsplataforma.com/_functions/getEventInscritosCount`

**Cambio Requerido:**

Además de retornar `inscritos`, debe retornar también `asistieron`.

**Formato de respuesta actual:**
```javascript
{
  success: true,
  inscritos: 10
}
```

**Formato de respuesta REQUERIDO:**
```javascript
{
  success: true,
  inscritos: 10,
  asistieron: 7  // ⬅️ NUEVO CAMPO
}
```

**Lógica requerida:**
```javascript
const bookings = await wixData.query("BOOKING")
  .eq("calendarioEvento", eventoId)
  .find()

const inscritos = bookings.items.length
const asistieron = bookings.items.filter(b => b.asistencia === true).length

return {
  success: true,
  inscritos,
  asistieron
}
```

---

## Colección de Datos en Wix

**Colección:** `BOOKING`
**Campos relevantes:**
- `calendarioEvento` (string) - ID del evento del calendario
- `asistencia` (boolean) - true si el usuario asistió, false si no asistió

---

## Testing

Una vez implementados los cambios, verificar con estas URLs:

### Test 1: Batch de eventos
```bash
curl -X POST https://www.lgsplataforma.com/_functions/getMultipleEventsInscritosCount \
  -H "Content-Type: application/json" \
  -d '{
    "eventIds": ["evento-id-1", "evento-id-2"]
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "inscritosPorEvento": {
    "evento-id-1": 5,
    "evento-id-2": 10
  },
  "asistenciasPorEvento": {
    "evento-id-1": 3,
    "evento-id-2": 7
  }
}
```

### Test 2: Evento individual
```bash
curl -X POST https://www.lgsplataforma.com/_functions/getEventInscritosCount \
  -H "Content-Type: application/json" \
  -d '{
    "eventoId": "evento-id-1"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "inscritos": 5,
  "asistieron": 3
}
```

---

## Estado Actual del Frontend

✅ **Frontend está LISTO** - Todos los cambios están implementados y pushed al repositorio
❌ **Backend NO está retornando asistencias** - Por eso aparecen todos en 0

**Archivos modificados en Frontend:**
- `/src/app/api/wix-proxy/eventos-inscritos-batch/route.ts`
- `/src/app/api/wix-proxy/evento-inscritos/route.ts`
- `/src/app/api/wix-proxy/event-bookings/route.ts`
- `/src/app/dashboard/academic/agenda-sesiones/page.tsx`
- `/src/components/calendar/CalendarView.tsx`
- `/src/components/calendar/DailyAgenda.tsx`
- `/src/components/academic/EventDetailModal.tsx`

---

## Próximos Pasos

1. ✅ Frontend actualizado y pusheado (branch: `deployment-cleanup`)
2. ✅ **Backend Wix actualizado en el repositorio** (archivos en `src/backend/FUNCIONES WIX/`)
3. ⏳ **PUBLICAR los cambios en Wix Studio** (subir archivos modificados)
4. ⏳ Verificar que las funciones retornen los datos correctos
5. ⏳ Recargar el frontend y verificar que las asistencias se muestren correctamente

---

## ⚠️ IMPORTANTE: Publicar en Wix Studio

Los archivos han sido modificados en el repositorio Git, pero **DEBES PUBLICARLOS EN WIX STUDIO** para que funcionen:

1. Abre Wix Studio
2. Ve a la sección de Backend Code
3. Sube/actualiza estos archivos:
   - `backend/search.jsw`
   - `http-functions.js` (si modificaste `post_getMultipleEventsInscritosCount`)
4. Publica el sitio
5. Verifica que los endpoints retornen `asistenciasPorEvento` y `asistieron`

---

**Fecha de creación:** 2025-10-01
**Fecha de última actualización:** 2025-10-01
**Branch:** deployment-cleanup
**Commits relacionados:**
- `438ec35` - feat: add attendance tracking to event inscriptions
- `fb1939f` - fix: resolve function initialization error in loadMonthEvents
- `af01fca` - docs: add backend update requirements for attendance tracking
- `4029f12` - feat(wix): add attendance tracking to event count functions ⬅️ NUEVO
