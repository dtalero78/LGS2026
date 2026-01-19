# 📅 Cómo Funciona la Extensión de Vigencia

## 🎯 Propósito

La **Extensión de Vigencia** permite al administrador **extender manualmente** la fecha final del contrato (`finalContrato`) de un estudiante individual, sin afectar al titular ni a otros beneficiarios del mismo contrato.

---

## 🔑 Conceptos Clave

### Diferencia: Extensión Manual vs Automática

| Característica | Extensión Manual | Extensión Automática (OnHold) |
|---------------|------------------|-------------------------------|
| **Trigger** | Admin hace clic en botón | Sistema al desactivar OnHold |
| **Motivo** | Admin escribe motivo | Auto-generado con fechas OnHold |
| **Días** | Admin selecciona fecha final | Calculados automáticamente (días pausados) |
| **Cuándo** | Cualquier momento | Solo al desactivar OnHold |
| **Uso común** | Cortesías, compensaciones | Pausas temporales |

---

## 🏗️ Arquitectura Completa

### Flujo de Datos (Frontend → Backend → Base de Datos)

```
┌─────────────────────────────────────────────┐
│ 1. FRONTEND: Usuario en página del         │
│    estudiante (/student/[id])               │
└──────────────────┬──────────────────────────┘
                   │
                   │ Usuario ve card verde
                   │ "Extensión de Vigencia"
                   ▼
┌─────────────────────────────────────────────┐
│ 2. COMPONENTE: StudentContract.tsx          │
│    - Muestra vigencia actual                │
│    - Botón "Extender Vigencia"              │
│    - Contador de extensiones                │
│    - Link "Ver historial"                   │
└──────────────────┬──────────────────────────┘
                   │
                   │ Click en botón
                   ▼
┌─────────────────────────────────────────────┐
│ 3. MODAL: Formulario de Extensión          │
│    📅 Nueva Fecha Final: [selector]         │
│    📝 Motivo (opcional): [textarea]         │
│    [Cancelar] [✅ Aplicar Extensión]        │
└──────────────────┬──────────────────────────┘
                   │
                   │ Admin completa y confirma
                   ▼
┌─────────────────────────────────────────────┐
│ 4. VALIDACIÓN FRONTEND                      │
│    ✅ Nueva fecha no vacía                  │
│    ✅ Nueva fecha > fecha actual            │
│    ✅ Cálculo de días extendidos            │
│    ✅ Confirmación del usuario              │
└──────────────────┬──────────────────────────┘
                   │
                   │ POST /api/wix-proxy/extend-vigencia
                   │ Body: {
                   │   studentId: "abc123",
                   │   nuevaFechaFinal: "2026-12-31",
                   │   motivo: "Cortesía por retraso"
                   │ }
                   ▼
┌─────────────────────────────────────────────┐
│ 5. API ROUTE: extend-vigencia/route.ts     │
│    - Valida parámetros requeridos          │
│    - Hace proxy a Wix                       │
│    - URL: ${WIX_API_BASE_URL}/             │
│           extendStudentVigencia             │
└──────────────────┬──────────────────────────┘
                   │
                   │ Forward request a Wix
                   ▼
┌─────────────────────────────────────────────┐
│ 6. WIX HTTP: http-functions.js             │
│    post_extendStudentVigencia()             │
│    - Recibe request HTTP                    │
│    - Extrae parámetros del body             │
│    - Llama función backend                  │
└──────────────────┬──────────────────────────┘
                   │
                   │ Call backend function
                   ▼
┌─────────────────────────────────────────────┐
│ 7. WIX BACKEND: search.jsw                 │
│    extendStudentVigencia()                  │
│    LÍNEAS 1673-1755                         │
│                                             │
│    PASOS:                                   │
│    1. Obtener estudiante de PEOPLE         │
│    2. Validar nueva fecha > actual          │
│    3. Calcular días extendidos              │
│    4. Incrementar extensionCount            │
│    5. Crear entrada en historial            │
│    6. Actualizar PEOPLE:                    │
│       - finalContrato = nuevaFecha          │
│       - vigencia = días restantes           │
│       - extensionCount++                    │
│       - extensionHistory.push({...})        │
│    7. Guardar en Wix                        │
└──────────────────┬──────────────────────────┘
                   │
                   │ Respuesta exitosa
                   ▼
┌─────────────────────────────────────────────┐
│ 8. FRONTEND: Mensaje de éxito              │
│    ✅ "Extensión aplicada exitosamente"    │
│    - Muestra días extendidos                │
│    - Número de extensión (#1, #2, etc)     │
│    - Reload de página                       │
└─────────────────────────────────────────────┘
                   │
                   │ window.location.reload()
                   ▼
┌─────────────────────────────────────────────┐
│ 9. PÁGINA ACTUALIZADA                      │
│    - Contador de extensiones: 1 → 2        │
│    - Fecha final actualizada                │
│    - Días restantes recalculados            │
│    - "Ver historial" muestra nueva entrada │
└─────────────────────────────────────────────┘
```

