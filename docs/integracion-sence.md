# Integración con SENCE

> Documento técnico de referencia. Describe únicamente lo que está implementado en el código del repositorio a la fecha de esta entrega.

## 1. Descripción general

**SENCE** (Servicio Nacional de Capacitación y Empleo, Chile) es el organismo estatal que administra la franquicia de capacitación **"Impulsa Personas"**. Cuando una empresa chilena franquicia a un colaborador para tomar el programa de Let's Go Speak (LGS), la OTEC (LGS) debe cumplir dos obligaciones ante SENCE:

1. **Registrar la asistencia** del alumno a cada clase, autenticándolo por **Clave Única** en el portal de SENCE.
2. **Reportar el avance** del alumno en el curso al **SIC** (Sistema Integrado de Capacitación) de SENCE, de forma periódica.

El sistema se comunica con **dos plataformas distintas de SENCE, con protocolos distintos**:

| Proceso | Plataforma SENCE | Protocolo |
|---|---|---|
| Registro de asistencia (inicio/cierre de sesión de clase) | `sistemas.sence.cl` (Clave Única) | Redirección del navegador del alumno vía formulario POST |
| Envío de avance del curso | `auladigital.sence.cl` ("Gestor Intermedio") | API REST server-to-server (JSON) |

Solo aplica a estudiantes marcados explícitamente como **Franquicia SENCE** (campo `sence` en BD), y solo si un interruptor global (feature flag) está activo.

## 2. Flujo de la integración

1. **Marcación del alumno**: al crear un contrato (solo Empresa + plataforma Chile) el comercial puede activar "Franquicia SENCE" para el titular y, por cada beneficiario, marcarlo y opcionalmente indicar su `senceCode` (código de curso). Un admin también puede marcar/desmarcar la franquicia y editar el código desde el detalle del estudiante (`/student/[id]`, sección General).
2. Al aprobar al beneficiario, la marca `sence` y el `senceCode` se propagan de `PEOPLE` a `ACADEMICA` — esta última es la fuente de verdad para el panel del estudiante y el cron.
3. **Antes de la clase**: si el alumno tiene `sence=true`, `senceCode` configurado y el feature flag global está activo, el panel del estudiante muestra el botón **"Iniciar sesión SENCE"** en la misma ventana de tiempo en que aparece el enlace de Zoom (−5 / +10 minutos respecto al inicio del evento). Debe iniciarla **antes** de poder entrar a Zoom.
4. Al hacer clic, el navegador arma y envía un formulario oculto (POST directo, sin AJAX) hacia `sistemas.sence.cl/.../IniciarSesion`. SENCE autentica al alumno por Clave Única y, según el resultado, redirige el navegador de vuelta al sistema (éxito o error).
5. En un login exitoso, el booking del alumno queda marcado con el `idSesionSence` que entrega SENCE. **Ese mismo login cuenta como el "acceso a Zoom"**: activa la ventana de reconexión igual que si el alumno hubiera pulsado el ícono de Zoom.
6. **Al terminar la clase**, un flujo simétrico permite **cerrar** la sesión SENCE (mismo mecanismo de formulario + redirección), quedando registrada la fecha de cierre.
7. **Cada noche**, un proceso automático (cron) revisa qué alumnos SENCE **aprobaron un Jump Step** ese día y arma un reporte de avance por curso, enviándolo a la API de SENCE. **Importante:** Este proceso actualmente no es necesario (y, por ende, está apagado) para el tipo de curso de LGS, por lo que solo basta con el reporte de asistencia de los usuarios. 

## 3. Implementación técnica

### Módulos principales

