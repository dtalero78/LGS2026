# Despliegue: ESS como Nivel Paralelo y Opcional

**Fecha:** 31 de octubre de 2025
**Autor:** Claude Code
**Ticket:** ESS debe ser opcional/paralelo

---

## Resumen Ejecutivo

ESS (English Speaking Sessions) debe funcionar como un nivel **paralelo y opcional** que no bloquee el avance en los niveles principales (WELCOME → BN1 → BN2 → BN3 → etc.).

### Problema Actual
- ESS está tratado como un nivel obligatorio en la secuencia
- Los estudiantes no pueden avanzar a BN1 si están en ESS
- `updateStudentStep` busca el nivel automáticamente usando el step, lo que bloquea el avance

### Solución Propuesta
- **ESS será paralelo:** Los estudiantes pueden estar en BN1 Y ESS simultáneamente
- **ESS será opcional:** No es requisito para avanzar a otros niveles
- **ESS solo para tracking:** Se usa para seguimiento, no afecta promociones

---

## Cambios en Base de Datos (Wix)

### Estructura Actual en NIVELES
```javascript
{
  code: "ESS",          // Código del nivel
  step: "Step 0",       // Step del nivel
  description: "...",   // Descripción
  material: [...],      // Materiales
  clubs: [...]          // Clubs
}
```

### Nueva Estructura Requerida

**Agregar campo `esParalelo` en NIVELES:**

```javascript
{
  code: "ESS",
  step: "Step 0",
  description: "English Speaking Sessions (Opcional)",
  esParalelo: true,     // ← NUEVO CAMPO
  material: [...],
  clubs: [...]
}
```

**Agregar campo `nivelParalelo` en ACADEMICA:**

```javascript
{
  _id: "...",
  nivel: "BN1",           // Nivel principal
  step: "Step 1",         // Step principal
  nivelParalelo: "ESS",   // ← NUEVO CAMPO (opcional)
  stepParalelo: "Step 0", // ← NUEVO CAMPO (opcional)
  // ... otros campos
}
```

---

## Cambios en Backend (search.jsw)

### 1. Modificar `updateStudentStep`

**Ubicación:** `search.jsw:2097-2170`

**Cambio principal:** Detectar si el nuevo step pertenece a un nivel paralelo

```javascript
export async function updateStudentStep(stepData) {
  try {
    console.log('🎯 Actualizando step del estudiante:', stepData);

    const { numeroId, newStep } = stepData;
    const nuevoStep = `Step ${newStep}`;

    // 1. Buscar el nivel asociado al nuevoStep en NIVELES
    const nivelesResult = await wixData.query("NIVELES")
      .eq("step", nuevoStep)
      .limit(1000)
      .find();

    if (nivelesResult.items.length === 0) {
      return {
        success: false,
        error: `No se encontró un nivel asociado al step: ${nuevoStep}`
      };
    }

    const nivelData = nivelesResult.items[0];
    const nuevoNivel = nivelData.code;
    const esParalelo = nivelData.esParalelo || false; // ← NUEVO

    console.log(`Nuevo nivel: ${nuevoNivel}, esParalelo: ${esParalelo}`);

    // 2. Actualizar en ACADEMICA
    const academicaResult = await wixData.query("ACADEMICA")
      .eq("numeroId", numeroId)
      .limit(1000)
      .find();

    if (academicaResult.items.length === 0) {
      return {
        success: false,
        error: "No se encontró el estudiante en ACADEMICA"
      };
    }

    const academicaItem = academicaResult.items[0];
    const stepAnterior = academicaItem.step;
    const nivelAnterior = academicaItem.nivel;

    // ← NUEVA LÓGICA: Si es nivel paralelo, actualizar campos paralelos
    if (esParalelo) {
      academicaItem.nivelParalelo = nuevoNivel;
      academicaItem.stepParalelo = nuevoStep;
      console.log("✅ Actualizado nivel paralelo:", nuevoNivel, nuevoStep);
    } else {
      // Si NO es paralelo, actualizar campos principales
      academicaItem.step = nuevoStep;
      academicaItem.nivel = nuevoNivel;
      console.log("✅ Actualizado nivel principal:", nuevoNivel, nuevoStep);
    }

    await wixData.update("ACADEMICA", academicaItem);

    // 3. Actualizar en PEOPLE usando usuarioId
    const userId = academicaItem.usuarioId;
    if (userId) {
      const peopleResult = await wixData.query("PEOPLE")
        .eq("_id", userId)
        .limit(1000)
        .find();

      if (peopleResult.items.length > 0) {
        const peopleItem = peopleResult.items[0];

        // ← NUEVA LÓGICA: Actualizar campos paralelos en PEOPLE
        if (esParalelo) {
          peopleItem.nivelParalelo = nuevoNivel;
          peopleItem.stepParalelo = nuevoStep;
        } else {
          peopleItem.step = nuevoStep;
          peopleItem.nivel = nuevoNivel;
        }

        await wixData.update("PEOPLE", peopleItem);
        console.log("✅ Step y nivel actualizados en PEOPLE");
      }
    }

    return {
      success: true,
      message: esParalelo
        ? `Nivel paralelo ${nuevoNivel} actualizado exitosamente`
        : 'Step actualizado exitosamente',
      stepAnterior,
      nivelAnterior,
      nuevoStep,
      nuevoNivel,
      esParalelo,
      studentId: academicaItem._id
    };

  } catch (error) {
    console.error('❌ Error al actualizar step del estudiante:', error);
    return {
      success: false,
      error: 'Error al actualizar step del estudiante',
      details: error.message
    };
  }
}
```

