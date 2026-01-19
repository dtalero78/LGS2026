# Comparación Visual: Fix Campo `estado` en OnHold

## 📍 Ubicación del código

**Archivo**: `backend/search.jsw`
**Función**: `toggleUserStatus`
**Línea inicial**: ~1301

---

## 🔴 ANTES (Código actual - INCORRECTO)

```javascript
// 2. Preparar datos de actualización
const updateData = {
    ...usuario,
    estadoInactivo: estadoNuevo
};

// Si se activa OnHold, guardar las fechas y actualizar historial
if (estadoNuevo && fechaOnHold) {
    updateData.fechaOnHold = fechaOnHold;
    updateData.fechaFinOnHold = fechaFinOnHold;
    // ❌ FALTA: updateData.estado = "On Hold";
    console.log('Guardando fechas OnHold:', { fechaOnHold, fechaFinOnHold, motivo });

    // Crear entrada en el historial
    const nuevaEntradaOnHold = {
        fechaActivacion: new Date().toISOString(),
        fechaOnHold: fechaOnHold,
        fechaFinOnHold: fechaFinOnHold,
        motivo: motivo || 'Sin motivo especificado',
        activadoPor: 'Admin'
    };

    // Inicializar arrays si no existen
    if (!updateData.onHoldHistory) {
        updateData.onHoldHistory = [];
    }

    // Agregar nueva entrada al inicio del historial
    updateData.onHoldHistory = [nuevaEntradaOnHold, ...updateData.onHoldHistory];

    // Incrementar contador
    updateData.onHoldCount = (updateData.onHoldCount || 0) + 1;

    console.log('Historial OnHold actualizado:', updateData.onHoldHistory);
    console.log('Contador OnHold:', updateData.onHoldCount);
} else if (!estadoNuevo) {
    // Si se desactiva OnHold, limpiar las fechas
    updateData.fechaOnHold = null;
    updateData.fechaFinOnHold = null;
    // ❌ FALTA: updateData.estado = null;
    console.log('Limpiando fechas OnHold');
}
```

**Problema**: El campo `estado` **NO se actualiza** en ninguno de los dos casos.

---

## 🟢 DESPUÉS (Código corregido - CORRECTO)

```javascript
// 2. Preparar datos de actualización
const updateData = {
    ...usuario,
    estadoInactivo: estadoNuevo
};

// Si se activa OnHold, guardar las fechas y actualizar historial
if (estadoNuevo && fechaOnHold) {
    updateData.fechaOnHold = fechaOnHold;
    updateData.fechaFinOnHold = fechaFinOnHold;
    updateData.estado = "On Hold";  // ✅ AGREGADO
    console.log('Guardando fechas OnHold:', { fechaOnHold, fechaFinOnHold, motivo });

    // Crear entrada en el historial
    const nuevaEntradaOnHold = {
        fechaActivacion: new Date().toISOString(),
        fechaOnHold: fechaOnHold,
        fechaFinOnHold: fechaFinOnHold,
        motivo: motivo || 'Sin motivo especificado',
        activadoPor: 'Admin'
    };

    // Inicializar arrays si no existen
    if (!updateData.onHoldHistory) {
        updateData.onHoldHistory = [];
    }

    // Agregar nueva entrada al inicio del historial
    updateData.onHoldHistory = [nuevaEntradaOnHold, ...updateData.onHoldHistory];

    // Incrementar contador
    updateData.onHoldCount = (updateData.onHoldCount || 0) + 1;

    console.log('Historial OnHold actualizado:', updateData.onHoldHistory);
    console.log('Contador OnHold:', updateData.onHoldCount);
} else if (!estadoNuevo) {
    // Si se desactiva OnHold, limpiar las fechas
    updateData.fechaOnHold = null;
    updateData.fechaFinOnHold = null;
    updateData.estado = null;  // ✅ AGREGADO
    console.log('Limpiando fechas OnHold');
}
```

**Solución**: Se agregan **2 líneas** que actualizan el campo `estado` correctamente.

---

## 📊 Diff Side-by-Side

