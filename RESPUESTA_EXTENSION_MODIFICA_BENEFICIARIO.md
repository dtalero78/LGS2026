# 🎯 Respuesta: ¿Qué Item Modifica la Extensión?

## ✅ Respuesta Directa

La **Extensión de Vigencia** modifica el registro del **BENEFICIARIO** en la tabla **PEOPLE**.

---

## 📊 Diagrama del Flujo de Datos

```
FLUJO DE EXTENSIÓN DE VIGENCIA
════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────┐
│ 1. USUARIO VE PÁGINA                                │
│    URL: /student/[id]                               │
│    ID del parámetro: ID de ACADEMICA ✅             │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ Backend busca estudiante
                   ▼
┌─────────────────────────────────────────────────────┐
│ 2. BACKEND: getStudentById(studentId)               │
│    search.jsw - Función que obtiene datos           │
│                                                     │
│    PASO A: Buscar en ACADEMICA por _id             │
│    ┌──────────────────────────────────┐            │
│    │ ACADEMICA                        │            │
│    │ _id: "abc123" ← ID del parámetro│            │
│    │ primerNombre: "Juan"             │            │
│    │ usuarioId: "xyz789" ← IMPORTANTE │            │
│    └──────────────────────────────────┘            │
│                                                     │
│    PASO B: Usar usuarioId para buscar en PEOPLE    │
│    ┌──────────────────────────────────┐            │
│    │ PEOPLE (BENEFICIARIO)            │            │
│    │ _id: "xyz789" ← usuarioId        │            │
│    │ tipoUsuario: "BENEFICIARIO"      │            │
│    │ finalContrato: "2025-12-31"      │            │
│    │ extensionCount: 0                │            │
│    └──────────────────────────────────┘            │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ Combinar datos
                   ▼
┌─────────────────────────────────────────────────────┐
│ 3. OBJETO ESTUDIANTE COMBINADO                      │
│    (Datos de ACADEMICA + PEOPLE)                    │
│                                                     │
│    {                                                │
│      _id: "abc123",           ← ID de ACADEMICA    │
│      primerNombre: "Juan",    ← De ACADEMICA       │
│      usuarioId: "xyz789",     ← De ACADEMICA       │
│      peopleId: "xyz789",      ← De PEOPLE._id      │
│      finalContrato: "2025-12-31",  ← De PEOPLE     │
│      extensionCount: 0,       ← De PEOPLE          │
│      extensionHistory: [],    ← De PEOPLE          │
│      tipoUsuario: "BENEFICIARIO"  ← De PEOPLE      │
│    }                                                │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ Frontend recibe objeto
                   ▼
┌─────────────────────────────────────────────────────┐
│ 4. COMPONENTE: StudentContract.tsx                  │
│    Cuando admin hace extensión:                     │
│                                                     │
│    studentId: student.peopleId || student._id      │
│                ↑                                    │
│                └─ Prioridad a peopleId (xyz789)    │
│                   Si no existe, usa _id (abc123)   │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ POST /api/wix-proxy/extend-vigencia
                   │ Body: { studentId: "xyz789", ... }
                   ▼
┌─────────────────────────────────────────────────────┐
│ 5. BACKEND: extendStudentVigencia(studentId)        │
│    search.jsw línea 1685                            │
│                                                     │
│    const student = await wixData.get('PEOPLE', 'xyz789')
│                                            ↑        │
│                                            │        │
│                    Busca directamente en PEOPLE    │
│                    por el ID del BENEFICIARIO      │
│                                                     │
│    student.finalContrato = nuevaFecha              │
│    student.extensionCount++                        │
│    student.extensionHistory.push({...})            │
│                                                     │
│    await wixData.update('PEOPLE', student)         │
│                          ↑                         │
│                          │                         │
│            Actualiza el registro del BENEFICIARIO  │
└─────────────────────────────────────────────────────┘
```

---

## 🔑 Puntos Clave

### 1. **ID que se envía a la función de extensión**

```typescript
// En StudentContract.tsx línea 129
studentId: student.peopleId || student._id
           ↑                  ↑
           │                  └─ Fallback: ID de ACADEMICA
           │
           └─ Prioridad: ID de PEOPLE (beneficiario)
```

### 2. **Qué modifica `extendStudentVigencia`**

```javascript
// En search.jsw línea 1685
const student = await wixData.get('PEOPLE', studentId)
//                                ↑        ↑
//                                │        └─ ID del BENEFICIARIO
//                                │
//                                └─ Tabla PEOPLE
```

**La función busca y modifica DIRECTAMENTE el registro en PEOPLE**, que es el registro del **BENEFICIARIO**.

---

## 📋 Ejemplo Concreto

### Escenario: Familia García

#### Estructura de Datos

```
CONTRATO: CTR-2025-001

┌─────────────────────────────────────────┐
│ PEOPLE (TITULAR)                        │
│ _id: "titular-123"                      │
│ tipoUsuario: "TITULAR"                  │
│ primerNombre: "Carlos"                  │
│ primerApellido: "García"                │
│ contrato: "CTR-2025-001"                │
│ finalContrato: "2025-12-31"             │
│ extensionCount: 0                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ PEOPLE (BENEFICIARIO)                   │
│ _id: "beneficiario-456" ← ESTE SE MODIFICA
│ tipoUsuario: "BENEFICIARIO"             │
│ primerNombre: "Juan"                    │
│ primerApellido: "García"                │
│ contrato: "CTR-2025-001"                │
│ finalContrato: "2025-12-31"             │
│ extensionCount: 0                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ACADEMICA                               │
│ _id: "academica-789"                    │
│ primerNombre: "Juan"                    │
│ usuarioId: "beneficiario-456" ← Link    │
│ contrato: "CTR-2025-001"                │
└─────────────────────────────────────────┘
```

