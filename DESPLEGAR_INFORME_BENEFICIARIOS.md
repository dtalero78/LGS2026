# Guía de Despliegue: Informe de Beneficiarios

## 📋 Descripción
Esta funcionalidad agrega un nuevo botón "Informes" en el menú Académico con un submenú que incluye el reporte "Beneficiarios por Fecha". Este informe permite consultar todos los beneficiarios creados en un rango de fechas específico, mostrando cuántas sesiones tiene registradas cada uno en CLASSES.

## 🎯 Funcionalidad Implementada
- **Nuevo botón en el menú**: "Informes" bajo la sección Académica
- **Submenú con informes**: Primer informe "Beneficiarios por Fecha"
- **Filtrado por fecha**: Busca beneficiarios por `fechaContrato` en PEOPLE
- **Conteo de sesiones**: Para cada beneficiario, cuenta sus sesiones en CLASSES usando el campo `numeroId`
- **Exportación CSV**: Permite descargar los resultados en formato CSV

## 📁 Archivos Creados/Modificados

### Frontend (Next.js)
1. **Página del informe**: `src/app/dashboard/academic/informes/beneficiarios/page.tsx`
2. **Endpoint API**: `src/app/api/informes/beneficiarios/route.ts`
3. **Menú actualizado**: `src/components/layout/DashboardLayout.tsx`
4. **Permisos**: `src/types/permissions.ts`

### Backend (Wix)
5. **Función nueva**: `src/backend/FUNCIONES WIX/search.jsw` - función `getBeneficiariosByDateRange`

## 🚀 Pasos de Despliegue

### Paso 1: Desplegar Backend en Wix

1. **Abrir Wix Editor**
   - Ir a https://www.wix.com/
   - Abrir tu sitio de Let's Go Speak
   - Ir al panel de "Code" (Velo)

2. **Editar archivo search.jsw**
   - Navegar a `Backend` → `search.jsw`
   - Ir al **FINAL del archivo** (después de la última función)

3. **Agregar la nueva función** (copiar desde línea 5702 hasta 5786 de search.jsw):

```javascript
/**
 * Obtiene todos los beneficiarios en un rango de fechas con su total de sesiones
 * @param {string} fechaInicio - Fecha de inicio (YYYY-MM-DD)
 * @param {string} fechaFin - Fecha de fin (YYYY-MM-DD)
 * @returns {Object} - Lista de beneficiarios con total de sesiones
 */
export async function getBeneficiariosByDateRange(fechaInicio, fechaFin) {
  try {
    console.log('📊 Obteniendo beneficiarios por rango de fechas:', { fechaInicio, fechaFin });

    if (!fechaInicio || !fechaFin) {
      return {
        success: false,
        error: 'fechaInicio y fechaFin son requeridos'
      };
    }

    // Convertir fechas a objetos Date
    const startDate = new Date(fechaInicio);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(fechaFin);
    endDate.setHours(23, 59, 59, 999);

    console.log('📅 Rango de fechas convertido:', {
      inicio: startDate.toISOString(),
      fin: endDate.toISOString()
    });

    // Buscar beneficiarios en PEOPLE por rango de fechas en fechaContrato
    const peopleQuery = await wixData.query('PEOPLE')
      .eq('tipoUsuario', 'BENEFICIARIO')
      .between('fechaContrato', startDate, endDate)
      .ascending('fechaContrato')
      .limit(1000)
      .find();

    console.log(`✅ Beneficiarios encontrados: ${peopleQuery.items.length}`);

    // Para cada beneficiario, contar sus sesiones en CLASSES
    const beneficiariosConSesiones = await Promise.all(
      peopleQuery.items.map(async (beneficiario) => {
        // Buscar en CLASSES usando numeroId (que referencia al _id de PEOPLE)
        const classesQuery = await wixData.query('CLASSES')
          .eq('numeroId', beneficiario._id)
          .count();

        const totalSesiones = classesQuery;

        console.log(`👤 ${beneficiario.primerNombre} ${beneficiario.primerApellido}: ${totalSesiones} sesiones`);

        return {
          _id: beneficiario._id,
          primerNombre: beneficiario.primerNombre || '',
          segundoNombre: beneficiario.segundoNombre || '',
          primerApellido: beneficiario.primerApellido || '',
          segundoApellido: beneficiario.segundoApellido || '',
          numeroId: beneficiario.numeroId || '',
          email: beneficiario.email || '',
          celular: beneficiario.celular || '',
          plataforma: beneficiario.plataforma || '',
          fechaContrato: beneficiario.fechaContrato ? beneficiario.fechaContrato.toISOString() : '',
          contrato: beneficiario.contrato || '',
          totalSesiones: totalSesiones
        };
      })
    );

    console.log(`✅ Informe completado: ${beneficiariosConSesiones.length} beneficiarios procesados`);

    return {
      success: true,
      beneficiarios: beneficiariosConSesiones,
      total: beneficiariosConSesiones.length
    };

  } catch (error) {
    console.error('❌ Error obteniendo beneficiarios por fecha:', error);
    return {
      success: false,
      error: 'Error obteniendo beneficiarios',
      details: error.message
    };
  }
}
```

4. **Guardar y Publicar**
   - Click en "Save" (guardar)
   - Click en "Publish" (publicar)
   - Esperar a que se complete la publicación

### Paso 2: Verificar Permisos en Wix