| Archivo | Responsabilidad |
|---|---|
| `src/lib/sence-config.ts` | Lee credenciales desde variables de entorno y resuelve la URL de acción (`IniciarSesion`/`CerrarSesion`) según ambiente.|
| `src/lib/sence-errors.ts` | Traduce el código `GlosaError` del login/logout a un mensaje legible. |
| `src/types/sence.ts` | Tipos del árbol Curso→Alumno→Módulo→Actividad exigido por el envío de avance, y catálogo de códigos de error de ese servicio. |
| `src/services/sence-feature.service.ts` | Feature flag global (ver más abajo). |
| `src/services/sence-api.service.ts` | Cliente HTTP hacia el Gestor Intermedio (`historialEnvios`, `enviarAvance`, prueba de conexión). |
| `src/services/sence.service.ts` | Orquesta el envío nocturno: arma el payload por curso y llama al cliente HTTP. |
| `src/repositories/booking.repository.ts` | `findSenceAvanceCandidates` (alumnos SENCE con Jump Step aprobado hoy) y `findSenceActivityIds`. |
| `src/repositories/people.repository.ts` | `findContractDatesByNumeroId` (fechas de inicio/fin de contrato para el payload de avance). |
| `src/services/zoom-acceso.service.ts` | `registrarAccesoZoomPorBooking`, llamado desde el callback de retorno de SENCE. |

### Endpoints

| Ruta | Uso | Autenticación |
|---|---|---|
| `POST /api/postgres/students/[id]/sence` | Admin: marcar/desmarcar franquicia + guardar `senceCode`. | Sesión (panel admin) |
| `GET /api/postgres/panel-estudiante/sence-init` | Arma los campos del formulario `IniciarSesion`. | Sesión del estudiante |
| `GET /api/postgres/panel-estudiante/sence-close-init` | Arma los campos del formulario `CerrarSesion`. | Sesión del estudiante |
| `POST /api/sence/retorno` | Callback de SENCE tras login exitoso. Guarda `idSesionSence` y registra el acceso a Zoom. | **Pública** |
| `POST /api/sence/error` | Callback de SENCE tras login fallido. Solo reenvía el código de error al panel. | **Pública** |
| `POST /api/sence/cierre-retorno` | Callback de SENCE tras cierre exitoso. Guarda `senceSessionClosedAt`. | **Pública** |
| `POST /api/sence/cierre-error` | Callback de SENCE tras cierre fallido. | **Pública** |
| `GET /api/cron/sence-envio-avance` | Dispara el envío nocturno de avance. | Header `Authorization: Bearer <CRON_SECRET>` |
| `GET /api/admin/sence/preview-avance` | Solo lectura: arma el payload de avance sin enviarlo (debug). | SUPER_ADMIN/ADMIN |
| `GET / PATCH /api/admin/sence-config` | Consulta/cambia el feature flag global. | GET: cualquier sesión; PATCH: permiso `MANTENIMIENTO.CONTINGENCIA.SENCE_CONFIG` |

Las 4 rutas de callback (`/api/sence/*`) son **públicas a propósito**: SENCE hace un POST cross-site sin la cookie de sesión de NextAuth, por lo que no pueden pasar por el wrapper `handlerWithAuth`. La identidad del alumno ya quedó validada por SENCE vía Clave Única; el sistema solo asocia el resultado al booking mediante el campo `IdSesionAlumno` (= `bookingId`). Estas rutas construyen la URL base de redirección con `NEXTAUTH_URL` (no con `request.url`), porque en producción, detrás de Cloudflare/Digital Ocean, `request.url` resuelve al host interno del contenedor.

### Frontend

- `src/app/panel-estudiante/page.tsx`: botones "Iniciar/Cerrar sesión SENCE", construye el `<form>` oculto y lo envía; muestra `toast` de éxito/error leyendo los query params (`senceLogin`, `senceClose`, `glosaError`) que dejan las rutas de callback.
- `src/components/student/StudentGeneral.tsx`: panel admin para marcar/desmarcar la franquicia y capturar/editar el `senceCode`, controlado por el permiso `STUDENT.GENERAL.FRANQUICIA_SENCE`.
- `src/app/dashboard/comercial/crear-contrato/page.tsx`: checkbox "Franquicia SENCE" a nivel del titular (solo si `tipoPersona='Empresa'` y `plataforma='Chile'`) + marca/código por beneficiario.
- `src/app/admin/sence-config/page.tsx`: switch on/off del proceso, en **Mantenimiento › Contingencia › "Proceso SENCE"**.

### Autenticación con SENCE

- **Registro de asistencia**: no hay token de sesión propio del sistema; cada formulario enviado por el navegador incluye `RutOtec`, `Token`, `CodSence`, `CodigoCurso`, `LineaCapacitacion` y el RUT del alumno. La identidad del alumno la valida SENCE mediante Clave Única (fuera del control de esta aplicación).
- **Envío de avance**: cada request al Gestor Intermedio incluye `rutOtec`, `idSistema` (fijo, `1350`) y `token` en el cuerpo — sin sesión persistente ni renovación de credenciales.

