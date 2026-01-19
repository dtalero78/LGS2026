# Cambios en ROL_PERMISOS - Sincronización con Aplicación

**Fecha**: 2025-01-15
**Archivo generado**: `ROL_PERMISOS_ACTUALIZADO.csv`

---

## Resumen de Cambios

### Permisos Agregados (4 nuevos permisos)

Se agregaron los permisos `ACADEMICO.ADVISOR.*` que están activamente en uso en la aplicación pero no existían en el CSV original:

1. **ACADEMICO.ADVISOR.LISTA_VER** - Ver lista de advisors
2. **ACADEMICO.ADVISOR.VER_ENLACE** - Ver enlace de advisor
3. **ACADEMICO.ADVISOR.AGREGAR** - Agregar nuevo advisor
4. **ACADEMICO.ADVISOR.ESTADISTICA** - Ver estadísticas de advisor

Estos permisos son **CRÍTICOS** porque el middleware y el dashboard los usan para controlar acceso a `/dashboard/academic/advisors` y `/panel-advisor`.

---

## Cambios por Rol

### 1. SUPER_ADMIN
**Permisos anteriores**: 41
**Permisos nuevos**: 45 (+4)

**Agregados**:
- ✅ ACADEMICO.ADVISOR.LISTA_VER
- ✅ ACADEMICO.ADVISOR.VER_ENLACE
- ✅ ACADEMICO.ADVISOR.AGREGAR
- ✅ ACADEMICO.ADVISOR.ESTADISTICA

**Razón**: SUPER_ADMIN debe tener todos los permisos del sistema.

---

### 2. ADMIN
**Permisos anteriores**: 40
**Permisos nuevos**: 44 (+4)

**Agregados**:
- ✅ ACADEMICO.ADVISOR.LISTA_VER
- ✅ ACADEMICO.ADVISOR.VER_ENLACE
- ✅ ACADEMICO.ADVISOR.AGREGAR
- ✅ ACADEMICO.ADVISOR.ESTADISTICA

**Razón**: ADMIN debe tener casi todos los permisos (solo sin ELIMINAR personas).

---

### 3. ADVISOR
**Permisos anteriores**: 16
**Permisos nuevos**: 18 (+2)

**Agregados**:
- ✅ ACADEMICO.ADVISOR.LISTA_VER
- ✅ ACADEMICO.ADVISOR.VER_ENLACE

**Razón**: Los advisors deben poder ver la lista de advisors y acceder a su panel.

---

### 4. COMERCIAL
**Sin cambios**: 21 permisos

**Razón**: Comercial no necesita acceso a funcionalidades de advisors.

---

### 5. APROBADOR
**Sin cambios**: 12 permisos

**Razón**: Aprobador solo necesita permisos de aprobación, no de gestión académica.

---

### 6. TALERO ⚠️ CAMBIO MAYOR
**Permisos anteriores**: 15
**Permisos nuevos**: 1 (-14)

**CAMBIO CRÍTICO**: Se eliminaron 14 permisos y se dejó solo:
- ✅ ACADEMICO.ADVISOR.LISTA_VER

**Permisos ELIMINADOS**:
```
❌ PERSON.INFO.VER_DOCUMENTACION
❌ PERSON.INFO.WHATSAPP
❌ STUDENT.GLOBAL.ENVIAR_MENSAJE
❌ STUDENT.GLOBAL.CONSULTA_CONTRATO
❌ STUDENT.GLOBAL.GENERAR_ESTADO_CUENTA
❌ ACADEMICO.AGENDA.VER_CALENDARIO
❌ ACADEMICO.AGENDA.VER_AGENDA
❌ ACADEMICO.AGENDA.FILTRO
❌ ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA
❌ SERVICIO.WELCOME.CARGAR_EVENTOS
❌ SERVICIO.WELCOME.EXPORTAR_CSV
❌ SERVICIO.SESIONES.CARGAR_EVENTOS
❌ SERVICIO.SESIONES.EXPORTAR_CSV
❌ SERVICIO.USUARIOS.ACTUALIZAR
❌ SERVICIO.USUARIOS.EXPORTAR_CSV
```

**Razón**: Según los logs de la sesión anterior, en Wix producción TALERO solo tiene 1 permiso (`ACADEMICO.ADVISOR.LISTA_VER`). El CSV actualizado refleja la configuración real de Wix.

⚠️ **IMPORTANTE**: Si TALERO necesita más permisos, se deben agregar manualmente. La configuración actual es la más restrictiva.

---

### 7. FINANCIERO
**Sin cambios**: 4 permisos

**Razón**: Financiero solo necesita acceso a información de contratos y estados de cuenta.

---

### 8. SERVICIO
**Sin cambios**: 9 permisos

**Razón**: Servicio no necesita acceso a funcionalidades de advisors.

---

### 9. READONLY
**Sin cambios**: 2 permisos

