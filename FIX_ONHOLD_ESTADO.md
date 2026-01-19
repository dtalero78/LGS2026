# Fix: Actualizar campo `estado` en función OnHold

## Problema Identificado

La función `toggleUserStatus` (línea ~1301 en `search.jsw`) no está actualizando el campo `estado` de la colección PEOPLE cuando se activa/desactiva OnHold.

**Comportamiento actual:**
- ✅ Actualiza: `estadoInactivo`, `fechaOnHold`, `fechaFinOnHold`, `onHoldCount`, `onHoldHistory`
- ❌ NO actualiza: `estado`

**Comportamiento esperado:**
- Al activar OnHold: `estado = "On Hold"`
- Al desactivar OnHold: `estado = null` (o valor previo)

## Comparación con función correcta

La función `changeContractOnHoldStatus` (línea ~1562 y ~1636) **SÍ actualiza correctamente** el campo `estado`:

```javascript
// Al ACTIVAR OnHold (línea 1562)
titular.estado = "On Hold";

// Al DESACTIVAR OnHold (línea 1636)
titular.estado = null;
```

## Solución

Modificar la función `toggleUserStatus` para incluir la actualización del campo `estado`.

### Código a modificar

**Archivo**: `backend/search.jsw`
**Función**: `toggleUserStatus`
**Líneas**: ~1330-1363

### ANTES (código actual):

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
    console.log('Limpiando fechas OnHold');
}
```

### DESPUÉS (código corregido):

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
    updateData.estado = "On Hold";  // ← AGREGAR ESTA LÍNEA
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
    updateData.estado = null;  // ← AGREGAR ESTA LÍNEA
    console.log('Limpiando fechas OnHold');
}
```

## Cambios Específicos

Agregar **2 líneas**:

1. **Línea ~1334** (dentro del bloque `if (estadoNuevo && fechaOnHold)`):
   ```javascript
   updateData.estado = "On Hold";
   ```

2. **Línea ~1362** (dentro del bloque `else if (!estadoNuevo)`):
   ```javascript
   updateData.estado = null;
   ```

## Resultado Esperado

Después del fix, al activar OnHold:
```javascript
{
  estadoInactivo: true,
  estado: "On Hold",        // ← AHORA SE ACTUALIZA
  fechaOnHold: "2025-07-01",
  fechaFinOnHold: "2025-07-31",
  onHoldCount: 1,
  onHoldHistory: [...]
}
```

Al desactivar OnHold:
```javascript
{
  estadoInactivo: false,
  estado: null,             // ← AHORA SE LIMPIA
  fechaOnHold: null,
  fechaFinOnHold: null,
  // ... campos de extensión actualizados
}
```

## Pasos de Despliegue

1. Abrir Wix Editor → Velo backend
2. Editar archivo `backend/search.jsw`
3. Buscar función `toggleUserStatus` (línea ~1301)
4. Agregar `updateData.estado = "On Hold";` después de línea ~1333
5. Agregar `updateData.estado = null;` después de línea ~1361
6. Guardar cambios
7. Hacer clic en "Publish" en Wix

## Testing

1. Activar OnHold en un estudiante
2. Verificar en Wix Database que `estado = "On Hold"`
3. Desactivar OnHold
4. Verificar que `estado = null`
5. Verificar que UI del frontend muestra correctamente el estado

## Campos Afectados (después del fix)

Al **ACTIVAR** OnHold:
- `estadoInactivo: true`
- `estado: "On Hold"` ← **NUEVO**
- `fechaOnHold: "fecha"`
- `fechaFinOnHold: "fecha"`
- `onHoldCount: n+1`
- `onHoldHistory: [...]`

Al **DESACTIVAR** OnHold:
- `estadoInactivo: false`
- `estado: null` ← **NUEVO**
- `fechaOnHold: null`
- `fechaFinOnHold: null`
- `finalContrato: extendido`
- `vigencia: recalculado`
- `extensionCount: n+1`
- `extensionHistory: [...]`