### 2. Modificar `cargarStepsDelNivel`

**Ubicación:** `search.jsw:2327-2580`

**Cambio principal:** Cargar steps de niveles paralelos separadamente

```javascript
export async function cargarStepsDelNivel(nivel, idAcademica) {
  try {
    console.log('🔍 Cargando steps del nivel:', nivel, 'para estudiante:', idAcademica);

    // 1. Obtener información del estudiante
    const studentResult = await wixData.query("ACADEMICA")
      .eq("_id", idAcademica)
      .limit(1000)
      .find();

    if (studentResult.items.length === 0) {
      return {
        success: false,
        error: 'Estudiante no encontrado'
      };
    }

    const student = studentResult.items[0];

    // ← NUEVA LÓGICA: Determinar si es nivel paralelo
    const nivelData = await wixData.query("NIVELES")
      .eq("code", nivel)
      .limit(1)
      .find();

    const esParalelo = nivelData.items[0]?.esParalelo || false;

    // 2. Obtener todos los steps del nivel
    const result = await wixData.query("NIVELES")
      .eq("code", nivel)
      .ascending("step")
      .limit(1000)
      .find();

    if (result.items.length === 0) {
      return {
        success: false,
        error: `No se encontraron steps para el nivel ${nivel}`
      };
    }

    // ... (resto de la lógica permanece igual)

    return {
      success: true,
      steps: steps,
      nivel: nivel,
      esParalelo: esParalelo, // ← NUEVO
      totalSteps: steps.length
    };

  } catch (error) {
    console.error('❌ Error cargando steps del nivel:', error);
    return {
      success: false,
      error: 'Error cargando steps del nivel',
      details: error.message
    };
  }
}
```

### 3. Modificar `getStudentProgress`

**Ubicación:** `search.jsw:4896-5198`

**Cambio principal:** Mostrar diagnóstico del nivel principal, omitir ESS del diagnóstico

```javascript
export async function getStudentProgress(studentId) {
  try {
    // ... (lógica existente)

    const student = studentResult.items[0];
    const nivelPrincipal = student.nivel; // ← No usar nivel paralelo

    // ← NUEVA LÓGICA: Filtrar clases del nivel principal, EXCLUIR ESS
    const clasesNivelActual = classes.filter(c =>
      c.nivel === nivelPrincipal &&
      c.step !== 'WELCOME' &&
      c.nivel !== 'ESS' // ← NUEVO: Excluir ESS del diagnóstico
    );

    // ... (resto de la lógica permanece igual)

    return {
      success: true,
      data: {
        diagnosticoHTML,
        estadisticas: { /* ... */ },
        todasLasClases, // Incluye todas las clases (incluyendo ESS para tracking)
        estudiante: {
          nombre: `${student.primerNombre || ''} ${student.primerApellido || ''}`.trim(),
          nivel: nivelPrincipal, // ← Solo mostrar nivel principal
          step: student.step || 'Sin step'
        }
      }
    };

  } catch (error) {
    console.error('❌ Error generando diagnóstico académico:', error);
    return {
      success: false,
      error: 'Error generando diagnóstico académico',
      details: error.message
    };
  }
}
```

---

## Cambios en Frontend (Next.js)

### 1. Actualizar TypeScript Types

**Archivo:** `src/types/index.ts`

```typescript
export interface Student {
  _id: string
  numeroId: string
  primerNombre: string
  primerApellido: string
  nivel: string              // Nivel principal
  step: string               // Step principal
  nivelParalelo?: string     // ← NUEVO: Nivel paralelo (ej: ESS)
  stepParalelo?: string      // ← NUEVO: Step paralelo
  // ... otros campos
}
```

### 2. Modificar StudentAcademic Component

**Archivo:** `src/components/student/StudentAcademic.tsx`

