# FIX CRÍTICO: Campo "asistio" en verificarStepCompletado

## 🔴 PROBLEMA IDENTIFICADO

La función `verificarStepCompletado` estaba leyendo el campo **incorrecto** de BOOKING:

```javascript
// ❌ INCORRECTO (línea 4791):
const asistencia = booking.asistencia || asistenciaData?.asistencia || false;
```

### Por qué fallaba:
1. **BOOKING usa el campo**: `asistio` (no `asistencia`)
2. **updateClassRecord escribe en**: `asistio` ✅ (correcto)
3. **verificarStepCompletado leía de**: `asistencia` ❌ (incorrecto)
4. **Resultado**: Siempre evaluaba `asistencia = false`, incluso cuando había asistencia registrada

### Evidencia del bug:
```javascript
// Debug output mostraba:
asistencia: undefined  // ← Porque consultaba campo equivocado

// Pero el campo correcto es:
asistio: true/false
```

## ✅ SOLUCIÓN

Cambiar **UNA SOLA LÍNEA** en la función `verificarStepCompletado`:

### Archivo: `src/backend/FUNCIONES WIX/search.js`

**Línea 4791** - Cambiar de:

```javascript
const asistencia = booking.asistencia || asistenciaData?.asistencia || false;
```

**A:**

```javascript
const asistencia = booking.asistio || asistenciaData?.asistencia || false;
```

## 📊 IMPACTO DEL FIX

Este cambio corrige:

1. ✅ **Verificación de step completado**: Ahora lee correctamente el campo `asistio` de BOOKING
2. ✅ **Promoción automática**: Funciona para Jump Steps (Step 5, 10, 15, 20, etc.)
3. ✅ **Promoción automática**: Funciona para steps normales (requieren 2 sesiones + club)
4. ✅ **Sin efectos colaterales**: Solo cambia una variable de lectura, no afecta ninguna escritura

## 🚀 PASOS DE DESPLIEGUE EN WIX

### Opción A: Cambio quirúrgico (RECOMENDADO - más seguro)

1. **Abrir Wix Editor** → Velo → Backend → `search.jsw`
2. **Buscar** función `verificarStepCompletado` (línea ~4750)
3. **Encontrar** la línea:
   ```javascript
   const asistencia = booking.asistencia || asistenciaData?.asistencia || false;
   ```
4. **Reemplazar** por:
   ```javascript
   const asistencia = booking.asistio || asistenciaData?.asistencia || false;
   ```
5. **Guardar** (Ctrl+S)
6. **Publicar** el sitio

### Opción B: Copiar archivo completo

1. Copiar el archivo local: `/workspaces/let-s-go-speak2/src/backend/FUNCIONES WIX/search.js`
2. Pegar en Wix Editor → `search.jsw`
3. Guardar y Publicar

## ✅ VERIFICACIÓN DESPUÉS DE DESPLEGAR

### 1. Actualizar función de debug en Wix

Primero, actualizar la función `debugStudentBooking` para que consulte el campo correcto:

```javascript
// Cambiar línea 34:
asistio: b.asistio,  // ← Usar campo correcto

// Cambiar línea 43:
console.log(`... - Asistio: ${b.asistio} - ...`);
```

Copiar el archivo corregido: `/workspaces/let-s-go-speak2/DEBUG_BOOKING_QUERY.js`

### 2. Probar con curl

Registrar asistencia para el estudiante:

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

### 3. Verificar con debug

```bash
curl "https://www.lgsplataforma.com/_functions/debugStudentBooking?studentId=beb67ba3-aa5b-4c38-b370-bb7d3a3c6d50"
```

**Resultado esperado:**
```json
{
  "bookingSummary": [{
    "asistio": true,  // ← YA NO undefined
    "noAprobo": false
  }],
  "totalClasses": 1,  // ← Ya no 0
  "academicaData": {
    "nivel": "IN1",   // ← Promovido de BN3 a IN1
    "step": "Step 16"  // ← Promovido de Step 15 a Step 16
  }
}
```

### 4. Verificar logs de Wix

Buscar en los logs:
```
🎉 ¡Step Step 15 completado! Iniciando promoción automática...
➡️ Promoviendo a: IN1 - Step 16
✅ Promoción completada exitosamente
```

## 📝 RESUMEN TÉCNICO

### Campos en BOOKING:
- ✅ **asistio**: Campo correcto que se escribe y se debe leer
- ❌ **asistencia**: Campo inexistente que causaba el bug

### Funciones afectadas:
- ✅ **updateClassRecord**: Ya escribía correctamente en `asistio`
- ❌ **verificarStepCompletado**: Leía incorrectamente de `asistencia` → **CORREGIDO**
- ❌ **debugStudentBooking**: Consultaba incorrectamente `asistencia` → **CORREGIDO**

### Root cause:
Inconsistencia en los nombres de campo entre la escritura (correcta) y la lectura (incorrecta).

### Archivos corregidos:
1. `/workspaces/let-s-go-speak2/src/backend/FUNCIONES WIX/search.js` (línea 4791)
2. `/workspaces/let-s-go-speak2/DEBUG_BOOKING_QUERY.js` (líneas 34, 43)

## 🎯 SIGUIENTE PASO

Después de desplegar este fix, la promoción automática debería funcionar correctamente para:
- ✅ Jump Steps (5, 10, 15, 20, 25, 30, 35, 40, 45)
- ✅ Steps normales (requieren 2 sesiones + club)