1. **Ir a la tabla ROL_PERMISOS**
   - Panel de Wix → Content Manager → ROL_PERMISOS

2. **Agregar permisos a los roles que necesiten acceso**

   Agregar estos 3 permisos a los roles que deben ver el informe (por ejemplo, ADMIN, SUPER_ADMIN, COMERCIAL):
   ```
   ACADEMICO.INFORMES.VER
   ACADEMICO.INFORMES.BENEFICIARIOS
   ACADEMICO.INFORMES.EXPORTAR
   ```

   **Ejemplo para ADMIN**:
   - Buscar el registro con `rol = "ADMIN"`
   - En el campo `permisos` (array), agregar las 3 líneas anteriores
   - Guardar

### Paso 3: Desplegar Frontend (Digital Ocean)

El código del frontend ya fue creado en este proyecto. Simplemente necesitas hacer el despliegue normal:

```bash
# 1. Commit de los cambios
git add .
git commit -m "feat: agregar informe de beneficiarios por fecha"

# 2. Push al repositorio
git push origin main

# 3. Digital Ocean se encargará del despliegue automático
```

## 🧪 Pruebas

### 1. Verificar que el menú aparece
- Iniciar sesión en el Admin Panel
- Ir a la sección "Académico" en el sidebar
- Verificar que aparece el nuevo botón "Informes"
- Click en "Informes" → debe mostrar "Beneficiarios por Fecha"

### 2. Probar el informe
- Click en "Beneficiarios por Fecha"
- Seleccionar una fecha de inicio (ejemplo: 01/01/2025)
- Seleccionar una fecha de fin (ejemplo: 31/12/2025)
- Click en "Buscar"
- Verificar que aparece la tabla con los beneficiarios
- Verificar que la columna "Total Sesiones" muestra números correctos

### 3. Probar exportación
- Con resultados en la tabla, click en "Exportar CSV"
- Verificar que se descarga el archivo CSV
- Abrir el archivo y verificar que los datos son correctos

## 🔍 Troubleshooting

### Error: "No autenticado"
**Solución**: Cerrar sesión y volver a iniciar sesión en el Admin Panel.

### Error: "Error en Wix API"
**Solución**:
1. Verificar que la función `getBeneficiariosByDateRange` fue publicada en Wix
2. Revisar la consola de Wix (Site Events) para ver logs de error
3. Verificar que las colecciones PEOPLE y CLASSES tienen permisos de lectura

### No aparece el botón "Informes"
**Solución**:
1. Verificar que el usuario tiene al menos uno de los permisos:
   - `ACADEMICO.INFORMES.VER`
   - `ACADEMICO.INFORMES.BENEFICIARIOS`
2. Revisar la tabla ROL_PERMISOS en Wix
3. Limpiar caché del navegador y volver a cargar

### La tabla está vacía
**Solución**:
1. Verificar que hay beneficiarios en PEOPLE con `tipoUsuario = "BENEFICIARIO"`
2. Verificar que los beneficiarios tienen el campo `fechaContrato` con valor
3. Ampliar el rango de fechas de búsqueda
4. Revisar logs en la consola del navegador (F12)

## 📊 Estructura de Datos

### Campos que se buscan en PEOPLE:
- `tipoUsuario` (debe ser "BENEFICIARIO")
- `fechaContrato` (filtro por rango de fechas)
- `_id` (para cruzar con CLASSES)
- Campos de información personal (nombre, email, celular, etc.)

### Campos que se buscan en CLASSES:
- `numeroId` (debe coincidir con `_id` de PEOPLE)
- Cuenta total de registros por beneficiario

## ✅ Checklist de Despliegue

- [ ] Función `getBeneficiariosByDateRange` agregada en Wix search.jsw
- [ ] Función publicada en Wix (Save + Publish)
- [ ] Permisos agregados en tabla ROL_PERMISOS de Wix
- [ ] Código frontend commiteado y pusheado a main
- [ ] Despliegue completado en Digital Ocean
- [ ] Prueba: Menú "Informes" visible
- [ ] Prueba: Búsqueda funciona correctamente
- [ ] Prueba: Exportación CSV funciona
- [ ] Prueba: Conteo de sesiones es correcto

## 📝 Notas Adicionales

- La función usa paginación con límite de 1000 beneficiarios. Si esperas más de 1000, será necesario implementar paginación adicional.
- El conteo de sesiones se hace de forma asíncrona para cada beneficiario, por lo que puede tardar unos segundos si hay muchos resultados.
- La exportación CSV usa formato estándar con comillas para evitar problemas con comas en los datos.
- El informe solo muestra beneficiarios (no titulares). Para agregar titulares, modificar el filtro `eq('tipoUsuario', 'BENEFICIARIO')`.

## 🔄 Futuras Mejoras

Posibles informes adicionales que se pueden agregar al submenú "Informes":
1. Titulares por fecha
2. Asistencia por nivel
3. Desempeño de advisors
4. Progreso por steps
5. Sesiones por tipo de evento

Para agregar más informes, seguir la misma estructura:
1. Crear página en `src/app/dashboard/academic/informes/[nombre-informe]/page.tsx`
2. Crear endpoint en `src/app/api/informes/[nombre-informe]/route.ts`
3. Agregar función en Wix search.jsw
4. Agregar al submenú en DashboardLayout.tsx
5. Agregar permisos necesarios
