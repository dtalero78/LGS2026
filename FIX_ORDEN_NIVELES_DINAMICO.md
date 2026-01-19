# FIX: Orden de Niveles Dinámico desde Base de Datos

## 🔴 PROBLEMA IDENTIFICADO

La función `obtenerSiguienteNivel` tenía un array hardcodeado de niveles:

```javascript
const ordenNiveles = [
    'WELCOME',
    'BN1', 'BN2', 'BN3',
    'IN1', 'IN2', 'IN3',  // ← Estos niveles NO existen
    'IU1', 'IU2', 'IU3',
    'AU1', 'AU2', 'AU3'
];
```

**Problemas:**
1. ❌ Los niveles IN1, IN2, IN3, IU1, IU2, IU3, AU1, AU2, AU3 **NO existen** en la base de datos
2. ❌ Los niveles reales P1, P2, P3, F1, F2, F3 **NO estaban** en el array
3. ❌ Cualquier cambio en los niveles requería modificar el código manualmente
4. ❌ La promoción automática fallaba cuando completabas BN3 Step 15 porque buscaba IN1 (inexistente)

## ✅ SOLUCIÓN

Reemplazar el array hardcodeado con una **consulta dinámica** a la base de datos NIVELES:

### Lógica Nueva:
1. Consultar TODOS los registros de NIVELES
2. Agrupar por `code` (nivel)
3. Para cada nivel, encontrar el **primer step** (menor número)
4. Ordenar niveles por el número del primer step
5. Este orden determina la secuencia de promoción

### Resultado:
```
WELCOME (Step WELCOME/0) →
BN1 (Step 1) →
BN2 (Step 6) →
BN3 (Step 11) →
P1 (Step 16) →
P2 (Step 21) →
P3 (Step 26) →
F1 (Step 31) →
F2 (Step 36) →
F3 (Step 41) →
DONE (Step 50)
```

**ESS (Step 0)** se maneja como nivel paralelo y no está en la secuencia principal.

## 📝 CÓDIGO MODIFICADO

### Archivo: `src/backend/FUNCIONES WIX/search.js`

**Función modificada:** `obtenerSiguienteNivel` (línea ~4904)

**ANTES:**
```javascript
async function obtenerSiguienteNivel(nivelActual) {
    try {
        const ordenNiveles = [
            'WELCOME',
            'BN1', 'BN2', 'BN3',
            'IN1', 'IN2', 'IN3',
            'IU1', 'IU2', 'IU3',
            'AU1', 'AU2', 'AU3'
        ];

        const currentIndex = ordenNiveles.indexOf(nivelActual);
        // ...
    }
}
```

**DESPUÉS:**
```javascript
async function obtenerSiguienteNivel(nivelActual) {
    try {
        // ✅ DINÁMICO: Consultar todos los niveles de la base de datos
        console.log('🔍 [obtenerSiguienteNivel] Consultando niveles dinámicamente desde NIVELES...');

        const todosLosNiveles = await wixData.query('NIVELES')
            .limit(1000)
            .find();

        if (todosLosNiveles.items.length === 0) {
            return {
                success: false,
                message: 'No se encontraron niveles en la base de datos'
            };
        }

        // Agrupar por código de nivel y obtener el primer step de cada uno
        const nivelesConPrimerStep = {};
        todosLosNiveles.items.forEach(item => {
            const code = item.code;
            const numeroStep = parseInt(item.step.match(/\d+/)?.[0] || 0);

            if (!nivelesConPrimerStep[code] || numeroStep < nivelesConPrimerStep[code].numeroStep) {
                nivelesConPrimerStep[code] = {
                    code: code,
                    numeroStep: numeroStep,
                    step: item.step
                };
            }
        });

        // Ordenar niveles por el número del primer step (secuencia de aprendizaje)
        const ordenNiveles = Object.values(nivelesConPrimerStep)
            .sort((a, b) => a.numeroStep - b.numeroStep)
            .map(n => n.code);

        console.log('📊 [obtenerSiguienteNivel] Orden dinámico de niveles:', ordenNiveles.join(' → '));

        const currentIndex = ordenNiveles.indexOf(nivelActual);
        // ... resto del código igual
    }
}
```

## 🚀 DESPLIEGUE

### Opción A: Copiar archivo completo (RECOMENDADO)

1. Copiar todo el contenido de: [COPIAR_ESTE_ARCHIVO_A_WIX_search.jsw](COPIAR_ESTE_ARCHIVO_A_WIX_search.jsw)
2. Pegar en Wix Editor → Velo → Backend → `search.jsw`
3. Guardar (Ctrl+S)
4. Publicar el sitio

### Opción B: Reemplazo manual

1. Abrir Wix Editor → Velo → Backend → `search.jsw`
2. Buscar la función `obtenerSiguienteNivel` (línea ~4904)
3. Reemplazar desde `try {` hasta el cierre de la función con el código nuevo
4. Guardar y Publicar

## ✅ VERIFICACIÓN

Después de desplegar, ejecutar:

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

**Resultado esperado:**
```json
{
  "success": true,
  "stepCompletado": true
}
```

Luego verificar el nivel del estudiante:

```bash
curl -s "https://www.lgsplataforma.com/_functions/studentById?id=beb67ba3-aa5b-4c38-b370-bb7d3a3c6d50"
```

**Resultado esperado:**
```json
{
  "student": {
    "nivel": "P1",      // ← Promovido de BN3 a P1
    "step": "Step 16"   // ← Promovido de Step 15 a Step 16
  }
}
```

## 📊 LOGS ESPERADOS EN WIX

```
🔍 [obtenerSiguienteNivel] Consultando niveles dinámicamente desde NIVELES...
📊 [obtenerSiguienteNivel] Orden dinámico de niveles: WELCOME → BN1 → BN2 → BN3 → P1 → P2 → P3 → F1 → F2 → F3 → DONE
➡️ [obtenerSiguienteNivel] Siguiente nivel: P1
🎉 ¡Step Step 15 completado! Iniciando promoción automática...
➡️ Promoviendo a: P1 - Step 16
✅ Promoción automática exitosa: Step 15 → Step 16
```

## 🎯 BENEFICIOS

1. ✅ **Dinámico**: No requiere cambios de código cuando se agregan/modifican niveles
2. ✅ **Automático**: El orden se determina por el número del primer step de cada nivel
3. ✅ **Mantenible**: Agregar un nuevo nivel solo requiere crear registros en NIVELES
4. ✅ **Robusto**: Maneja niveles paralelos (ESS) correctamente
5. ✅ **Escalable**: Funciona con cualquier cantidad de niveles

## 📝 NOTAS

- Los niveles paralelos (como ESS con `esParalelo: true`) NO se incluyen en la secuencia principal
- El orden se basa en el **número del primer step**, no en el nombre del nivel
- Si dos niveles tienen el mismo primer step, se ordenan alfabéticamente por código
