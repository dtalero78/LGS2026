# Feature: ¿Cómo voy? - Diagnóstico Académico del Estudiante

## Descripción General

Implementación de la funcionalidad "¿Cómo voy?" que genera un diagnóstico académico completo del estudiante, mostrando estadísticas de asistencia, participación, progreso en steps, y últimas clases.

## Arquitectura

### Backend (Wix)

#### 1. Función: `getStudentProgress`
**Archivo**: `src/backend/FUNCIONES WIX/search.jsw` (líneas 4700-4912)

**Responsabilidades**:
- Consultar datos del estudiante desde `ACADEMICA`
- Consultar historial de clases desde `CLASSES`
- Calcular estadísticas académicas
- Generar HTML del diagnóstico con diseño responsive

**Entrada**:
```javascript
studentId: string  // ID del estudiante en ACADEMICA
```

**Salida**:
```javascript
{
  success: true,
  data: {
    diagnosticoHTML: string,        // HTML renderizable del diagnóstico
    estadisticas: {
      totalClases: number,
      clasesAsistidas: number,
      clasesConParticipacion: number,
      porcentajeAsistencia: number,
      porcentajeParticipacion: number,
      stepsCompletados: number,
      stepMasAlto: number,
      tiposEvento: Record<string, number>
    },
    ultimasClases: Array<{
      fecha: string,
      tipo: string,
      nivel: string,
      step: string,
      asistio: boolean,
      participo: boolean,
      advisor?: string
    }>,
    estudiante: {
      nombre: string,
      nivel: string,
      step: string
    }
  }
}
```

**Características del HTML generado**:
- ✅ Diseño con gradientes y colores modernos
- ✅ 4 tarjetas de estadísticas principales (Total Clases, Asistencia %, Participación %, Steps)
- ✅ Distribución de clases por tipo
- ✅ Últimas 5 clases con detalles
- ✅ Mensaje motivacional basado en el rendimiento
- ✅ Diseño responsive con inline styles

#### 2. HTTP Endpoint
**Archivo**: `src/backend/FUNCIONES WIX/http-functions.js` (líneas 425-471)

**Endpoints**:
- `GET /studentProgress?id={studentId}` - Obtiene diagnóstico
- `OPTIONS /studentProgress` - CORS preflight

### Frontend (Next.js)

#### 1. API Proxy Route
**Archivo**: `src/app/api/wix-proxy/student-progress/route.ts`

**Endpoint**: `GET /api/wix-proxy/student-progress?id={studentId}`

**Responsabilidades**:
- Proxy hacia la API de Wix
- Validación de parámetros
- Manejo de errores

#### 2. Componente `StudentProgress`
**Archivo**: `src/components/student/StudentProgress.tsx`

**Props**:
```typescript
{
  student: Student  // Datos del estudiante
}
```

**Características**:
- ✅ Carga automática del diagnóstico al montar
- ✅ Loading state con spinner
- ✅ Error handling con botón de reintento
- ✅ Renderizado seguro de HTML con `dangerouslySetInnerHTML`
- ✅ Botón de actualización manual
- ✅ Responsive y accesible

#### 3. Integración en `StudentTabs`
**Archivo**: `src/components/student/StudentTabs.tsx`

**Cambios**:
1. Importar `StudentProgress`
2. Agregar opción "¿Cómo voy?" al submenú académico (línea 44)
3. Renderizar `StudentProgress` cuando `academicView === 'progress'` (líneas 58-61)

**UX del submenú**:
- Tabla de Asistencia
- 📈 **¿Cómo voy?** (NUEVO)
- 📅 Agendar Nueva Clase
- 📊 Gestión de Steps (condicional según permisos)

## Flujo de Datos

```
Usuario click "¿Cómo voy?"
    ↓
StudentTabs setea academicView='progress'
    ↓
Renderiza StudentProgress component
    ↓
useEffect → fetch /api/wix-proxy/student-progress?id={studentId}
    ↓
Next.js API proxy → fetch Wix _functions/studentProgress
    ↓
Wix getStudentProgress function
    ↓
Query ACADEMICA + CLASSES
    ↓
Calcular estadísticas
    ↓
Generar diagnosticoHTML
    ↓
Return data → Next.js → StudentProgress
    ↓
Render HTML con dangerouslySetInnerHTML
```

## Estadísticas Calculadas

### 1. Total de Clases
Cuenta todas las clases del estudiante en `CLASSES`

### 2. Asistencia
```javascript
clasesAsistidas = classes.filter(c => c.asistencia === true || c.asistencia === 'Sí').length
porcentajeAsistencia = (clasesAsistidas / totalClases) * 100
```

### 3. Participación
```javascript
clasesConParticipacion = classes.filter(c => c.participacion === true || c.participacion === 'Sí').length
porcentajeParticipacion = (clasesConParticipacion / totalClases) * 100
```

### 4. Steps Completados
```javascript
clasesNivelActual = classes.filter(c => c.nivel === student.nivel && c.asistencia)
stepsCompletados = [...new Set(clasesNivelActual.map(c => c.step))].length
stepMasAlto = Math.max(...clasesNivelActual.map(c => parseInt(c.step)))
```

