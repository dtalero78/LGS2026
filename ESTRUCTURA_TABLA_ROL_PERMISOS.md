# Estructura de la Tabla ROL_PERMISOS en Wix

## ¡AQUÍ ESTÁN LOS PERMISOS! 👇

### **Estructura de la tabla:**

```
┌─────┬──────────────┬─────────────────────────────┬────────┬─────────────────────┬────────────────┬────────────────────┐
│ _id │     rol      │          permisos           │ activo │     descripcion     │ fechaCreacion  │ fechaActualizacion │
├─────┼──────────────┼─────────────────────────────┼────────┼─────────────────────┼────────────────┼────────────────────┤
│  1  │ SUPER_ADMIN  │ [41 permisos en JSON]       │  true  │ Acceso total...     │  2025-01-15    │  2025-01-15        │
│  2  │ ADMIN        │ [40 permisos en JSON]       │  true  │ Administrador...    │  2025-01-15    │  2025-01-15        │
│  3  │ ADVISOR      │ [16 permisos en JSON] ⬅️    │  true  │ Advisor - Gestión   │  2025-01-15    │  2025-01-15        │
│  4  │ COMERCIAL    │ [21 permisos en JSON]       │  true  │ Comercial...        │  2025-01-15    │  2025-01-15        │
│  5  │ APROBADOR    │ [12 permisos en JSON]       │  true  │ Aprobador...        │  2025-01-15    │  2025-01-15        │
│  6  │ TALERO       │ [15 permisos en JSON]       │  true  │ Talero...           │  2025-01-15    │  2025-01-15        │
│  7  │ FINANCIERO   │ [4 permisos en JSON]        │  true  │ Financiero...       │  2025-01-15    │  2025-01-15        │
│  8  │ SERVICIO     │ [9 permisos en JSON]        │  true  │ Servicio...         │  2025-01-15    │  2025-01-15        │
│  9  │ READONLY     │ [2 permisos en JSON]        │  true  │ Solo lectura        │  2025-01-15    │  2025-01-15        │
└─────┴──────────────┴─────────────────────────────┴────────┴─────────────────────┴────────────────┴────────────────────┘
```

---

## La Columna "permisos" - ¡Aquí está la clave! 🔑

### **Ejemplo: Fila del ADVISOR**

```json
{
  "_id": "3",
  "rol": "ADVISOR",
  "permisos": [
    "PERSON.INFO.VER_DOCUMENTACION",
    "PERSON.INFO.WHATSAPP",
    "STUDENT.GLOBAL.ENVIAR_MENSAJE",
    "STUDENT.ACADEMIA.EVALUACION",
    "STUDENT.ACADEMIA.AGENDAR_CLASE",
    "STUDENT.ACADEMIA.MARCAR_STEP",
    "ACADEMICO.AGENDA.VER_CALENDARIO",
    "ACADEMICO.AGENDA.VER_AGENDA",
    "ACADEMICO.AGENDA.FILTRO",
    "ACADEMICO.AGENDA.NUEVO_EVENTO",
    "ACADEMICO.AGENDA.EDITAR",
    "ACADEMICO.AGENDA.CREAR_EVENTO",
    "ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA",
    "ACADEMICO.AGENDA.VER_ENLACE",
    "SERVICIO.WELCOME.CARGAR_EVENTOS",
    "SERVICIO.WELCOME.EXPORTAR_CSV"
  ],
  "activo": true,
  "descripcion": "Advisor - Gestión académica y seguimiento de estudiantes",
  "fechaCreacion": "2025-01-15",
  "fechaActualizacion": "2025-01-15"
}
```

**👆 ESTOS son los 16 permisos del ADVISOR**

---

## Cómo se Ve en el CSV

El archivo CSV tiene esta línea para ADVISOR (es muy larga):

```csv
3,ADVISOR,"[""PERSON.INFO.VER_DOCUMENTACION"",""PERSON.INFO.WHATSAPP"",""STUDENT.GLOBAL.ENVIAR_MENSAJE"",""STUDENT.ACADEMIA.EVALUACION"",""STUDENT.ACADEMIA.AGENDAR_CLASE"",""STUDENT.ACADEMIA.MARCAR_STEP"",""ACADEMICO.AGENDA.VER_CALENDARIO"",""ACADEMICO.AGENDA.VER_AGENDA"",""ACADEMICO.AGENDA.FILTRO"",""ACADEMICO.AGENDA.NUEVO_EVENTO"",""ACADEMICO.AGENDA.EDITAR"",""ACADEMICO.AGENDA.CREAR_EVENTO"",""ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA"",""ACADEMICO.AGENDA.VER_ENLACE"",""SERVICIO.WELCOME.CARGAR_EVENTOS"",""SERVICIO.WELCOME.EXPORTAR_CSV""]",true,Advisor - Gestión académica y seguimiento de estudiantes,2025-01-15,2025-01-15
```

