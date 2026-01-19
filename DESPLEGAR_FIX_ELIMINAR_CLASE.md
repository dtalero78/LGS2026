# 🔧 Fix: Corrección de función deleteClass para eliminar correctamente de BOOKING y CLASSES

## 📋 Resumen del problema

La función `deleteClass` no estaba eliminando correctamente las clases porque:

1. **Lógica invertida**: Intentaba eliminar primero de CLASSES usando un `_id` que pertenecía a BOOKING
2. **Fuente de datos**: Las clases mostradas en la tabla del estudiante provienen de un JOIN entre BOOKING y CLASSES, donde el `_id` es de BOOKING
3. **Resultado**: La función retornaba "éxito" sin eliminar nada porque no encontraba el registro en CLASSES

## ✅ Solución implementada

Se corrigió la función `deleteClass` para:

1. **Recibir el `_id` de BOOKING** (no de CLASSES)
2. **Eliminar primero de BOOKING** usando ese `_id`
3. **Buscar y eliminar registros relacionados en CLASSES** usando los campos de relación (`idEvento`, `idEstudiante`, `fechaEvento`)

## 🔄 Cambios realizados

### Archivo modificado: `COPIAR_ESTE_ARCHIVO_A_WIX_search.jsw`

**Antes:**
```javascript
export async function deleteClass(classId) {
    // ❌ Intentaba obtener de CLASSES usando un ID de BOOKING
    const classRecord = await wixData.get('CLASSES', classId);

    // ❌ Eliminaba de CLASSES primero (que fallaba)
    await wixData.remove('CLASSES', classId);

    // ❌ Luego intentaba eliminar de BOOKING (nunca llegaba aquí)
    const bookingQuery = await wixData.query('BOOKING')
        .eq('idEvento', classRecord.idEvento)
        // ...
}
```

**Después:**
```javascript
export async function deleteClass(bookingId) {
    // ✅ Obtiene de BOOKING usando el ID correcto
    const bookingRecord = await wixData.get('BOOKING', bookingId);

    // ✅ Elimina de BOOKING primero
    await wixData.remove('BOOKING', bookingId);

    // ✅ Luego busca y elimina registros relacionados en CLASSES
    const classesQuery = await wixData.query('CLASSES')
        .eq('idEvento', bookingRecord.idEvento)
        .eq('idEstudiante', bookingRecord.idEstudiante)
        .eq('fechaEvento', bookingRecord.fechaEvento)
        .find();

    // ✅ Elimina todos los registros coincidentes en CLASSES
    for (const classRecord of classesQuery.items) {
        await wixData.remove('CLASSES', classRecord._id);
    }
}
```

## 📦 Instrucciones de despliegue

### 1. Copiar el código corregido a Wix

1. Abre el archivo local: `COPIAR_ESTE_ARCHIVO_A_WIX_search.jsw`
2. Copia **TODA la función `deleteClass`** (líneas 420-490)
3. Ve al **Wix Editor** → **Developer Tools** → **Code Files**
4. Abre el archivo `backend/search.jsw`
5. Busca la función `deleteClass` (aprox. línea 420)
6. **Reemplaza toda la función** con el código copiado
7. **Guarda** el archivo (Ctrl+S / Cmd+S)

### 2. Verificar que no haya errores

1. En el Wix Editor, verifica que no aparezcan errores de sintaxis
2. Si hay errores, revisa que hayas copiado la función completa

### 3. Publicar cambios

1. Click en **Publish** en la esquina superior derecha del Wix Editor
2. Espera a que se complete la publicación (~1-2 minutos)

### 4. Verificar en producción

1. Ve a la plataforma Next.js en producción
2. Abre el perfil de un estudiante
3. Haz clic en una clase en la tabla de asistencia
4. Click en **"Eliminar Evento"**
5. Confirma la eliminación
6. **Verifica** que la clase desaparece de la tabla al recargar

## 🧪 Pruebas esperadas

### Logs esperados en la consola de Wix:

```
🗑️ Eliminando evento de clase con BOOKING ID: febdf81a-14a3-4edd-9af2-6e1f4dbab0cc
📋 Datos del booking: {
  idEvento: "abc123...",
  idEstudiante: "def456...",
  fechaEvento: "2025-01-15T10:00:00Z",
  nivel: "BN1",
  step: "Step 3"
}
✅ Evento eliminado de BOOKING
✅ Registro correspondiente eliminado de CLASSES: xyz789...
```

### Comportamiento esperado en el frontend:

1. **Antes de eliminar**: La tabla muestra 2 clases
2. **Confirmación**: Aparece el diálogo "¿Estás seguro...?"
3. **Después de eliminar**: La tabla muestra 1 clase (se recarga automáticamente)
4. **Log en console del navegador**:
   ```
   🗑️ Eliminando clase: febdf81a-14a3-4edd-9af2-6e1f4dbab0cc
   ✅ Clase eliminada exitosamente
   🔄 Recargando datos del estudiante...
   ✅ Datos frescos recibidos: 1 clases  ← Debería mostrar una clase menos
   ```

## 🔍 Casos especiales

### Eventos complementarios
- Algunos eventos pueden estar **solo en CLASSES** (sin registro en BOOKING)
- Ejemplo: Eventos tipo `COMPLEMENTARIA` creados manualmente
- La función maneja este caso y no falla si no encuentra registro en CLASSES

### Eliminación parcial
- Si falla la eliminación en CLASSES, la operación continúa
- El registro ya fue eliminado de BOOKING (principal)
- Se registra un warning en los logs pero no se considera error crítico

## ⚠️ Notas importantes

1. **Backup**: Esta modificación cambia lógica de eliminación. Se recomienda hacer backup de la función original antes de desplegar.

2. **Orden de eliminación**: Ahora se elimina primero de BOOKING (fuente principal) y luego de CLASSES (datos de asistencia).

3. **Relación BOOKING ↔ CLASSES**: Los registros se relacionan por tres campos:
   - `idEvento`: ID del evento en el calendario
   - `idEstudiante`: ID del estudiante (de ACADEMICA)
   - `fechaEvento`: Fecha del evento

4. **No afecta ACADEMICA**: Esta función NO toca la colección ACADEMICA, solo BOOKING y CLASSES.

## 🎯 Archivos afectados

- ✅ `COPIAR_ESTE_ARCHIVO_A_WIX_search.jsw` (función `deleteClass` modificada)
- ⚪ Frontend (`StudentAcademic.tsx`) - Sin cambios necesarios
- ⚪ API proxy (`delete-class/route.ts`) - Sin cambios necesarios

## 📝 Checklist de despliegue

- [ ] Hacer backup de la función `deleteClass` original en Wix
- [ ] Copiar función corregida desde `COPIAR_ESTE_ARCHIVO_A_WIX_search.jsw`
- [ ] Pegar en `backend/search.jsw` en Wix Editor
- [ ] Verificar que no haya errores de sintaxis
- [ ] Guardar archivo en Wix
- [ ] Publicar cambios en Wix
- [ ] Esperar 2-3 minutos para propagación
- [ ] Probar eliminación de una clase en producción
- [ ] Verificar que la clase se elimina correctamente
- [ ] Verificar logs en consola del navegador y de Wix

---

**Fecha de creación**: 2025-01-24
**Desarrollado por**: Claude Code
**Versión**: 1.0
