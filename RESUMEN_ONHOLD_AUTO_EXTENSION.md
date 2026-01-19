# 📊 Resumen: Extensión Automática de Vigencia al Desactivar OnHold

## 🎯 ¿Qué Hace Este Cambio?

Cuando un estudiante sale de **OnHold** (se reactiva), el sistema **automáticamente extiende** su fecha final de contrato (`finalContrato`) por la cantidad exacta de días que estuvo pausado.

---

## 📈 Diagrama de Flujo

```
┌─────────────────────────────────────────┐
│ Estudiante tiene contrato activo        │
│ finalContrato: 2025-12-31               │
└──────────────┬──────────────────────────┘
               │
               │ Admin activa OnHold
               │ (30 días: 2025-07-01 a 2025-07-31)
               ▼
┌─────────────────────────────────────────┐
│ Estudiante EN ONHOLD                    │
│ - estadoInactivo: true                  │
│ - fechaOnHold: 2025-07-01               │
│ - fechaFinOnHold: 2025-07-31            │
│ - finalContrato: 2025-12-31 (sin cambio)│
│ - onHoldCount: 1                        │
└──────────────┬──────────────────────────┘
               │
               │ Admin desactiva OnHold
               │ (Estudiante vuelve a activo)
               ▼
┌─────────────────────────────────────────┐
│ 🔄 NUEVO: EXTENSIÓN AUTOMÁTICA          │
│                                         │
│ 1. Calcular días pausados: 30 días     │
│ 2. Extender finalContrato: +30 días    │
│ 3. Nuevo finalContrato: 2026-01-30 ✅  │
│ 4. Registrar en extensionHistory        │
│ 5. Limpiar fechas OnHold                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Estudiante REACTIVADO con vigencia      │
│ extendida                               │
│ - estadoInactivo: false                 │
│ - fechaOnHold: null                     │
│ - fechaFinOnHold: null                  │
│ - finalContrato: 2026-01-30 ✅          │
│ - extensionCount: 1                     │
│ - extensionHistory: [{...}]             │
└─────────────────────────────────────────┘
```

---

## 🔑 Datos Clave

| Métrica | Antes del Cambio | Después del Cambio |
|---------|------------------|-------------------|
| **Estudiante pierde días?** | ✅ SÍ (pierde días de OnHold) | ❌ NO (se compensan) |
| **Proceso manual?** | ✅ SÍ (admin debe extender manualmente) | ❌ NO (automático) |
| **Trazabilidad?** | ❌ NO (sin registro) | ✅ SÍ (en extensionHistory) |
| **Riesgo de error humano?** | ✅ ALTO | ❌ BAJO |

---

## 📝 Cambios en la Base de Datos (PEOPLE)

### Escenario: OnHold de 30 días

| Campo | Valor Inicial | Durante OnHold | Después de Desactivar |
|-------|--------------|----------------|----------------------|
| `estadoInactivo` | `false` | `true` | `false` |
| `fechaOnHold` | `null` | `"2025-07-01"` | `null` |
| `fechaFinOnHold` | `null` | `"2025-07-31"` | `null` |
| `finalContrato` | `"2025-12-31"` | `"2025-12-31"` | `"2026-01-30"` ⭐ |
| `vigencia` | `365` | `365` | `395` ⭐ |
| `onHoldCount` | `0` | `1` | `1` |
| `extensionCount` | `0` | `0` | `1` ⭐ |
| `extensionHistory` | `[]` | `[]` | `[{...}]` ⭐ |

**⭐ = Nuevos cambios automáticos**

---

## 🎯 Beneficios

### Para el Estudiante:
- ✅ No pierde días de contrato
- ✅ Justicia contractual garantizada
- ✅ Transparencia total (historial completo)

### Para el Admin:
- ✅ Proceso automático (sin intervención manual)
- ✅ Sin riesgo de olvidar extender vigencia
- ✅ Trazabilidad completa en el historial

### Para el Sistema:
- ✅ Consistencia de datos
- ✅ Auditabilidad completa
- ✅ Integración perfecta con extensiones manuales

---

## 🔧 ¿Qué Necesitas Hacer?

### Opción A: Deployment en Wix (Recomendado)

1. Abrir Wix Editor → Velo (código backend)
2. Abrir archivo `backend/search.jsw`
3. Buscar línea **1279** (función `toggleUserStatus`)
4. Reemplazar **6 líneas** de código (1279-1284) con el nuevo código
5. Guardar y Publicar

**📄 Ver instrucciones detalladas:** [DESPLEGAR_ONHOLD_AUTO_EXTENSION.md](DESPLEGAR_ONHOLD_AUTO_EXTENSION.md)

### Opción B: Solo Entender el Cambio

**No deployment requerido** - Este documento es solo informativo.

---

## 📊 Ejemplo Real

### Caso: Estudiante Juan Pérez

