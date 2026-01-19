# Guía de Despliegue: Sistema Automático de Steps

## Resumen de Cambios

Se modificó la función `cargarStepsDelNivel` en Wix para calcular automáticamente el estado de completitud de los steps basándose en el progreso real del estudiante.

### Problema Resuelto
- **Antes**: Los toggles solo mostraban ON si había un override manual en `STEP_OVERRIDES`
- **Después**: Los toggles muestran ON automáticamente cuando el estudiante cumple los requisitos

### Lógica de Completitud

#### Steps Normales (1-4, 6-9, 11-14, etc.)
- **Requisitos**: 2 sesiones exitosas + 1 TRAINING club exitoso
- **Sesión exitosa**: `asistencia = true` O `participacion = true`
- **Club exitoso**: TRAINING club con `asistencia = true` O `participacion = true`

#### Jump Steps (5, 10, 15, 20, 25, 30, 35, 40, 45)
- **Requisitos**:
  1. Debe tener **al menos una clase registrada** para ese step
  2. NO debe estar marcado como `noAprobo = true`
- **IMPORTANTE**: Si no existen clases para un Jump Step, NO se marca como completado

#### Overrides Manuales
- Tienen **prioridad máxima** sobre el cálculo automático
- Se almacenan en la tabla `STEP_OVERRIDES`
- Persisten hasta que se eliminen manualmente

## Instrucciones de Despliegue

### 1. Abrir el Editor de Wix
1. Ir a https://www.lgsplataforma.com
2. Iniciar sesión con credenciales de administrador
3. Abrir el Editor de Wix
4. Ir a la sección de **Velo** (código backend)

### 2. Localizar el Archivo
- Archivo: `backend/search.jsw`
- Función: `cargarStepsDelNivel`
- Ubicación aproximada: **Líneas 2373-2574**

### 3. Realizar los Cambios

#### Cambio 1: Agregar campo `hasClasses` al mapa de asistencia
**Línea ~2471-2478**

**ANTES:**
```javascript
const asistenciaMap = new Map();
result.items.forEach(item => {
    asistenciaMap.set(item.step, {
        trueCount: 0,
        falseCount: 0,
        club: false,
        noAprobo: false
    });
});
```

**DESPUÉS:**
```javascript
const asistenciaMap = new Map();
result.items.forEach(item => {
    asistenciaMap.set(item.step, {
        trueCount: 0,
        falseCount: 0,
        club: false,
        noAprobo: false,
        hasClasses: false  // Rastrear si existen clases para este step
    });
});
```

#### Cambio 2: Marcar cuando un step tiene clases
**Línea ~2493-2522**

**ANTES:**
```javascript
if (asistenciaMap.has(stepBase)) {
    const stepInfo = asistenciaMap.get(stepBase);

    // Contar sesiones exitosas (SESSION y COMPLEMENTARIA)
    if (clase.tipoEvento !== 'CLUB') {
```

**DESPUÉS:**
```javascript
if (asistenciaMap.has(stepBase)) {
    const stepInfo = asistenciaMap.get(stepBase);

    // Marcar que este step tiene clases registradas
    stepInfo.hasClasses = true;

    // Contar sesiones exitosas (SESSION y COMPLEMENTARIA)
    if (clase.tipoEvento !== 'CLUB') {
```

#### Cambio 3: Corregir lógica de Jump Steps
**Línea ~2540-2550**

**ANTES:**
```javascript
} else {
    // Calcular automáticamente según el tipo de step
    if (isJumpStep) {
        // Jump steps: solo verificar que noAprobo sea false
        completado = !stepInfo.noAprobo;
        console.log(`🔍 Step ${item.step} (JUMP): noAprobo=${stepInfo.noAprobo}, completado=${completado}`);
    } else {
        // Steps normales: necesitan 2 sesiones + club
        completado = stepInfo.trueCount >= 2 && stepInfo.club;
        console.log(`🔍 Step ${item.step}: sesiones=${stepInfo.trueCount}/2, club=${stepInfo.club}, completado=${completado}`);
    }
}
```

**DESPUÉS:**
```javascript
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
```

### 4. Guardar y Publicar
1. **Guardar** los cambios en el editor
2. **Publicar** el sitio para aplicar los cambios
3. Esperar confirmación de publicación exitosa

## Verificación Post-Despliegue

### Caso de Prueba 1: Steps Normales
1. Ir a un estudiante con clases completadas
2. Verificar que steps con 2 sesiones + 1 club muestren toggle ON
3. Verificar que steps sin requisitos completos muestren toggle OFF

### Caso de Prueba 2: Jump Steps
1. Ir a un estudiante en un Jump Step (5, 10, 15, 20, 25, 30, 35, 40, 45)
2. Verificar que:
   - Si tiene clase registrada Y `noAprobo = false` → Toggle ON
   - Si NO tiene clase registrada → Toggle OFF
   - Si tiene clase con `noAprobo = true` → Toggle OFF

### Caso de Prueba 3: Overrides Manuales
1. Activar manualmente un toggle ON para un step sin requisitos
2. Verificar que el toggle permanezca ON (override tiene prioridad)
3. Desactivar el override manual
4. Verificar que el toggle vuelva a su estado calculado automáticamente

## Logs Esperados

### Jump Step con Clase (Completado)
```
🔍 Step 25 (JUMP): hasClasses=true, noAprobo=false, completado=true
```

### Jump Step sin Clase (NO Completado)
```
🔍 Step 25 (JUMP): hasClasses=false, noAprobo=false, completado=false
```

### Jump Step Reprobado (NO Completado)
```
🔍 Step 25 (JUMP): hasClasses=true, noAprobo=true, completado=false
```

### Step Normal Completado
```
🔍 Step 21: sesiones=2/2, club=true, completado=true
```

### Step Normal Incompleto
```
🔍 Step 22: sesiones=1/2, club=false, completado=false
```

## Rollback (En caso de problemas)

Si después del despliegue hay problemas, puedes revertir los cambios:

1. Abrir el editor de Wix
2. Ir a `backend/search.jsw`
3. Usar el historial de versiones de Wix para restaurar la versión anterior
4. Publicar nuevamente

## Soporte

Si encuentras problemas durante el despliegue:
1. Verificar los logs de consola en Wix
2. Revisar que los nombres de las tablas sean correctos (`BOOKING`, `CLASSES`, `STEP_OVERRIDES`)
3. Confirmar que los campos `asistencia`, `participacion`, `noAprobo` existan en las tablas

---

**Fecha de creación**: 2025-10-28
**Versión**: 2.0 (Corregido Jump Steps)