**Razón**: Solo lectura debe mantenerse minimalista.

---

## Resumen Numérico

| Rol | Permisos Anterior | Permisos Nuevo | Diferencia | Módulos con Acceso |
|-----|-------------------|----------------|------------|-------------------|
| SUPER_ADMIN | 41 | 45 | +4 | Todos |
| ADMIN | 40 | 44 | +4 | Todos (sin ELIMINAR) |
| ADVISOR | 16 | 18 | +2 | PERSON, STUDENT, ACADEMICO, SERVICIO.WELCOME |
| COMERCIAL | 21 | 21 | 0 | PERSON, STUDENT, COMERCIAL, APROBACION |
| APROBADOR | 12 | 12 | 0 | PERSON, STUDENT, APROBACION |
| TALERO | 15 | 1 | -14 | ACADEMICO.ADVISOR solo |
| FINANCIERO | 4 | 4 | 0 | PERSON, STUDENT (consultas) |
| SERVICIO | 9 | 9 | 0 | PERSON, STUDENT, SERVICIO |
| READONLY | 2 | 2 | 0 | PERSON, STUDENT (solo lectura) |

**Total de permisos únicos**: 45 permisos

---

## Permisos por Módulo (45 total)

### PERSON.INFO (9 permisos)
```
1. PERSON.INFO.DESCARGAR_CONTRATO
2. PERSON.INFO.VER_DOCUMENTACION
3. PERSON.INFO.ADICION_DOCUMENTACION
4. PERSON.INFO.CAMBIO_CELULAR
5. PERSON.INFO.CAMBIAR_ESTADO
6. PERSON.INFO.MODIFICAR
7. PERSON.INFO.AGREGAR_BENEFICIARIO
8. PERSON.INFO.WHATSAPP
9. PERSON.INFO.ELIMINAR
```

### STUDENT.GLOBAL (3 permisos)
```
10. STUDENT.GLOBAL.ENVIAR_MENSAJE
11. STUDENT.GLOBAL.CONSULTA_CONTRATO
12. STUDENT.GLOBAL.GENERAR_ESTADO_CUENTA
```

### STUDENT.ACADEMIA (3 permisos)
```
13. STUDENT.ACADEMIA.EVALUACION
14. STUDENT.ACADEMIA.AGENDAR_CLASE
15. STUDENT.ACADEMIA.MARCAR_STEP
```

### ACADEMICO.AGENDA (9 permisos)
```
16. ACADEMICO.AGENDA.VER_CALENDARIO
17. ACADEMICO.AGENDA.VER_AGENDA
18. ACADEMICO.AGENDA.FILTRO
19. ACADEMICO.AGENDA.NUEVO_EVENTO
20. ACADEMICO.AGENDA.EDITAR
21. ACADEMICO.AGENDA.ELIMINAR
22. ACADEMICO.AGENDA.CREAR_EVENTO
23. ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA
24. ACADEMICO.AGENDA.VER_ENLACE
```

### ACADEMICO.ADVISOR (4 permisos) ⭐ NUEVOS
```
25. ACADEMICO.ADVISOR.LISTA_VER          ⭐ NUEVO
26. ACADEMICO.ADVISOR.VER_ENLACE         ⭐ NUEVO
27. ACADEMICO.ADVISOR.AGREGAR            ⭐ NUEVO
28. ACADEMICO.ADVISOR.ESTADISTICA        ⭐ NUEVO
```

### SERVICIO.WELCOME (2 permisos)
```
29. SERVICIO.WELCOME.CARGAR_EVENTOS
30. SERVICIO.WELCOME.EXPORTAR_CSV
```

### SERVICIO.SESIONES (2 permisos)
```
31. SERVICIO.SESIONES.CARGAR_EVENTOS
32. SERVICIO.SESIONES.EXPORTAR_CSV
```

### SERVICIO.USUARIOS (2 permisos)
```
33. SERVICIO.USUARIOS.ACTUALIZAR
34. SERVICIO.USUARIOS.EXPORTAR_CSV
```

### COMERCIAL.CONTRATO (4 permisos)
```
35. COMERCIAL.CONTRATO.MODIFICAR
36. COMERCIAL.CONTRATO.ENVIAR_PDF
37. COMERCIAL.CONTRATO.DESCARGAR
38. COMERCIAL.CONTRATO.APROBACION_AUTONOMA
```

### COMERCIAL.PROSPECTOS (1 permiso)
```
39. COMERCIAL.PROSPECTOS.VER
```

### APROBACION.MODIFICAR (6 permisos)
```
40. APROBACION.MODIFICAR.ACTUALIZAR
41. APROBACION.MODIFICAR.EXPORTAR_CSV
42. APROBACION.MODIFICAR.CONTRATO
43. APROBACION.MODIFICAR.ENVIAR_PDF
44. APROBACION.MODIFICAR.DESCARGAR
45. APROBACION.MODIFICAR.APROBACION_AUTONOMA
```

