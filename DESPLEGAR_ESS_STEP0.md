# Guía de Despliegue: ESS Step 0 - Aprobación por Tiempo

## Resumen de Cambios

Se implementó lógica especial para el nivel **ESS (English Speaking Sessions)** que se aprueba automáticamente después de **5 semanas** desde la fecha de creación del estudiante en ACADEMICA, sin requerir clases ni asistencia.

### Problema Resuelto
- **Antes**: ESS Step 0 se evaluaba con la misma lógica que otros steps (requería clases, asistencia, clubs)
- **Después**: ESS Step 0 se aprueba automáticamente cuando han pasado 5 semanas desde `_createdDate` en ACADEMICA

### Lógica de Aprobación ESS

#### ESS Step 0 (Nivel especial)
- **Requisito único**: Han pasado 5 semanas (35 días) desde `_createdDate` del estudiante en ACADEMICA
- **NO requiere**: Clases, asistencia, clubs, ni ninguna otra actividad
- **Cálculo**: `fechaActual - _createdDate >= 35 días`
- **Prioridad**: Overrides manuales aún tienen prioridad máxima

#### Ejemplo de Comportamiento
```javascript
// Estudiante creado: 2025-01-01
// Fecha actual: 2025-02-06 (36 días después)
// Resultado: ESS Step 0 APROBADO ✅

// Estudiante creado: 2025-01-01
// Fecha actual: 2025-01-20 (19 días después)
// Resultado: ESS Step 0 NO APROBADO ❌ (faltan 16 días)
```

## Instrucciones de Despliegue

### 1. Abrir el Editor de Wix
1. Ir a https://www.lgsplataforma.com
2. Iniciar sesión con credenciales de administrador
3. Abrir el Editor de Wix
4. Ir a la sección de **Velo** (código backend)

### 2. Localizar el Archivo
- Archivo: `backend/search.jsw`
- Función: `cargarStepsDelNivel`
- Ubicación aproximada: **Líneas 2525-2560**

### 3. Realizar los Cambios

#### Cambio: Agregar lógica especial para ESS Step 0
**Línea ~2525-2551**

**ANTES:**
```javascript
// 5. Construir la información de cada step con cálculo automático
const steps = result.items.map(item => {
    const stepInfo = asistenciaMap.get(item.step);
    const hasOverride = overrides[item.step] !== undefined;

    // Detectar si es Jump step
    const stepNumber = parseInt(item.step.match(/\d+/)?.[0] || 0);
    const isJumpStep = JUMP_STEPS.includes(stepNumber);

    let completado = false;

    // Si hay override manual, usarlo (tiene prioridad)
    if (hasOverride) {
        completado = overrides[item.step];
        console.log(`🔍 Step ${item.step}: OVERRIDE MANUAL = ${completado}`);
    } else {
        // Calcular automáticamente según el tipo de step
        if (isJumpStep) {
            // Jump steps: deben tener al menos una clase registrada Y noAprobo debe ser false
            completado = stepInfo.hasClasses && !stepInfo.noAprobo;
            console.log(`🔍 Step ${item.step} (JUMP): hasClasses=${stepInfo.hasClasses}, noAprobo=${stepInfo.noAprobo}, completado=${completado}`);
        } else {
            // Steps normales: necesitan 2 sesiones + club
            completado = stepInfo.trueCount >= 2 && stepInfo.club;
            console.log(`🔍 Step ${item.step}: sesiones=${stepInfo.trueCount}/2, club=${stepInfo.club}, completado=${completado}`);
        }
    }

    return {
        _id: item._id,
        step: item.step,
        nivel: item.code,
        checkCompletado: completado
    };
});
```

