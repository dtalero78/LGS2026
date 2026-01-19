# FIX: Campo incorrecto en BOOKING - asistio vs asistencia

## 🔴 PROBLEMA IDENTIFICADO

El código en `search.js` tiene un **error de nombre de campo** al actualizar BOOKING:

- **BOOKING usa**: `asistencia` (verificado en debug)
- **Código actualiza**: `asistio` (línea 4608 - INCORRECTO)

Esto causa que:
1. ❌ BOOKING nunca se actualiza con la asistencia real → queda `asistencia: undefined`
2. ❌ La verificación de step completado falla porque no encuentra datos de asistencia
3. ❌ La promoción automática no se ejecuta

## 📊 EVIDENCIA

Debug output del usuario:
```javascript
bookingSummary: Array(1)
  0: {
    nivel: "BN3"
    step: "Step 15"
    asistencia: undefined    // ← Campo correcto pero nunca actualizado
    noAprobo: false
  }
```

Código actual (INCORRECTO):
```javascript
// Línea 4605-4608 en search.js
if (data.asistencia !== undefined && data.asistencia !== null) {
    bookingUpdateData.asistio = data.asistencia;  // ← CAMPO EQUIVOCADO: "asistio"
    console.log(`✏️ [BOOKING] Actualizando asistio: ...`);
}
```

## ✅ SOLUCIÓN

Cambiar `asistio` por `asistencia` en la actualización de BOOKING.

### Archivo a modificar: `src/backend/FUNCIONES WIX/search.js`

**Líneas 4605-4616** - Cambiar de:

```javascript
// Actualizar solo asistio y noAprobo
if (data.asistencia !== undefined && data.asistencia !== null) {
    bookingUpdateData.asistio = data.asistencia;  // ← INCORRECTO
    console.log(`✏️ [BOOKING] Actualizando asistio: ${bookingRecord.asistio} → ${data.asistencia}`);
} else {
    console.log('⚠️ [BOOKING] data.asistencia es undefined/null, NO se actualiza asistio');
}

if (data.noAprobo !== undefined && data.noAprobo !== null) {
    bookingUpdateData.noAprobo = data.noAprobo;
    console.log(`✏️ [BOOKING] Actualizando noAprobo: ${bookingRecord.noAprobo} → ${data.noAprobo}`);
}
```

**A:**

```javascript
// Actualizar solo asistencia y noAprobo
if (data.asistencia !== undefined && data.asistencia !== null) {
    bookingUpdateData.asistencia = data.asistencia;  // ← CORRECTO
    console.log(`✏️ [BOOKING] Actualizando asistencia: ${bookingRecord.asistencia} → ${data.asistencia}`);
} else {
    console.log('⚠️ [BOOKING] data.asistencia es undefined/null, NO se actualiza asistencia');
}

if (data.noAprobo !== undefined && data.noAprobo !== null) {
    bookingUpdateData.noAprobo = data.noAprobo;
    console.log(`✏️ [BOOKING] Actualizando noAprobo: ${bookingRecord.noAprobo} → ${data.noAprobo}`);
}
```

### También actualizar línea 4595 (log antes del update):

**De:**
```javascript
'asistio ANTES': bookingRecord.asistio,
```

**A:**
```javascript
'asistencia ANTES': bookingRecord.asistencia,
```

### También actualizar línea 4622 (log después del update):

**De:**
```javascript
'asistio DESPUÉS': bookingUpdateData.asistio,
```

**A:**
```javascript
'asistencia DESPUÉS': bookingUpdateData.asistencia,
```

### También actualizar línea 4629 (log de error):

**De:**
```javascript
asistio: bookingUpdateData.asistio,
```

**A:**
```javascript
asistencia: bookingUpdateData.asistencia,
```

## 🚀 PASOS DE DESPLIEGUE

1. **Abrir Wix Editor** → Backend (Velo) → `search.jsw`

2. **Buscar función** `updateClassRecord` (línea ~4522)

3. **Reemplazar 4 ocurrencias** de `asistio` por `asistencia`:
   - Línea 4595: Log "ANTES"
   - Línea 4606: Actualización del campo
   - Línea 4608: Log de actualización
   - Línea 4610: Log de undefined
   - Línea 4622: Log "DESPUÉS"
   - Línea 4629: Log de error

4. **Guardar** y **Publicar** el sitio Wix

5. **Probar** con el estudiante de prueba:
   ```bash
   curl -X POST "https://www.lgsplataforma.com/_functions/updateClassRecord" \
     -H "Content-Type: application/json" \
     -d '{
       "idEstudiante": "beb67ba3-aa5b-4c38-b370-bb7d3a3c6d50",
       "idEvento": "3a3418e6-0536-4ec9-a1ca-5a9e59722330",
       "asistencia": true,
       "participacion": true,
       "noAprobo": false
     }'
   ```

6. **Verificar** con el debug:
   ```bash
   curl "https://www.lgsplataforma.com/_functions/debugStudentBooking?studentId=beb67ba3-aa5b-4c38-b370-bb7d3a3c6d50"
   ```

   Debes ver:
   - `asistencia: true` (no undefined)
   - `totalClasses: 1` (no 0)
   - Promoción automática ejecutada

## 📝 RESUMEN

- **Error**: Campo `asistio` no existe en BOOKING, el correcto es `asistencia`
- **Impacto**: Promoción automática no funciona porque no se guardan datos de asistencia
- **Fix**: Reemplazar todas las referencias de `asistio` por `asistencia` en updateClassRecord
- **Líneas afectadas**: 4595, 4606, 4608, 4610, 4622, 4629