### Flujo de Extensión

```
1. Admin visita: /student/academica-789
                           ↑
                           ID de ACADEMICA

2. Backend ejecuta: getStudentById("academica-789")
   - Busca en ACADEMICA por _id: "academica-789"
   - Encuentra usuarioId: "beneficiario-456"
   - Busca en PEOPLE por _id: "beneficiario-456"
   - Retorna objeto combinado con peopleId: "beneficiario-456"

3. Admin hace extensión
   - Frontend envía: studentId: "beneficiario-456"
                                ↑
                                peopleId (prioridad)

4. Backend ejecuta: extendStudentVigencia("beneficiario-456")
   - wixData.get('PEOPLE', "beneficiario-456")
   - Modifica SOLO este registro

5. Resultado:
   PEOPLE (TITULAR)          → SIN CAMBIOS ❌
   PEOPLE (BENEFICIARIO)     → MODIFICADO ✅
     - finalContrato: "2026-12-31"
     - extensionCount: 1
     - extensionHistory: [{...}]
```

---

## ✅ Confirmación del Código

### Código que Combina Datos (search.jsw)

```javascript
// Línea ~440 - Función getStudentById
const student = academicaResult.items[0];  // De ACADEMICA

// Buscar en PEOPLE usando usuarioId
let peopleData = null;
if (student.usuarioId) {
    const peopleResult = await wixData.query('PEOPLE')
        .eq('_id', student.usuarioId)  // ← Busca el BENEFICIARIO
        .limit(1)
        .find();

    if (peopleResult.items.length > 0) {
        peopleData = peopleResult.items[0];  // ← Datos del BENEFICIARIO
    }
}

// Formatear objeto combinado
const formattedStudent = {
    _id: student._id,              // ID de ACADEMICA
    peopleId: peopleData?._id,     // ID de PEOPLE (beneficiario)
    finalContrato: peopleData?.finalContrato,     // Del BENEFICIARIO
    extensionCount: peopleData?.extensionCount,   // Del BENEFICIARIO
    extensionHistory: peopleData?.extensionHistory // Del BENEFICIARIO
};
```

### Código que Modifica (search.jsw)

```javascript
// Línea 1685 - Función extendStudentVigencia
const student = await wixData.get('PEOPLE', studentId);
//                              ↑            ↑
//                              │            └─ ID del BENEFICIARIO
//                              │
//                              └─ Tabla PEOPLE

// Línea 1731 - Actualiza en PEOPLE
const updatedStudent = await wixData.update('PEOPLE', student);
//                                          ↑
//                                          └─ Actualiza registro del BENEFICIARIO
```

---

## 🆚 Comparación: ¿Qué NO se Modifica?

| Item | ¿Se Modifica? | Razón |
|------|---------------|-------|
| **BENEFICIARIO en PEOPLE** | ✅ **SÍ** | Es el objetivo de la extensión |
| **TITULAR en PEOPLE** | ❌ **NO** | No se toca en absoluto |
| **Otros beneficiarios** | ❌ **NO** | Solo se modifica el beneficiario específico |
| **ACADEMICA** | ❌ **NO** | Es tabla de solo lectura para extensiones |

---

## 💡 Razón del Diseño

### ¿Por qué solo el beneficiario?

La funcionalidad está diseñada para permitir **extensiones individualizadas**:

- **Caso 1**: Juan (beneficiario) necesita 30 días extra por problemas personales
  - Solo se extiende `finalContrato` de Juan
  - El titular y otros beneficiarios no se afectan

- **Caso 2**: María (beneficiaria) recibe 15 días de cortesía
  - Solo se extiende `finalContrato` de María
  - Sus hermanos (otros beneficiarios) no reciben la cortesía

### Ventaja:
✅ **Flexibilidad** para dar beneficios individuales sin afectar el contrato familiar completo.

### Alternativa (si quisieras extender a todos):
Tendrías que crear una función diferente que:
1. Busque todos los beneficiarios del mismo contrato
2. Extienda `finalContrato` en cada uno de ellos
3. Opcionalmente también extender al titular

---

## 🎯 Resumen Ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| **¿Qué registro se modifica?** | BENEFICIARIO en tabla PEOPLE |
| **¿Se modifica el titular?** | NO |
| **¿Se modifican otros beneficiarios?** | NO |
| **¿Qué ID se usa?** | `peopleId` (ID del beneficiario en PEOPLE) |
| **¿Qué campos se actualizan?** | `finalContrato`, `vigencia`, `extensionCount`, `extensionHistory` |
| **¿Se modifica ACADEMICA?** | NO (solo lectura) |

---

## 📝 Nota Importante

El campo `student.peopleId` se calcula en la función `getStudentById`:

```javascript
peopleId: peopleData?._id || student.usuarioId || null
          ↑
          └─ ID del registro del BENEFICIARIO en PEOPLE
```

Este `peopleId` es el que se envía a `extendStudentVigencia`, garantizando que siempre se modifique el registro correcto del **BENEFICIARIO** en la tabla **PEOPLE**.

---

**Conclusión**: La extensión modifica **SOLO** el registro del **beneficiario individual** en la tabla **PEOPLE**, sin tocar al titular ni a otros beneficiarios del mismo contrato.