### 5. Distribución por Tipo
Agrupa y cuenta clases por `tipoEvento`:
- REGULAR
- COMPLEMENTARIA
- CLUB
- Etc.

### 6. Últimas 5 Clases
Muestra las 5 clases más recientes con:
- Fecha formateada
- Tipo de evento
- Nivel y Step
- Asistencia (✅/❌)
- Participación (✅/❌)
- Nombre del Advisor

## Mensajes Motivacionales

```javascript
porcentajeAsistencia >= 80
  ? '🎉 ¡Excelente progreso! Sigue así.'
  : porcentajeAsistencia >= 60
    ? '💪 ¡Buen trabajo! Continúa esforzándote.'
    : '📚 Recuerda: la constancia es clave para el éxito.'
```

## Mejora de UX del Submenú

Además de la funcionalidad "¿Cómo voy?", se mejoró la experiencia del submenú Académica para evitar cierres accidentales:

**Archivo**: `src/components/student/StudentTabs.tsx`

### Problemas solucionados:
1. ❌ **Antes**: El submenú se cerraba inmediatamente al mover el mouse
2. ✅ **Ahora**: Delay de 150ms antes de cerrar
3. ✅ Padding invisible mantiene el área de hover activa
4. ✅ Cancelación del timeout al volver al menú

### Implementación:
```typescript
const [closeTimeout, setCloseTimeout] = useState<NodeJS.Timeout | null>(null)

const handleMouseEnter = () => {
  if (closeTimeout) {
    clearTimeout(closeTimeout)
    setCloseTimeout(null)
  }
  setShowAcademicSubmenu(true)
}

const handleMouseLeave = () => {
  const timeout = setTimeout(() => {
    setShowAcademicSubmenu(false)
  }, 150) // 150ms delay
  setCloseTimeout(timeout)
}
```

## Deployment

### 1. Backend Wix
1. Abrir Wix Editor → Velo
2. Actualizar `backend/search.jsw` con función `getStudentProgress`
3. Actualizar `backend/http-functions.js` con endpoint `get_studentProgress`
4. Publicar sitio

### 2. Frontend Next.js
```bash
# Los cambios ya están en el código
git add .
git commit -m "feat: implementar diagnóstico académico ¿Cómo voy?"
git push
```

### 3. Verificación
1. Navegar a `/student/[id]`
2. Click en tab "Académica"
3. Click en "¿Cómo voy?" en el submenú
4. Verificar que carga el diagnóstico correctamente

## Testing

### Test Manual
1. **Estudiante con clases**:
   - ✅ Muestra estadísticas correctas
   - ✅ Muestra últimas 5 clases
   - ✅ Calcula porcentajes correctamente
   - ✅ Mensaje motivacional apropiado

2. **Estudiante sin clases**:
   - ✅ Muestra 0 en todas las estadísticas
   - ✅ Mensaje "No hay clases registradas"

3. **Error handling**:
   - ✅ Muestra mensaje de error si falla la carga
   - ✅ Botón de reintento funciona

4. **Performance**:
   - ✅ Loading spinner mientras carga
   - ✅ Botón de actualizar recarga los datos

## Archivos Modificados/Creados

### Creados:
- ✅ `src/backend/FUNCIONES WIX/search.jsw` (función `getStudentProgress` agregada al final)
- ✅ `src/app/api/wix-proxy/student-progress/route.ts`
- ✅ `src/components/student/StudentProgress.tsx`
- ✅ `FEATURE_COMO_VOY.md` (este archivo)

### Modificados:
- ✅ `src/backend/FUNCIONES WIX/http-functions.js` (endpoint agregado)
- ✅ `src/components/student/StudentTabs.tsx` (integración + mejora UX submenú)
- ✅ `src/app/login/page.tsx` (credenciales de prueba eliminadas)
- ✅ `src/config/permissions.ts` (permiso renombrado)

## Futuras Mejoras

1. **Exportar diagnóstico a PDF**
2. **Comparativa con promedio de otros estudiantes**
3. **Gráficos interactivos** (Chart.js o Recharts)
4. **Histórico de diagnósticos** (ver progreso en el tiempo)
5. **Recomendaciones personalizadas** basadas en IA
6. **Compartir diagnóstico** vía email o WhatsApp
7. **Agregar permisos específicos** para controlar quién ve "¿Cómo voy?"

## Notas Técnicas

- El HTML del diagnóstico se genera en backend para mejor performance
- Se usa `dangerouslySetInnerHTML` con HTML confiable generado por el backend
- Los inline styles garantizan que el diseño funcione sin CSS externo
- El componente es completamente self-contained y reutilizable
- No hay dependencias externas adicionales

## Soporte

Para dudas o issues relacionados con esta funcionalidad:
1. Revisar logs en consola del navegador
2. Verificar que el endpoint de Wix esté respondiendo
3. Verificar que el estudiante tenga clases registradas
4. Comprobar que los datos en `ACADEMICA` y `CLASSES` sean correctos