---

## 💾 Campos en Base de Datos (Tabla PEOPLE)

### Campos Relacionados con Extensión

```typescript
interface Student {
  _id: string                        // ID del estudiante
  primerNombre: string               // "Juan"
  primerApellido: string             // "Pérez"

  // ========== VIGENCIA ==========
  fechaContrato: Date                // Fecha inicio: "2025-01-01"
  finalContrato: Date                // Fecha fin: "2025-12-31" → "2026-12-31" (después de extensión)
  vigencia: number                   // Días restantes: 365 → 730 (recalculado)

  // ========== EXTENSIÓN ==========
  extensionCount: number             // Contador: 0 → 1 → 2 → 3...
  extensionHistory: ExtensionEntry[] // Array de todas las extensiones
}

interface ExtensionEntry {
  numero: number                     // Número de la extensión (1, 2, 3...)
  fechaEjecucion: string             // Timestamp: "2025-07-15T14:30:00.000Z"
  vigenciaAnterior: string           // Fecha anterior: "2025-12-31"
  vigenciaNueva: string              // Nueva fecha: "2026-12-31"
  diasExtendidos: number             // Días añadidos: 365
  motivo: string                     // "Cortesía por inconvenientes"
}
```

---

## 📊 Ejemplo Paso a Paso

### Escenario: Extender 6 meses (180 días) por cortesía

#### Estado Inicial
```javascript
// Estudiante en PEOPLE
{
  _id: "abc123",
  primerNombre: "María",
  primerApellido: "García",
  fechaContrato: "2025-01-01",
  finalContrato: "2025-12-31",       // ← 365 días de vigencia
  vigencia: 200,                      // ← Días restantes (hoy: 2025-06-15)
  extensionCount: 0,                  // ← Nunca extendido
  extensionHistory: []                // ← Sin historial
}
```

#### Paso 1: Admin abre modal
- Click en botón "🔄 Extender Vigencia del Estudiante"
- Modal se abre mostrando:
  - Estudiante: María García
  - Vigencia actual: 31/12/2025
  - Días restantes: 200

#### Paso 2: Admin completa formulario
```
📅 Nueva Fecha Final: [30/06/2026]
📝 Motivo: Cortesía por retrasos en clases grupales
```

#### Paso 3: Sistema calcula automáticamente
```javascript
const fechaActual = new Date("2025-12-31")
const nuevaFecha = new Date("2026-06-30")
const diasExtendidos = Math.ceil((nuevaFecha - fechaActual) / (1000 * 60 * 60 * 24))
// diasExtendidos = 181 días
```

#### Paso 4: Confirmación
```
⚠️ ATENCIÓN: Extensión de Vigencia para María García

¿Está seguro que desea extender la vigencia de este estudiante?

Detalles de la extensión:
  • Estudiante: María García
  • Vigencia actual: 31/12/2025
  • Nueva vigencia: 30/06/2026
  • Días extendidos: 181 días
  • Motivo: Cortesía por retrasos en clases grupales

Esta acción actualizará SOLO la fecha final de este estudiante en PEOPLE.

[Cancelar] [OK]
```

#### Paso 5: Backend ejecuta (Wix)

**Código en `search.jsw:extendStudentVigencia`**:

```javascript
// Línea 1685: Obtener estudiante
const student = await wixData.get('PEOPLE', 'abc123')

// Línea 1694-1702: Validar fecha
const fechaActual = new Date(student.finalContrato)  // 2025-12-31
const nuevaFecha = new Date("2026-06-30")
if (nuevaFecha <= fechaActual) return error  // ✅ Pasa validación

// Línea 1705: Calcular días
const diasExtendidos = Math.ceil((nuevaFecha - fechaActual) / (1000 * 60 * 60 * 24))
// diasExtendidos = 181

// Línea 1708-1709: Incrementar contador
const currentCount = student.extensionCount || 0  // 0
const newCount = currentCount + 1                 // 1

// Línea 1712-1719: Crear entrada de historial
const historyEntry = {
  numero: 1,
  fechaEjecucion: "2025-07-15T14:30:00.000Z",
  vigenciaAnterior: "2025-12-31",
  vigenciaNueva: "2026-06-30",
  diasExtendidos: 181,
  motivo: "Cortesía por retrasos en clases grupales"
}

// Línea 1722-1723: Agregar al array
const currentHistory = student.extensionHistory || []  // []
const updatedHistory = [...currentHistory, historyEntry]  // [historyEntry]

// Línea 1726-1729: Actualizar objeto estudiante
student.finalContrato = new Date("2026-06-30")
student.vigencia = Math.ceil((nuevaFecha - new Date()) / (1000 * 60 * 60 * 24))  // Recalcular
student.extensionCount = 1
student.extensionHistory = [historyEntry]

// Línea 1731: Guardar en Wix
const updatedStudent = await wixData.update('PEOPLE', student)
```

#### Estado Final
```javascript
// Estudiante en PEOPLE (después de extensión)
{
  _id: "abc123",
  primerNombre: "María",
  primerApellido: "García",
  fechaContrato: "2025-01-01",
  finalContrato: "2026-06-30",       // ← ✅ Extendido +181 días
  vigencia: 381,                      // ← ✅ Recalculado (desde hoy: 2025-06-15)
  extensionCount: 1,                  // ← ✅ Incrementado
  extensionHistory: [                 // ← ✅ Nueva entrada
    {
      numero: 1,
      fechaEjecucion: "2025-07-15T14:30:00.000Z",
      vigenciaAnterior: "2025-12-31",
      vigenciaNueva: "2026-06-30",
      diasExtendidos: 181,
      motivo: "Cortesía por retrasos en clases grupales"
    }
  ]
}
```

#### Paso 6: Frontend muestra éxito
```
✅ Extensión aplicada exitosamente

• Estudiante: María García
• Días extendidos: 181
• Nueva vigencia: 30/06/2026
• Extensión #1

[OK]
```

Página se recarga automáticamente y ahora muestra:
- Vigencia Actual: **30 Jun 2026** (antes: 31 Dic 2025)
- Días Restantes: **381 días** (antes: 200 días)
- Extensiones Realizadas: **1 vez** (antes: 0 veces)
- Link "Ver historial" (nuevo, antes no aparecía)

---

## 🎨 Interfaz de Usuario

### Card de Extensión de Vigencia

```
╔════════════════════════════════════════════════╗
║ 📅  Extensión de Vigencia                     ║
║    Cambiar la fecha final solo para este      ║
║    estudiante                                  ║
║                          📈 1 extensión  Ver historial
║ ┌────────────┬────────────┬────────────┐      ║
║ │📍 31 Dic   │⏱️ 200 días │📊 1 vez    │      ║
║ │   2025     │            │            │      ║
║ └────────────┴────────────┴────────────┘      ║
║                                                ║
║ [  🔄 Extender Vigencia del Estudiante  ]     ║
╚════════════════════════════════════════════════╝
```

### Modal de Extensión