### Reporte de avance

`sence.service.ts` agrupa los alumnos SENCE que **aprobaron un Jump Step** (múltiplo de 5, entre 5 y 45) el día en curso, por `codigoGrupo` (= `senceCode`), y por cada curso arma un envío con: RUT del alumno, % de avance (Step actual / 45), estado (`Cursando` o `Aprobado`), fechas de inicio/fin de contrato, y un único módulo fijo `lgs-course` con la lista de IDs de bookings con asistencia exitosa como "actividades". Esto se envía a `POST /avance-sic/enviarAvance` del Gestor Intermedio.

### Proceso automático (cron)

- `scripts/cron-worker.js` es un **Worker separado** en Digital Ocean (mismo repo e imagen que el servicio web, distinto `run_command`) que usa `node-cron` para invocar diariamente `GET /api/cron/sence-envio-avance` a las **23:00 hora Chile** (dentro de la ventana 22:00–00:00 que exige el instructivo de SENCE).
- Puede desactivarse solo para este cron con la variable `SENCE_CRON_ENABLED=false` en el Worker, sin tocar el endpoint (se puede seguir invocando manualmente).
- Cada corrida queda registrada en la tabla `CRON_RUNS` (vía `recordCronRun`), visible en `GET /api/cron/health-check` bajo la clave `sence-envio-avance`.

## 4. Configuración y variables de entorno