| Línea | ANTES | DESPUÉS |
|-------|-------|---------|
| ~1334 | `updateData.fechaOnHold = fechaOnHold;`<br>`updateData.fechaFinOnHold = fechaFinOnHold;`<br>⚠️ *campo estado faltante* | `updateData.fechaOnHold = fechaOnHold;`<br>`updateData.fechaFinOnHold = fechaFinOnHold;`<br>✅ `updateData.estado = "On Hold";` |
| ~1362 | `updateData.fechaOnHold = null;`<br>`updateData.fechaFinOnHold = null;`<br>⚠️ *campo estado faltante* | `updateData.fechaOnHold = null;`<br>`updateData.fechaFinOnHold = null;`<br>✅ `updateData.estado = null;` |

---

## 🎯 Cambios Exactos a Realizar

### Cambio 1: Al activar OnHold

**Ubicación**: Después de línea `updateData.fechaFinOnHold = fechaFinOnHold;` (~línea 1333)

**Agregar**:
```javascript
updateData.estado = "On Hold";
```

### Cambio 2: Al desactivar OnHold

**Ubicación**: Después de línea `updateData.fechaFinOnHold = null;` (~línea 1361)

**Agregar**:
```javascript
updateData.estado = null;
```

---

## ✅ Checklist de Implementación

- [ ] Abrir Wix Editor
- [ ] Ir a Velo → Backend Code
- [ ] Abrir archivo `backend/search.jsw`
- [ ] Buscar función `toggleUserStatus` (Ctrl+F)
- [ ] Buscar línea `updateData.fechaFinOnHold = fechaFinOnHold;`
- [ ] Agregar línea `updateData.estado = "On Hold";` después
- [ ] Buscar línea `updateData.fechaFinOnHold = null;`
- [ ] Agregar línea `updateData.estado = null;` después
- [ ] Guardar cambios (Ctrl+S)
- [ ] Hacer clic en botón "Publish"
- [ ] Esperar confirmación de publicación exitosa

---

## 🧪 Plan de Testing

### Test 1: Activar OnHold
1. Ir al panel de admin → Buscar estudiante
2. Hacer clic en botón "OnHold"
3. Ingresar fechas y motivo
4. Activar OnHold
5. ✅ Verificar en Wix Database: `estado = "On Hold"`

### Test 2: Desactivar OnHold
1. Con estudiante en OnHold
2. Hacer clic en botón "Reactivar"
3. Confirmar acción
4. ✅ Verificar en Wix Database: `estado = null`

### Test 3: Verificación en UI
1. Abrir ficha del estudiante
2. ✅ Verificar que el badge muestra "On Hold" cuando corresponde
3. ✅ Verificar que desaparece al reactivar

---

## 📦 Resultado Esperado

### Base de Datos (Colección PEOPLE)

**Antes del fix - Al activar OnHold:**
```json
{
  "estadoInactivo": true,
  "estado": "Vigente",           // ❌ NO CAMBIA
  "fechaOnHold": "2025-07-01",
  "fechaFinOnHold": "2025-07-31"
}
```

**Después del fix - Al activar OnHold:**
```json
{
  "estadoInactivo": true,
  "estado": "On Hold",           // ✅ ACTUALIZADO
  "fechaOnHold": "2025-07-01",
  "fechaFinOnHold": "2025-07-31"
}
```

**Después del fix - Al desactivar OnHold:**
```json
{
  "estadoInactivo": false,
  "estado": null,                // ✅ LIMPIADO
  "fechaOnHold": null,
  "fechaFinOnHold": null,
  "finalContrato": "2026-01-30", // Extendido automáticamente
  "extensionCount": 1
}
```

---

## 🔍 Referencias

- **Función de referencia correcta**: `changeContractOnHoldStatus` (línea ~1562, ~1636)
- **Documentación**: [CLAUDE.md](CLAUDE.md#onhold-system-with-automatic-contract-extension)
- **Guía de despliegue original**: [DESPLEGAR_ONHOLD_AUTO_EXTENSION.md](DESPLEGAR_ONHOLD_AUTO_EXTENSION.md)
