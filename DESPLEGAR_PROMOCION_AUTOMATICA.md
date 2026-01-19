# Despliegue: Sistema de Promoción Automática (FIX: Ordenamiento de Steps)

## Problema Corregido

**Bug**: Al completar Step 5, el estudiante era promovido a Step 10 (siguiente Jump Step) en lugar de Step 6.

**Causa**: La query `.ascending('step')` en Wix ordena alfabéticamente:
```
Step 1
Step 10  ← ❌ Viene antes que Step 2 alfabéticamente
Step 2
Step 3
...
Step 5
Step 6
```

**Solución**: Ordenar manualmente por número de step en JavaScript después de traer los datos.

---

## Archivo a Modificar

### 📁 `backend/search.jsw` (Wix Editor)

**Función afectada**: `obtenerSiguienteStep()` (líneas 4795-4867)

---

## Pasos de Despliegue

### 1. Abrir Wix Editor

1. Ir a https://www.wix.com/my-account/site-selector
2. Seleccionar el sitio **LGS Plataforma**
3. Click en **Editar sitio**
4. Esperar a que cargue el editor

### 2. Abrir Backend Code

1. En el menú lateral izquierdo, click en el ícono **</>** (Velo)
2. En el panel **Backend**, buscar el archivo **search.jsw**
3. Click para abrirlo

### 3. Localizar la Función

Usar Ctrl+F (Cmd+F en Mac) y buscar:
```javascript
async function obtenerSiguienteStep(nivelActual, stepActual) {
```

Debería estar alrededor de la **línea 4795**.

### 4. Reemplazar la Función Completa

**Eliminar** desde:
```javascript
async function obtenerSiguienteStep(nivelActual, stepActual) {
```

Hasta el cierre de la función (antes de `async function obtenerSiguienteNivel`).

**Pegar** el siguiente código:

```javascript
async function obtenerSiguienteStep(nivelActual, stepActual) {
    try {
        const nivelesQuery = await wixData.query('NIVELES')
            .eq('code', nivelActual)
            .limit(1000)
            .find();

        if (nivelesQuery.items.length === 0) {
            return {
                success: false,
                message: 'No se encontraron steps para el nivel actual'
            };
        }

        // ✅ FIX: Ordenar manualmente por número de step (no alfabéticamente)
        const steps = nivelesQuery.items
            .map(item => ({
                ...item,
                numeroStep: parseInt(item.step.match(/\d+/)?.[0] || 0)
            }))
            .sort((a, b) => a.numeroStep - b.numeroStep);

        console.log('📊 [obtenerSiguienteStep] Steps ordenados:', steps.map(s => `${s.step} (${s.numeroStep})`).join(', '));

        const currentIndex = steps.findIndex(item => item.step === stepActual);

        if (currentIndex === -1) {
            return {
                success: false,
                message: 'Step actual no encontrado en NIVELES'
            };
        }

        console.log(`🔍 [obtenerSiguienteStep] Nivel: ${nivelActual}, Step actual: ${stepActual} (index ${currentIndex}/${steps.length - 1})`);

        if (currentIndex < steps.length - 1) {
            const siguienteStep = steps[currentIndex + 1];
            console.log(`✅ [obtenerSiguienteStep] Siguiente step en mismo nivel: ${siguienteStep.step}`);
            return {
                success: true,
                nuevoNivel: nivelActual,
                nuevoStep: siguienteStep.step,
                esParalelo: siguienteStep.esParalelo || false
            };
        } else {
            // Es el último step del nivel, buscar siguiente nivel
            console.log('🔄 [obtenerSiguienteStep] Es el último step del nivel, buscando siguiente nivel...');
            const siguienteNivel = await obtenerSiguienteNivel(nivelActual);

            if (siguienteNivel.success) {
                console.log(`✅ [obtenerSiguienteStep] Promoviendo a siguiente nivel: ${siguienteNivel.codigo} ${siguienteNivel.primerStep}`);
                return {
                    success: true,
                    nuevoNivel: siguienteNivel.codigo,
                    nuevoStep: siguienteNivel.primerStep,
                    esParalelo: siguienteNivel.esParalelo || false
                };
            } else {
                return {
                    success: false,
                    message: 'Completó el último step del nivel y no hay siguiente nivel'
                };
            }
        }

    } catch (error) {
        console.error('❌ Error obteniendo siguiente step:', error);
        return {
            success: false,
            message: error.message
        };
    }
}
```