```javascript
// ESTADO INICIAL
{
  _id: "abc123",
  primerNombre: "Juan",
  primerApellido: "Pérez",
  contrato: "CTR-2025-001",
  fechaContrato: "2025-01-01",
  finalContrato: "2025-12-31",  // 365 días de vigencia
  vigencia: 365,
  estadoInactivo: false,
  onHoldCount: 0,
  extensionCount: 0
}

// ────────────────────────────────────────

// ACTIVAR ONHOLD (2025-07-01 a 2025-07-31 = 30 días)
POST /api/wix-proxy/toggle-student-onhold
{
  "studentId": "abc123",
  "setOnHold": true,
  "fechaOnHold": "2025-07-01",
  "fechaFinOnHold": "2025-07-31",
  "motivo": "Vacaciones familiares"
}

// ESTADO DURANTE ONHOLD
{
  _id: "abc123",
  finalContrato: "2025-12-31",  // ← Sin cambios
  estadoInactivo: true,         // ← PAUSADO
  fechaOnHold: "2025-07-01",
  fechaFinOnHold: "2025-07-31",
  onHoldCount: 1,
  onHoldHistory: [
    {
      fechaActivacion: "2025-07-01T10:30:00Z",
      fechaOnHold: "2025-07-01",
      fechaFinOnHold: "2025-07-31",
      motivo: "Vacaciones familiares",
      activadoPor: "Admin"
    }
  ]
}

// ────────────────────────────────────────

// DESACTIVAR ONHOLD (Reactivar estudiante)
POST /api/wix-proxy/toggle-student-onhold
{
  "studentId": "abc123",
  "setOnHold": false
}

// 🎉 NUEVO ESTADO (CON EXTENSIÓN AUTOMÁTICA)
{
  _id: "abc123",
  finalContrato: "2026-01-30",  // ← ✅ Extendido +30 días (2025-12-31 + 30)
  vigencia: 395,                // ← Recalculado
  estadoInactivo: false,        // ← ACTIVO
  fechaOnHold: null,            // ← Limpiado
  fechaFinOnHold: null,         // ← Limpiado
  onHoldCount: 1,
  extensionCount: 1,            // ← ✅ Incrementado
  extensionHistory: [           // ← ✅ Nueva entrada
    {
      numero: 1,
      fechaEjecucion: "2025-07-31T14:20:00Z",
      vigenciaAnterior: "2025-12-31",
      vigenciaNueva: "2026-01-30",
      diasExtendidos: 30,
      motivo: "Extensión automática por OnHold (30 días pausados desde 2025-07-01 hasta 2025-07-31)"
    }
  ],
  onHoldHistory: [
    {
      fechaActivacion: "2025-07-01T10:30:00Z",
      fechaOnHold: "2025-07-01",
      fechaFinOnHold: "2025-07-31",
      motivo: "Vacaciones familiares",
      activadoPor: "Admin"
    }
  ]
}
```

---

## ⚠️ Casos Edge

### 1. **Estudiante sin `finalContrato`**
```javascript
// Si usuario.finalContrato === null
// → No se extiende vigencia
// → Se logea: "⚠️ No se pudo extender vigencia: finalContrato no existe"
// → OnHold se desactiva normalmente
```

### 2. **Fechas OnHold inválidas**
```javascript
// Si fechaOnHold === null o fechaFinOnHold === null
// → No se extiende vigencia
// → Se logea: "⚠️ No se encontraron fechas OnHold para calcular extensión"
// → OnHold se desactiva normalmente
```

### 3. **Días pausados = 0**
```javascript
// Si fechaFin <= fechaInicio (error de datos)
// → No se extiende vigencia
// → Se logea: "⚠️ No se pudo extender vigencia: días pausados = 0"
// → OnHold se desactiva normalmente
```

### 4. **Múltiples OnHolds**
```javascript
// OnHold #1: 15 días → finalContrato extendido +15
// OnHold #2: 20 días → finalContrato extendido +20 (acumulativo)
// Resultado: finalContrato original + 35 días total
```

---

## 🧪 Testing Checklist

Después de desplegar en Wix:

- [ ] Crear estudiante de prueba
- [ ] Activar OnHold por 10 días
- [ ] Verificar que `onHoldCount` = 1
- [ ] Desactivar OnHold
- [ ] Verificar que `finalContrato` se extendió +10 días
- [ ] Verificar que `extensionCount` = 1
- [ ] Verificar que `extensionHistory[0].diasExtendidos` = 10
- [ ] Verificar que `extensionHistory[0].motivo` contiene "Extensión automática por OnHold"
- [ ] Verificar que `fechaOnHold` y `fechaFinOnHold` son `null`
- [ ] Ver historial de extensiones en frontend
- [ ] Verificar que aparece la extensión automática con motivo correcto

---

## 📚 Documentación Relacionada

- [DESPLEGAR_ONHOLD_AUTO_EXTENSION.md](DESPLEGAR_ONHOLD_AUTO_EXTENSION.md) - Instrucciones detalladas de deployment
- [DESPLEGAR_ONHOLD_WIX.md](DESPLEGAR_ONHOLD_WIX.md) - Instrucciones anteriores de OnHold (motivo)
- [CLAUDE.md](CLAUDE.md) - Documentación del proyecto

---

## 📞 Soporte

Si encuentras problemas:

1. Verificar logs en consola de Wix (buscar emojis 🔄, 📊, ✅, ⚠️)
2. Revisar que el código se copió correctamente en `search.jsw`
3. Verificar que los campos existen en PEOPLE: `finalContrato`, `extensionCount`, `extensionHistory`
4. Consultar el archivo de deployment detallado

---

**Última actualización:** 2025-10-15
**Autor:** Claude Code
**Status:** ✅ Listo para deployment