---

## Instrucciones de Importación a Wix

### Opción 1: Importación Manual (Recomendada)
1. Ir a Wix Dashboard → Database Collections → ROL_PERMISOS
2. Hacer backup de la tabla actual (Export CSV)
3. Eliminar todos los registros actuales
4. Importar `ROL_PERMISOS_ACTUALIZADO.csv`
5. Verificar que los 9 roles se importaron correctamente

### Opción 2: Actualización por API
```javascript
// Usar el endpoint update de Wix
import wixData from 'wix-data';

// Para cada rol, actualizar el array de permisos
const rolesActualizados = {
  'SUPER_ADMIN': ["PERSON.INFO.DESCARGAR_CONTRATO", ...],
  'ADMIN': [...],
  // ... etc
};

for (const [rol, permisos] of Object.entries(rolesActualizados)) {
  const item = await wixData.query("ROL_PERMISOS")
    .eq("rol", rol)
    .find();

  if (item.items.length > 0) {
    await wixData.update("ROL_PERMISOS", {
      _id: item.items[0]._id,
      permisos: permisos,
      fechaActualizacion: new Date()
    });
  }
}
```

### Opción 3: Actualización Manual de TALERO (Más Rápida)
Si solo quieres cambiar TALERO:
```javascript
// En Wix Code Editor
import wixData from 'wix-data';

wixData.query("ROL_PERMISOS")
  .eq("rol", "TALERO")
  .find()
  .then((results) => {
    let item = results.items[0];
    item.permisos = ["ACADEMICO.ADVISOR.LISTA_VER"];
    item.fechaActualizacion = new Date();
    return wixData.update("ROL_PERMISOS", item);
  });
```

---

## Verificación Post-Importación

### 1. Verificar Permisos de TALERO
```bash
curl "https://www.lgsplataforma.com/_functions/rolePermissions?rol=TALERO" | jq '.permisos'
```

**Resultado esperado**:
```json
["ACADEMICO.ADVISOR.LISTA_VER"]
```

### 2. Verificar Total de Permisos SUPER_ADMIN
```bash
curl "https://www.lgsplataforma.com/_functions/rolePermissions?rol=SUPER_ADMIN" | jq '.permisos | length'
```

**Resultado esperado**: `45`

### 3. Verificar que ADVISOR tiene permisos ADVISOR
```bash
curl "https://www.lgsplataforma.com/_functions/rolePermissions?rol=ADVISOR" | jq '.permisos | map(select(contains("ACADEMICO.ADVISOR")))'
```

**Resultado esperado**:
```json
[
  "ACADEMICO.ADVISOR.LISTA_VER",
  "ACADEMICO.ADVISOR.VER_ENLACE"
]
```

### 4. Probar Acceso en la Aplicación
1. Login como TALERO
2. Verificar que solo ve sección "Académico" → "Advisors"
3. No debe ver: Agenda Sesiones, Agenda Académica, Servicio, Comercial, Aprobación

---

## Sincronización con Código

Después de importar este CSV a Wix, el código de la aplicación ya está 100% sincronizado:

✅ **Middleware** (`src/lib/middleware-permissions.ts`): Ya tiene los 4 permisos ACADEMICO.ADVISOR.*
✅ **TypeScript Enums** (`src/types/permissions.ts`): Ya tiene definidos todos los permisos
✅ **Dashboard Layout** (`src/components/layout/DashboardLayout.tsx`): Ya filtra por permisos correctos
✅ **API Endpoints**: Ya usan los permisos correctos

**No se requieren cambios en el código** después de importar este CSV.

---

## Notas Importantes

### ⚠️ Sobre TALERO
El cambio más drástico es en TALERO (de 15 permisos a 1). Esto refleja la configuración actual en Wix producción según logs de la sesión anterior. Si TALERO necesita más permisos, actualizar manualmente en Wix después de la importación.

### ✅ Cache de 5 Minutos
Después de importar, la aplicación tomará hasta 5 minutos en reflejar los cambios debido al cache del middleware. Para forzar actualización inmediata:
- Opción 1: Esperar 5 minutos
- Opción 2: Logout/login del usuario
- Opción 3: Reiniciar la aplicación

### 📋 Backup Recomendado
Antes de importar, hacer backup de ROL_PERMISOS actual por si se necesita rollback.

---

## Resultado Final

Después de importar este CSV:
- ✅ 100% sincronización entre Wix y código
- ✅ 45 permisos únicos en el sistema
- ✅ 9 roles completamente funcionales
- ✅ Middleware funcionando con permisos dinámicos de Wix
- ✅ Dashboard mostrando solo opciones autorizadas por rol
- ✅ Sin permisos fantasma o huérfanos

---

**Última actualización**: 2025-01-15
**Estado**: Listo para importación a Wix