**DESPUÉS:**
```javascript
// 5. Construir la información de cada step con cálculo automático
const steps = result.items.map(item => {
    const stepInfo = asistenciaMap.get(item.step);
    const hasOverride = overrides[item.step] !== undefined;

    // Detectar si es Jump step
    const stepNumber = parseInt(item.step.match(/\d+/)?.[0] || 0);
    const isJumpStep = JUMP_STEPS.includes(stepNumber);

    // Detectar si es ESS Step 0 (English Speaking Sessions - nivel especial)
    const isESSStep0 = nivel === 'ESS' && item.step === 'Step 0';

    let completado = false;

    // Si hay override manual, usarlo (tiene prioridad)
    if (hasOverride) {
        completado = overrides[item.step];
        console.log(`🔍 Step ${item.step}: OVERRIDE MANUAL = ${completado}`);
    } else if (isESSStep0) {
        // ESS Step 0: Se aprueba automáticamente después de 5 semanas desde _createdDate
        const fechaCreacion = student._createdDate;
        const fechaActual = new Date();
        const diasTranscurridos = Math.floor((fechaActual - fechaCreacion) / (1000 * 60 * 60 * 24));
        const DIAS_REQUERIDOS_ESS = 35; // 5 semanas

        completado = diasTranscurridos >= DIAS_REQUERIDOS_ESS;
        console.log(`🔍 Step ${item.step} (ESS): Fecha creación=${fechaCreacion.toISOString()}, días transcurridos=${diasTranscurridos}/${DIAS_REQUERIDOS_ESS}, completado=${completado}`);
    } else {
        // Calcular automáticamente según el tipo de step
        if (isJumpStep) {
            // Jump steps: deben tener al menos una clase registrada Y noAprobo debe ser false
            completado = stepInfo.hasClasses && !stepInfo.noAprobo;
            console.log(`🔍 Step ${item.step} (JUMP): hasClasses=${stepInfo.hasClasses}, noAprobo=${stepInfo.noAprobo}, completado=${completado}`);
        } else {
            // Steps normales: necesitan 2 sesiones + club
            completado = stepInfo.trueCount >= 2 && stepInfo.club;
            console.log(`🔍 Step ${item.step}: sesiones=${stepInfo.trueCount}/2, club=${stepInfo.club}, completado=${completado}`);
        }
    }

    return {
        _id: item._id,
        step: item.step,
        nivel: item.code,
        checkCompletado: completado
    };
});
```

### 4. Guardar y Publicar
1. **Guardar** los cambios en el editor
2. **Publicar** el sitio para aplicar los cambios
3. Esperar confirmación de publicación exitosa

## Verificación Post-Despliegue

### Caso de Prueba 1: ESS Step 0 - Aprobado (>5 semanas)
1. Ir a un estudiante con nivel ESS
2. Verificar que su `_createdDate` en ACADEMICA sea hace más de 35 días
3. Abrir la sección de Steps en el panel de administración
4. Verificar que ESS Step 0 muestre toggle ON ✅

**Logs esperados en consola Wix:**
```
🔍 Step Step 0 (ESS): Fecha creación=2024-12-01T00:00:00.000Z, días transcurridos=61/35, completado=true
```

### Caso de Prueba 2: ESS Step 0 - NO Aprobado (<5 semanas)
1. Ir a un estudiante con nivel ESS
2. Verificar que su `_createdDate` en ACADEMICA sea hace menos de 35 días
3. Abrir la sección de Steps
4. Verificar que ESS Step 0 muestre toggle OFF ❌

**Logs esperados:**
```
🔍 Step Step 0 (ESS): Fecha creación=2025-01-20T00:00:00.000Z, días transcurridos=12/35, completado=false
```

### Caso de Prueba 3: ESS Step 0 - Con Override Manual
1. Activar manualmente el toggle ON para ESS Step 0 de un estudiante reciente
2. Verificar que el toggle permanezca ON (override tiene prioridad)
3. Verificar que aparezca en la tabla `STEP_OVERRIDES`
4. Desactivar el override manual
5. Verificar que el toggle vuelva a su estado calculado por tiempo

**Logs esperados:**
```
🔍 Step Step 0: OVERRIDE MANUAL = true
```

### Caso de Prueba 4: Steps Normales - No Afectados
1. Verificar que otros niveles (BN1, BN2, P1, etc.) sigan funcionando normalmente
2. Confirmar que Jump Steps (5, 10, 15, 20, 25, 30, 35, 40, 45) no sean afectados
3. Confirmar que Steps normales sigan requiriendo 2 sesiones + 1 club

## Rollback (En caso de problemas)