**Cambio principal:** Mostrar nivel paralelo como badge adicional

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm font-medium">Nivel:</span>
  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
    {student.nivel}
  </span>

  {/* ← NUEVO: Mostrar nivel paralelo si existe */}
  {student.nivelParalelo && (
    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
      {student.nivelParalelo} (Paralelo)
    </span>
  )}
</div>
```

### 3. Modificar StudentChangeStep Component

**Archivo:** `src/components/student/StudentChangeStep.tsx`

**Cambio principal:** Permitir seleccionar niveles paralelos explícitamente

```tsx
// Agregar checkbox para indicar si es cambio a nivel paralelo
const [esParalelo, setEsParalelo] = useState(false);

// En el formulario:
<div className="mb-4">
  <label className="flex items-center">
    <input
      type="checkbox"
      checked={esParalelo}
      onChange={(e) => setEsParalelo(e.target.checked)}
      className="mr-2"
    />
    <span className="text-sm">Cambiar a nivel paralelo (ej: ESS)</span>
  </label>
</div>
```

---

## Pasos de Despliegue

### Fase 1: Actualizar Base de Datos Wix

1. **Abrir Wix Editor** → Backend/Database Collections
2. **Editar colección NIVELES:**
   - Agregar campo `esParalelo` (tipo: Boolean, default: false)
   - Marcar ESS con `esParalelo: true`
3. **Editar colección ACADEMICA:**
   - Agregar campo `nivelParalelo` (tipo: Text, opcional)
   - Agregar campo `stepParalelo` (tipo: Text, opcional)
4. **Editar colección PEOPLE:**
   - Agregar campo `nivelParalelo` (tipo: Text, opcional)
   - Agregar campo `stepParalelo` (tipo: Text, opcional)

### Fase 2: Actualizar Backend Wix (search.jsw)

1. Abrir archivo `backend/FUNCIONES WIX/search.jsw`
2. Reemplazar función `updateStudentStep` (líneas 2097-2170)
3. Reemplazar función `cargarStepsDelNivel` (líneas 2327-2580)
4. Reemplazar función `getStudentProgress` (líneas 4896-5198)
5. Guardar y publicar

### Fase 3: Actualizar Frontend Next.js

1. Actualizar `src/types/index.ts` (agregar campos paralelos)
2. Actualizar `src/components/student/StudentAcademic.tsx` (mostrar badge paralelo)
3. Actualizar `src/components/student/StudentChangeStep.tsx` (checkbox paralelo)
4. Commit y push a repositorio
5. Desplegar en Digital Ocean

---

## Testing

### Caso de Prueba 1: Estudiante en BN1 toma ESS
1. Estudiante está en BN1, Step 1
2. Se inscribe en sesión ESS
3. Cambiar a ESS Step 0 (marcar como paralelo)
4. **Verificar:** `nivel: BN1`, `nivelParalelo: ESS`
5. **Verificar:** Puede avanzar a BN1 Step 2 sin completar ESS

### Caso de Prueba 2: Diagnóstico "¿Cómo voy?"
1. Estudiante en BN2, Step 5 + ESS Step 0
2. Generar diagnóstico
3. **Verificar:** Solo muestra progreso de BN2
4. **Verificar:** ESS aparece en "Todas las clases" pero no en diagnóstico de steps

### Caso de Prueba 3: Cambio de Step Principal
1. Estudiante en BN1 + ESS
2. Cambiar de BN1 Step 1 → BN1 Step 2
3. **Verificar:** ESS no se ve afectado
4. **Verificar:** Ambos niveles se mantienen

---

## Rollback Plan

Si surgen problemas, seguir estos pasos:

1. **Revertir código de search.jsw:**
   - Usar versión previa de `updateStudentStep`, `cargarStepsDelNivel`, `getStudentProgress`
2. **Revertir frontend:**
   - `git revert <commit_hash>`
   - Redesplegar en Digital Ocean
3. **Base de datos NO requiere rollback:**
   - Los nuevos campos son opcionales y no rompen funcionalidad existente

---

## Notas Adicionales

- **ESS seguirá visible en el perfil del estudiante** para tracking
- **ESS seguirá generando asistencia y participación** en tabla CLASSES
- **ESS NO afectará los cálculos de promoción automática**
- **Los advisors pueden seguir creando sesiones de ESS** en el calendario

---

## Preguntas Frecuentes

**¿Qué pasa con los estudiantes actuales en ESS?**
- Se migran automáticamente: `nivelParalelo: ESS`, `nivel: [último nivel principal]`

**¿Pueden los estudiantes tener múltiples niveles paralelos?**
- No en esta versión. Solo 1 nivel paralelo a la vez.
- Expandir en futuro si se requiere.

**¿ESS seguirá teniendo Step 0 especial (5 semanas)?**
- Sí, la lógica de ESS Step 0 se mantiene igual en `cargarStepsDelNivel`

---

**Fin del documento**