**Explicación:**
- `3` = ID
- `ADVISOR` = Nombre del rol
- `"[""PERSON.INFO.VER_DOCUMENTACION"",...]"` = **ARRAY JSON con todos los permisos**
- `true` = Activo
- `Advisor - Gestión...` = Descripción
- Fechas...

---

## Cómo se Ve en Wix CMS (Cuando Importes)

### **En la interfaz de Wix:**

```
┌─────────────────────────────────────────────────────────┐
│ ROL_PERMISOS Collection                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Item: ADVISOR                                           │
│                                                         │
│ _id: 3                                                  │
│ rol: ADVISOR                                            │
│                                                         │
│ permisos: (Array - 16 items) ⬇️                        │
│   [0] PERSON.INFO.VER_DOCUMENTACION                    │
│   [1] PERSON.INFO.WHATSAPP                             │
│   [2] STUDENT.GLOBAL.ENVIAR_MENSAJE                    │
│   [3] STUDENT.ACADEMIA.EVALUACION                      │
│   [4] STUDENT.ACADEMIA.AGENDAR_CLASE                   │
│   [5] STUDENT.ACADEMIA.MARCAR_STEP                     │
│   [6] ACADEMICO.AGENDA.VER_CALENDARIO                  │
│   [7] ACADEMICO.AGENDA.VER_AGENDA                      │
│   [8] ACADEMICO.AGENDA.FILTRO                          │
│   [9] ACADEMICO.AGENDA.NUEVO_EVENTO                    │
│   [10] ACADEMICO.AGENDA.EDITAR                         │
│   [11] ACADEMICO.AGENDA.CREAR_EVENTO                   │
│   [12] ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA           │
│   [13] ACADEMICO.AGENDA.VER_ENLACE                     │
│   [14] SERVICIO.WELCOME.CARGAR_EVENTOS                 │
│   [15] SERVICIO.WELCOME.EXPORTAR_CSV                   │
│                                                         │
│ activo: ✓ true                                         │
│ descripcion: Advisor - Gestión académica...            │
│ fechaCreacion: Jan 15, 2025                            │
│ fechaActualizacion: Jan 15, 2025                       │
└─────────────────────────────────────────────────────────┘
```

---

## Todos los Roles con sus Permisos

### **SUPER_ADMIN (41 permisos):**
- Todos los permisos del sistema (PERSON, STUDENT, ACADEMICO, SERVICIO, COMERCIAL, APROBACION)

### **ADMIN (40 permisos):**
- Todos excepto PERSON.INFO.ELIMINAR

### **ADVISOR (16 permisos):**
✓ PERSON.INFO.VER_DOCUMENTACION
✓ PERSON.INFO.WHATSAPP
✓ STUDENT.GLOBAL.ENVIAR_MENSAJE
✓ STUDENT.ACADEMIA.EVALUACION
✓ STUDENT.ACADEMIA.AGENDAR_CLASE
✓ STUDENT.ACADEMIA.MARCAR_STEP
✓ ACADEMICO.AGENDA.VER_CALENDARIO
✓ ACADEMICO.AGENDA.VER_AGENDA
✓ ACADEMICO.AGENDA.FILTRO
✓ ACADEMICO.AGENDA.NUEVO_EVENTO
✓ ACADEMICO.AGENDA.EDITAR
✓ ACADEMICO.AGENDA.CREAR_EVENTO
✓ ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA
✓ ACADEMICO.AGENDA.VER_ENLACE
✓ SERVICIO.WELCOME.CARGAR_EVENTOS
✓ SERVICIO.WELCOME.EXPORTAR_CSV