| Variable | Uso | Dónde se lee |
|---|---|---|
| `SENCE_RUT_OTEC` | RUT del OTEC (Let's Go Speak) ante SENCE. Obligatoria. | `sence-config.ts`, `sence-api.service.ts` |
| `SENCE_TOKEN` | Token de autenticación entregado por SENCE. Requerido por el envío de avance; opcional (queda vacío) para el registro de asistencia. | `sence-config.ts`, `sence-api.service.ts` |
| `SENCE_COD_SENCE` | Código SENCE del OTEC/programa. Obligatoria. | `sence-config.ts` |
| `SENCE_AMBIENTE` | `test` o `produccion` — determina la URL base de `sistemas.sence.cl` (`/rcetest/` vs `/rce/`). Default `test` si no se define. | `sence-config.ts` |
| `SENCE_API_BASE_URL` | URL base del Gestor Intermedio (avance). Opcional; default `https://auladigital.sence.cl/gestor/API`. | `sence-api.service.ts` |
| `SENCE_CRON_ENABLED` | `false` desactiva solo la ejecución automática nocturna del cron de avance (sin tocar el endpoint HTTP). Default `true`. | `scripts/cron-worker.js` (Worker) |
| `SENCE_FEATURE_LOCAL` | `true` fuerza el feature flag global activo **solo en el entorno local** (no se despliega). | `sence-feature.service.ts` |

`SENCE_RUT_OTEC`, `SENCE_TOKEN`, `SENCE_COD_SENCE` y `SENCE_AMBIENTE` no llevan ningún valor de ejemplo en el código — deben cargarse como secretos en Digital Ocean.

## 5. Persistencia y datos

| Tabla / campo | Contenido |
|---|---|
| `PEOPLE.sence` (boolean), `PEOPLE.senceCode` (varchar) | Marca de activación y código capturados al crear el contrato (nivel titular/beneficiario). |
| `ACADEMICA.sence` (boolean), `ACADEMICA.senceCode` (varchar) | Copia propagada desde `PEOPLE` al aprobar al beneficiario. **Es la fuente de verdad** consultada por el panel del estudiante y por el cron de avance. |
| `ACADEMICA_BOOKINGS.idSesionSence` (varchar) | ID de sesión que entrega SENCE al iniciar sesión de una clase puntual. |
| `ACADEMICA_BOOKINGS.senceSessionClosedAt` (timestamptz) | Fecha/hora en que se cerró esa sesión SENCE. |
| `APP_CONFIG` (`key='sence_feature_activo'`) | Interruptor global del proceso (`'true'`/`'false'`). |
| `CRON_RUNS` | Histórico de ejecuciones de todos los crons (no exclusivo de SENCE); registra la corrida de `sence-envio-avance` con conteos de éxitos/fallos. |

No existe una tabla propia para el historial de envíos de avance enviados a SENCE — ese historial se puede consultar en vivo contra la propia API de SENCE (`historialEnvios`), y el detalle de la última corrida queda solo en `CRON_RUNS.metadata`.

## 6. Despliegue y operación

- La integración corre sobre **dos componentes** de Digital Ocean, ambos definidos en `.do/app.yaml`: el servicio web `lgs2026` (expone los endpoints `/api/sence/*` y `/api/postgres/.../sence*`) y el Worker `cron-worker` (dispara el envío nocturno). Ambos comparten Dockerfile y repositorio, pero se despliegan y configuran por separado en Digital Ocean.
- Las credenciales SENCE (`SENCE_RUT_OTEC`, `SENCE_TOKEN`, `SENCE_COD_SENCE`, `SENCE_AMBIENTE`) deben estar configuradas en el **servicio web** (quien ejecuta el endpoint real). `SENCE_CRON_ENABLED` es propio del **Worker**.
- El feature flag global (`sence_feature_activo`) **nace desactivado**. Debe activarse manualmente desde **Mantenimiento › Contingencia › "Proceso SENCE"** solo cuando todos los alumnos marcados `sence=true` tengan su `senceCode` cargado — de lo contrario, verían el botón y fallarían al hacer clic.
- El cambio del feature flag tarda hasta ~60 segundos en propagarse (cache en memoria del servicio).
- El endpoint del cron exige `Authorization: Bearer <CRON_SECRET>` — mismo secreto que usan `expire-contracts` y `reactivate-onhold`.

## 7. Consideraciones y troubleshooting

- **No confundir las dos integraciones**: el registro de asistencia habla con `sistemas.sence.cl` mediante redirección del navegador (Clave Única); el envío de avance habla con `auladigital.sence.cl/gestor/API` server-to-server. Tienen catálogos de errores y credenciales distintos, aunque comparten `SENCE_RUT_OTEC`/`SENCE_TOKEN`.
- **Catálogos de error**: `src/lib/sence-errors.ts` traduce el `GlosaError` de login/logout; `SENCE_ERROR_CODES` en `src/types/sence.ts` documenta los códigos del servicio de envío de avance (ambos solo para diagnóstico, no gobiernan lógica de negocio).
- **Requisitos para que un alumno vea el flujo**: `sence=true`, `senceCode` no vacío en `ACADEMICA`, y el feature flag global activo. Si falta cualquiera, el botón "Iniciar sesión SENCE" no aparece y el alumno entra directo a Zoom.
- **Ventana de tiempo estricta**: el login SENCE solo puede iniciarse entre 5 minutos antes y 10 minutos después del inicio del evento (misma ventana del ícono de Zoom); fuera de ese rango el endpoint responde con error de validación.
- **Rutas de callback públicas**: son intencionalmente accesibles sin sesión — si se les agrega autenticación, el flujo de SENCE se rompe (el POST de retorno no trae cookies).
- **Timeout largo**: las llamadas al Gestor Intermedio usan un timeout de 10 minutos, siguiendo la advertencia del instructivo de SENCE sobre demoras del servicio.
- **Solo se reporta avance por Jump Step aprobado el mismo día** (steps múltiplos de 5, entre 5 y 45); avanzar en steps normales no dispara un envío. Alumnos en niveles posteriores a F3 se reportan como 100%/Aprobado.
- **Diagnóstico rápido si deja de funcionar**:
  1. `GET /api/cron/health-check` → estado de la última corrida de `sence-envio-avance` (éxito/fallo, cuántos alumnos procesados).
  2. `GET /api/admin/sence/preview-avance` (SUPER_ADMIN/ADMIN) → revisa el payload que se armaría hoy, sin enviarlo.
  3. Revisar que `senceCode` esté cargado en `ACADEMICA` para los alumnos afectados.
  4. Revisar el estado del feature flag en `/admin/sence-config`.
  5. Confirmar que las variables de entorno SENCE estén presentes en el servicio web (y `CRON_SECRET`/`SENCE_CRON_ENABLED` en el Worker).