```
╔═══════════════════════════════════════════════╗
║ 📅 Extender Vigencia del Estudiante      [X] ║
╠═══════════════════════════════════════════════╣
║                                               ║
║ 📋 Información Actual                         ║
║ ┌───────────────────────────────────────────┐ ║
║ │ • Estudiante: María García                │ ║
║ │ • Vigencia actual: 31/12/2025             │ ║
║ │ • Días restantes: 200 días                │ ║
║ │ • Extensiones previas: 0                  │ ║
║ └───────────────────────────────────────────┘ ║
║                                               ║
║ 📅 Nueva Fecha Final *                        ║
║ [2026-06-30        ]                          ║
║                                               ║
║ 📝 Motivo (opcional)                          ║
║ ┌───────────────────────────────────────────┐ ║
║ │ Cortesía por retrasos en clases grupales  │ ║
║ │                                           │ ║
║ └───────────────────────────────────────────┘ ║
║                                               ║
║ ✨ Resumen de Extensión                       ║
║ ┌───────────────────────────────────────────┐ ║
║ │ 📅 Fecha anterior: 31/12/2025             │ ║
║ │ 📅 Fecha nueva: 30/06/2026                │ ║
║ │ ⏱️ Días a extender: 181 días              │ ║
║ └───────────────────────────────────────────┘ ║
║                                               ║
║         [Cancelar]  [✅ Aplicar Extensión]    ║
╚═══════════════════════════════════════════════╝
```

### Modal de Historial de Extensiones

```
╔═══════════════════════════════════════════════╗
║ 📊 Historial de Extensiones - María García [X]║
╠═══════════════════════════════════════════════╣
║                                               ║
║ Total de extensiones: 2 veces                 ║
║                                               ║
║ ┌───────────────────────────────────────────┐ ║
║ │ #2        ✅ COMPLETADO      +90 días     │ ║
║ │                                           │ ║
║ │ 📅 Vigencia Anterior: 30 Jun 2026         │ ║
║ │ 📅 Vigencia Nueva: 28 Sep 2026            │ ║
║ │ 🕐 Fecha Ejecución: 15 Jul 2025 14:30    │ ║
║ │ 💬 Motivo: Extensión manual adicional     │ ║
║ └───────────────────────────────────────────┘ ║
║                                               ║
║ ┌───────────────────────────────────────────┐ ║
║ │ #1        ✅ COMPLETADO      +181 días    │ ║
║ │                                           │ ║
║ │ 📅 Vigencia Anterior: 31 Dic 2025         │ ║
║ │ 📅 Vigencia Nueva: 30 Jun 2026            │ ║
║ │ 🕐 Fecha Ejecución: 15 Jul 2025 14:30    │ ║
║ │ 💬 Motivo: Cortesía por retrasos...       │ ║
║ └───────────────────────────────────────────┘ ║
║                                               ║
║                                  [Cerrar]     ║
╚═══════════════════════════════════════════════╝
```

---

## 🔄 Diferencias con OnHold

### Extensión Manual vs OnHold Automático

```
EXTENSIÓN MANUAL
┌────────────────────────────────┐
│ Admin decide extender          │
│ ↓                              │
│ Selecciona nueva fecha final   │
│ ↓                              │
│ Escribe motivo (opcional)      │
│ ↓                              │
│ Sistema extiende finalContrato │
│ ↓                              │
│ Registro en extensionHistory   │
└────────────────────────────────┘

ONHOLD AUTOMÁTICO
┌────────────────────────────────┐
│ Admin activa OnHold (30 días)  │
│ ↓                              │
│ Estudiante pausado             │
│ ↓                              │
│ Admin desactiva OnHold         │
│ ↓                              │
│ Sistema AUTO-extiende +30 días │
│ ↓                              │
│ Registro en extensionHistory   │
│   motivo: "Extensión automática│
│            por OnHold..."      │
└────────────────────────────────┘
```

---

## ⚙️ Validaciones Implementadas

### Frontend (StudentContract.tsx)
1. ✅ Nueva fecha no puede estar vacía
2. ✅ Nueva fecha debe ser posterior a fecha actual
3. ✅ Confirmación del usuario con resumen
4. ✅ Cálculo de días extendidos antes de enviar

### Backend (search.jsw)
1. ✅ `studentId` y `nuevaFechaFinal` son requeridos
2. ✅ Estudiante debe existir en PEOPLE
3. ✅ Nueva fecha debe ser posterior a `finalContrato` actual
4. ✅ Cálculo seguro de días (Math.ceil para redondear hacia arriba)