### 5. Guardar y Publicar

1. Click en **Save** (esquina superior derecha)
2. Esperar mensaje de confirmación "Code saved"
3. Click en **Publish** (esquina superior derecha)
4. Esperar a que termine la publicación (~30-60 segundos)
5. Verificar mensaje "Your site is live"

---

## Verificación Post-Despliegue

### Test 1: Completar Step 5

1. Ir a `/student/[id]` de un estudiante en Step 5
2. Registrar una clase en Step 5 con:
   - ✅ Asistió
   - ✅ Participó
   - ✅ No reprobar (o dejar sin marcar)
3. Click en "Guardar Calificación y comentarios"
4. **Verificar**: Estudiante debe pasar a **Step 6** (NO Step 10)

### Test 2: Verificar Logs

Abrir la consola de Wix Live Preview y buscar:

```
📊 [obtenerSiguienteStep] Steps ordenados: Step 1 (1), Step 2 (2), Step 3 (3), Step 4 (4), Step 5 (5), Step 6 (6), ...
🔍 [obtenerSiguienteStep] Nivel: BN1, Step actual: Step 5 (index 4/X)
✅ [obtenerSiguienteStep] Siguiente step en mismo nivel: Step 6
🎓 [AUTO-PROMOCIÓN] Promoción exitosa: BN1 Step 5 → BN1 Step 6
```

### Test 3: Jump Step Normal

1. Completar Step 10 de un estudiante
2. **Verificar**: Debe pasar a Step 11 (NO Step 15)

---

## Cambios Técnicos

### Antes (❌ Incorrecto)
```javascript
const nivelesQuery = await wixData.query('NIVELES')
    .eq('code', nivelActual)
    .ascending('step')  // ❌ Ordenamiento alfabético
    .limit(1000)
    .find();

const steps = nivelesQuery.items;  // Step 1, Step 10, Step 2, ...
```

### Después (✅ Correcto)
```javascript
const nivelesQuery = await wixData.query('NIVELES')
    .eq('code', nivelActual)
    .limit(1000)
    .find();

// ✅ Ordenar manualmente por número
const steps = nivelesQuery.items
    .map(item => ({
        ...item,
        numeroStep: parseInt(item.step.match(/\d+/)?.[0] || 0)
    }))
    .sort((a, b) => a.numeroStep - b.numeroStep);
```

---

## Rollback (Si algo falla)

Si necesitas revertir los cambios:

1. Abrir Wix Editor → Backend → search.jsw
2. Buscar la función `obtenerSiguienteStep`
3. Restaurar versión anterior (con `.ascending('step')`)
4. Guardar y Publicar

**Nota**: El rollback restaurará el bug (Step 5 → Step 10).

---

## Notas Importantes

- ✅ No requiere cambios en frontend (Next.js)
- ✅ No requiere cambios en base de datos
- ✅ No requiere despliegue en Digital Ocean
- ✅ Cambio retrocompatible (no afecta estudiantes existentes)
- ⚠️ Este fix afecta TODOS los niveles (BN1, BN2, IN1, etc.)
- ⚠️ Aplicar en horario de bajo tráfico si es posible

---

## Contacto

Si tienes problemas durante el despliegue:
1. Revisar logs de Wix Editor
2. Verificar que la función se guardó correctamente
3. Verificar que se publicó exitosamente
4. Probar con un estudiante de prueba primero

**Última actualización**: 2025-11-07