### **COMERCIAL (21 permisos):**
✓ PERSON (7 permisos): VER_DOCUMENTACION, ADICION_DOCUMENTACION, CAMBIO_CELULAR, CAMBIAR_ESTADO, MODIFICAR, AGREGAR_BENEFICIARIO, WHATSAPP
✓ STUDENT (3 permisos): ENVIAR_MENSAJE, CONSULTA_CONTRATO, GENERAR_ESTADO_CUENTA
✓ COMERCIAL (5 permisos): MODIFICAR, ENVIAR_PDF, DESCARGAR, APROBACION_AUTONOMA, VER_PROSPECTOS
✓ APROBACION (6 permisos): ACTUALIZAR, EXPORTAR_CSV, MODIFICAR_CONTRATO, ENVIAR_PDF, DESCARGAR, APROBACION_AUTONOMA

### **APROBADOR (12 permisos):**
✓ PERSON (3 permisos): VER_DOCUMENTACION, ADICION_DOCUMENTACION, WHATSAPP
✓ STUDENT (3 permisos): ENVIAR_MENSAJE, CONSULTA_CONTRATO, GENERAR_ESTADO_CUENTA
✓ APROBACION (6 permisos): ACTUALIZAR, EXPORTAR_CSV, MODIFICAR_CONTRATO, ENVIAR_PDF, DESCARGAR, APROBACION_AUTONOMA

### **TALERO (15 permisos):**
✓ PERSON (2 permisos): VER_DOCUMENTACION, WHATSAPP
✓ STUDENT (3 permisos): ENVIAR_MENSAJE, CONSULTA_CONTRATO, GENERAR_ESTADO_CUENTA
✓ ACADEMICO (4 permisos): VER_CALENDARIO, VER_AGENDA, FILTRO, VER_AGENDA_ACADEMICA
✓ SERVICIO (6 permisos): Todos los permisos de servicio

### **FINANCIERO (4 permisos):**
✓ PERSON.INFO.DESCARGAR_CONTRATO
✓ PERSON.INFO.VER_DOCUMENTACION
✓ STUDENT.GLOBAL.CONSULTA_CONTRATO
✓ STUDENT.GLOBAL.GENERAR_ESTADO_CUENTA

### **SERVICIO (9 permisos):**
✓ PERSON (2 permisos): VER_DOCUMENTACION, WHATSAPP
✓ STUDENT (1 permiso): ENVIAR_MENSAJE
✓ SERVICIO (6 permisos): WELCOME_CARGAR_EVENTOS, WELCOME_EXPORTAR_CSV, SESIONES_CARGAR_EVENTOS, SESIONES_EXPORTAR_CSV, USUARIOS_ACTUALIZAR, USUARIOS_EXPORTAR_CSV

### **READONLY (2 permisos):**
✓ PERSON.INFO.VER_DOCUMENTACION
✓ STUDENT.GLOBAL.CONSULTA_CONTRATO

---

## Cómo Wix Lo Almacena

Wix almacena la columna `permisos` como un **campo de tipo Array**:

```javascript
// En Wix backend:
const advisor = await wixData.query("ROL_PERMISOS")
  .eq("rol", "ADVISOR")
  .find();

console.log(advisor.items[0].permisos);
// Output:
// [
//   "PERSON.INFO.VER_DOCUMENTACION",
//   "PERSON.INFO.WHATSAPP",
//   "STUDENT.GLOBAL.ENVIAR_MENSAJE",
//   ...
// ]
```

---

## Cómo Next.js Lo Consulta

```typescript
// Next.js hace fetch a Wix:
const response = await fetch('/api/wix-proxy/role-permissions?rol=ADVISOR');
const data = await response.json();

console.log(data.permisos);
// [
//   "PERSON.INFO.VER_DOCUMENTACION",
//   "PERSON.INFO.WHATSAPP",
//   "STUDENT.GLOBAL.ENVIAR_MENSAJE",
//   ...
// ]
```

---

## Resumen

### **¿Dónde están los permisos?**
👉 En la **columna `permisos`** de la tabla **`ROL_PERMISOS`**

### **¿Cómo están almacenados?**
👉 Como un **array JSON** dentro de esa columna

### **¿Por qué no los veo fácilmente en el CSV?**
👉 Porque el CSV tiene todo en una sola línea muy larga. Pero cuando importes a Wix, se verá organizado.

### **Ejemplo concreto:**
```
Fila 3 de la tabla:
- _id: 3
- rol: ADVISOR
- permisos: ["PERSON.INFO.VER_DOCUMENTACION", "PERSON.INFO.WHATSAPP", ...]
              ↑
              AQUÍ ESTÁN - 16 permisos en total
```

---

¿Te queda más claro ahora? Los permisos **SÍ están en el CSV**, solo que en la columna `permisos` como un array JSON.