---

## 🎯 Casos de Uso Comunes

### 1. Cortesía por Problemas Técnicos
```
Motivo: "Cortesía 15 días por caída de plataforma"
Días: +15
```

### 2. Compensación por Advisor Ausente
```
Motivo: "Compensación 30 días por cambio de advisor"
Días: +30
```

### 3. Regalo de Cumpleaños
```
Motivo: "Regalo de cumpleaños - 7 días gratis"
Días: +7
```

### 4. Extensión Comercial
```
Motivo: "Promoción especial - 60 días adicionales"
Días: +60
```

### 5. OnHold (Automática)
```
Motivo: "Extensión automática por OnHold (30 días pausados desde 2025-07-01 hasta 2025-07-31)"
Días: +30 (calculado automáticamente)
```

---

## 📁 Archivos Involucrados

### Backend Wix
- **`backend/search.jsw:1673-1755`** - Función `extendStudentVigencia`
- **`backend/http-functions.js:1123-1172`** - HTTP handler `post_extendStudentVigencia`

### API Routes Next.js
- **`src/app/api/wix-proxy/extend-vigencia/route.ts`** - Proxy a Wix

### Frontend Components
- **`src/components/student/StudentContract.tsx`**
  - Card de extensión (líneas 164-230)
  - Modal de extensión (líneas 285-397)
  - Modal de historial (líneas 400-510)
  - Handler `handleExtendVigencia` (líneas 90-157)

### Types
- **`src/types/index.ts`**
  - Interface `Student` con campos de extensión
  - Interface `ExtensionHistoryEntry`

---

## 🧪 Testing Manual

### Test Básico
1. Ir a página de estudiante
2. Ver card "Extensión de Vigencia"
3. Click en "Extender Vigencia del Estudiante"
4. Seleccionar nueva fecha (ej: +30 días)
5. Escribir motivo: "Test de extensión"
6. Confirmar
7. Verificar:
   - ✅ Mensaje de éxito
   - ✅ Página se recarga
   - ✅ Vigencia actual actualizada
   - ✅ Días restantes recalculados
   - ✅ Contador de extensiones incrementado
   - ✅ Link "Ver historial" aparece

### Test de Historial
1. Después de hacer al menos 1 extensión
2. Click en "Ver historial"
3. Verificar modal muestra:
   - ✅ Número de extensión (#1, #2, etc)
   - ✅ Días extendidos
   - ✅ Vigencia anterior y nueva
   - ✅ Fecha de ejecución
   - ✅ Motivo (si se especificó)

### Test de Validaciones
1. Intentar extender sin seleccionar fecha → Error
2. Intentar fecha anterior a actual → Error
3. Extensión válida → Éxito

---

## 🔐 Importante: Solo Afecta al Estudiante

⚠️ **Nota Crítica**: Esta extensión solo modifica el registro individual del estudiante en PEOPLE.

**NO afecta**:
- ❌ Titular del contrato
- ❌ Otros beneficiarios del mismo contrato
- ❌ Tabla ACADEMICA (solo lectura)

**SÍ afecta**:
- ✅ Solo el estudiante individual en PEOPLE
- ✅ Sus campos: `finalContrato`, `vigencia`, `extensionCount`, `extensionHistory`

---

## 📊 Resumen Técnico

| Aspecto | Detalle |
|---------|---------|
| **Función Backend** | `extendStudentVigencia` (search.jsw:1673) |
| **API Endpoint** | POST /api/wix-proxy/extend-vigencia |
| **Parámetros** | `studentId`, `nuevaFechaFinal`, `motivo` |
| **Tabla Wix** | PEOPLE |
| **Campos Modificados** | `finalContrato`, `vigencia`, `extensionCount`, `extensionHistory` |
| **Tipo** | Manual (admin selecciona fecha) |
| **Scope** | Solo estudiante individual |
| **Historial** | Sí, cada extensión se registra |
| **Motivo** | Opcional, editable por admin |

---

**¿Necesitas más detalles sobre alguna parte específica de la extensión de vigencia?**