Si después del despliegue hay problemas, puedes revertir los cambios:

1. Abrir el editor de Wix
2. Ir a `backend/search.jsw`
3. Usar el historial de versiones de Wix para restaurar la versión anterior
4. Publicar nuevamente

**Líneas a restaurar**: 2525-2551 (bloque completo del map de steps)

## Detalles Técnicos

### Campos Utilizados
- **`student._createdDate`**: Fecha de creación del registro en ACADEMICA (tipo Date)
- **`nivel`**: Campo "code" en la tabla NIVELES (ej: "ESS", "BN1", "P1")
- **`item.step`**: Nombre del step (ej: "Step 0", "Step 1", "Step 25")

### Constantes
```javascript
const DIAS_REQUERIDOS_ESS = 35; // 5 semanas = 35 días
```

### Cálculo de Días Transcurridos
```javascript
const diasTranscurridos = Math.floor((fechaActual - fechaCreacion) / (1000 * 60 * 60 * 24));
// Math.floor redondea hacia abajo para contar solo días completos
// División por (1000 * 60 * 60 * 24) convierte milisegundos a días
```

### Condición de Aprobación
```javascript
completado = diasTranscurridos >= DIAS_REQUERIDOS_ESS;
// >= permite aprobar exactamente en el día 35 (5 semanas completas)
```

## Prioridad de Reglas

El sistema evalúa las reglas en este orden:

1. **Override Manual** (prioridad máxima)
   - Si existe en `STEP_OVERRIDES`, usar ese valor directamente

2. **ESS Step 0** (regla especial por tiempo)
   - Si `nivel === 'ESS'` Y `step === 'Step 0'`, calcular por tiempo

3. **Jump Steps** (5, 10, 15, 20, 25, 30, 35, 40, 45)
   - Requieren: al menos 1 clase registrada Y `noAprobo = false`

4. **Steps Normales** (todos los demás)
   - Requieren: 2 sesiones exitosas + 1 TRAINING club exitoso

## Ejemplo de Flujo Completo

```
Usuario: Juan Pérez
Nivel: ESS
Step: Step 0
Fecha creación en ACADEMICA: 2025-01-01
Fecha actual: 2025-02-10

Cálculo:
- diasTranscurridos = (2025-02-10) - (2025-01-01) = 40 días
- DIAS_REQUERIDOS_ESS = 35 días
- completado = 40 >= 35 = true ✅

Resultado en UI:
- Toggle ESS Step 0: ON ✅
- Mensaje en logs: "🔍 Step Step 0 (ESS): Fecha creación=2025-01-01T00:00:00.000Z, días transcurridos=40/35, completado=true"
```

## Validaciones Importantes

### 1. Campo `_createdDate` Debe Existir
Si `student._createdDate` es `null` o `undefined`:
- El cálculo fallará
- Recomendación: Agregar validación defensiva si es necesario

```javascript
// Validación defensiva opcional (agregar si es necesario)
if (!fechaCreacion) {
    console.warn(`⚠️ ESS Step 0: No se encontró _createdDate para estudiante ${idAcademica}`);
    completado = false;
}
```

### 2. Zona Horaria
- Wix usa UTC por defecto
- El cálculo de días es independiente de zona horaria
- `Math.floor` garantiza que solo días completos cuenten

### 3. Cambios en NIVELES
Si se agregan más steps al nivel ESS:
- Solo "Step 0" se evaluará por tiempo
- Otros steps de ESS seguirán las reglas normales o de Jump Steps

## Soporte

Para dudas o issues relacionados con ESS Step 0:
1. Revisar logs en consola Wix (buscar "ESS")
2. Verificar que el nivel en NIVELES tenga `code = "ESS"`
3. Verificar que el step se llame exactamente "Step 0"
4. Confirmar que `_createdDate` existe en ACADEMICA para el estudiante
5. Verificar que no haya override manual activo en `STEP_OVERRIDES`

---

**Fecha de creación**: 2025-10-31
**Versión**: 1.0
**Autor**: Claude Code Assistant
**Nivel afectado**: ESS (English Speaking Sessions)
**Step afectado**: Step 0
