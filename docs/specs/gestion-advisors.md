# Especificación — Administración › Gestión Advisors

> Liquidación de horas de advisors (LGS) y guías (KIDS), verificación de facturas y consolidado de pagos.
> Reemplaza la hoja de Google "*MM Mes AAAA Horas Advisors*" (CONSOLIDACION, DETAIL-CL, DETAIL-COL, DETAIL-ECU, DETAIL-KIDS-CL-ECU).
> Estado: **diseño confirmado (2026-11-03)**, pendiente de implementación.

---

## 1. Reglas de negocio

> **KIDS = LGS.** Las guías Kids se liquidan con **exactamente las mismas reglas** que los advisors LGS: tipos (por horas / semiplanta / planta), tarifas y categorías, festivos, reparto por país, cortes y plazos según el país de la guía, factura con IA, estados, ajustes, bloqueo por grupo, permisos y panel. **Lo único que cambia es la fuente de las horas** (KIDS2026 en vez de `CALENDARIO`). Un solo servicio de liquidación con dos fuentes; nada de lógica duplicada para Kids. Las tarifas KIDS, si no se cargan aparte, toman las de LGS del mismo país/tipo/categoría.

### 1.1 Unidad de pago (LGS y KIDS iguales)
| Evento | Horas |
|---|---|
| Conducted con al menos un asistente | **1** |
| Conducted **sin asistentes** | **0,5** solo para POR_HORAS · **1** para SEMIPLANTA/PLANTA |
| Suspended / Cancelled / No Asistió | **0** (se muestran como información) |

- **LGS conducted** = evento vigente en `CALENDARIO` con ese advisor. **Sin asistentes** = ningún booking del evento con `asistio`/`asistencia = true` (y `cancelo` ≠ true).
- **KIDS conducted** = `scheduling_session` ya ocurrida (no suspendida). **Sin asistentes** = ninguna `attendance_attendance` en `PRESENTE`. La duración real de la sesión **no** cuenta: 1 sesión = 1 hora.
- **Clasificación por tipo** (igual que el informe Horas Advisor actual): sesiones · jumps · training · clubes · welcome · essential · otros, más **festivo** y **exam. intern.** (niveles IELTS/TOEFL/B2FIRST, eventos con `cicloId`).

### 1.2 Festivos
- Hora festiva = el día del evento (en hora local **del advisor**; en KIDS, del salón — `holiday_country`) es festivo de ese país según [src/data/festivos.json](../../src/data/festivos.json) (KIDS: `scheduling_holiday`).
- Domingos no se trabajan (sin regla especial).
- Corrección manual vía **ajuste** (−N NORMAL / +N FESTIVO).

### 1.3 Tipos de advisor (`ADVISORS.tipoContratacion`)
| Tipo | Paga | Factura |
|---|---|---|
| **POR_HORAS** | horas liquidables × tarifa | sí, por corte |
| **SEMIPLANTA** (coordinadores: Dario Rubio, Hernán Tenorio, Andrés Chousal, Shirley en Kids) | valor fijo mensual (cubre horas garantizadas) + **extras autorizadas** × tarifa normal (o festivo) | sí, **una por mes** (fijo + extras) |
| **PLANTA** | sueldo fijo (nómina) | no — solo reporte de horas |

- Horas extra de semiplanta **solo cuentan si se autorizan** (ajuste `EXTRA_AUTORIZADA`).
- Planta/semiplanta guardan en la ficha: valor fijo mensual, horas contratadas/garantizadas, horas de gestión administrativa al mes. **Solo visibles** con `VER_COMPENSACION` (ACADEMICO_JEFE / SUPER_ADMIN).
- Planta y semiplanta muestran **% de cumplimiento** = (dictadas + gestión admin) / contratadas (informativo).

### 1.4 Tarifas
- Tabla `TARIFAS_ADVISOR`: `pais` · `programa` (LGS/KIDS) · `tipo` (POR_HORAS/SEMIPLANTA) · **`categoria`** (ESTANDAR, INTERNACIONAL, …) · `concepto` (NORMAL/FESTIVO/EXAM_INTERN) · `moneda` · `valor` · `vigenteDesde`.
- Historial: cambiar una tarifa = fila nueva. Un corte usa la tarifa vigente al inicio del corte.
- **Sin asistentes** = factor 0,5 sobre NORMAL (no es tarifa).
- **Categoría** en la ficha del advisor (`ADVISORS.categoriaTarifa`, default ESTANDAR). Wilmer Arley y Mariana Rodríguez = Colombia / **INTERNACIONAL** (siguen siendo grupo Colombia en todo lo demás).
- Valores de referencia oct-2026 (los carga el usuario):

| | Normal | Festivo | Exam. Intern. |
|---|---|---|---|
| Colombia (COP) | 25.000 | 37.500 | 40.000 |
| Ecuador (USD) | 5,00 | 7,50 | 8,00 |
| Chile (CLP) | 5.570 | 8.355 | 8.000 |

### 1.5 Reparto entre países
Tres países pagan: **CHILE · COLOMBIA · ECUADOR** (plataforma de los alumnos; **los alumnos de Perú se suman a ECUADOR** — no hay advisors de Perú). Cada hora se carga en proporción a:
1. la plataforma de los **asistentes**;
2. si nadie asistió → la plataforma de los **inscritos**;
3. si no hubo inscritos → el país del advisor.

KIDS usa la misma regla con la plataforma del contrato del niño. Valor fijo de planta/semiplanta y gestión administrativa se reparten igual (proporción de sus horas dictadas).

### 1.6 Monedas y tipo de cambio
- Tabla `TIPO_CAMBIO` (`fecha`, `moneda`, `valor` por USD), llenada a diario: TRM (COP) y dólar observado (CLP). Ecuador = USD.
- Totales siempre en **USD, CLP y COP**.
- Al cerrar el corte se **congela** el valor del día del cierre (editable antes de cerrar, con motivo).

### 1.7 Cortes y plazos (por país del advisor)
| Grupo de pago | Cortes | Plazo factura |
|---|---|---|
| Colombia (incluye guías Kids CO) | 1ra Q (1–15) · 2da Q (16–fin) | **día 20** · **día 5** del mes siguiente |
| Chile | mes | **día 5** del mes siguiente |
| Ecuador | mes | **día 5** del mes siguiente |

- Semiplanta: una factura mensual (plazo día 5).
- Semanas lunes–domingo, cortadas en el borde del mes (vista y ajustes).
- Unidad de liquidación = **advisor × programa × corte**. Quien está en LGS y KIDS factura por separado.

### 1.8 Estados
```
ABIERTO → FACTURA_RECIBIDA → VERIFICADO → PAGADO
              ↓  ↑ (reenvío)
           DEVUELTA
ABIERTO (vence plazo sin factura) → SIN_FACTURA
PLANTA: ABIERTO → VERIFICADO → PAGADO
```
- **ABIERTO**: horas en vivo; **ACADEMICO_JEFE** ajusta y marca **Horas OK** (bandera `horasOk`, se borra si después se agrega un ajuste).
- **FACTURA_RECIBIDA**: el advisor subió el PDF/imagen; la IA la lee y compara (1.9).
- **DEVUELTA**: **ADMINISTRACION** (funcionaria revisora) la devuelve con comentario; el advisor reenvía (el reenvío tiene 2 días aunque venza el plazo).
- **VERIFICADO**: lo marca **ADMINISTRACION**, solo con Horas OK. Congela horas, tarifa y tipo de cambio; listo para pago. La factura queda de **solo lectura** (no se borra ni reemplaza). **Solo SUPER_ADMIN reabre.**
- **PAGADO**: lo registra **ADMINISTRACION_JEFE** (fecha + referencia).
- **SIN_FACTURA**: no subió en plazo. **Bloquea el pago de todo su grupo de país** (no la impresión del Consolidado). El pago **nunca** pasa al mes siguiente ni se pierde. Interruptor `APP_CONFIG.gestion_advisors_bloqueo_grupo` (default true) para cambiar a "solo el advisor".
- Todo cambio queda en `LIQ_ADVISOR_LOG` (solo INSERT).

### 1.9 Lectura de factura (IA)
- Extrae: número, fecha, documento del emisor (RUT/NIT/RUC/cédula), período, horas, **bruto**, retención, líquido.
- Valida (inconsistencia = rojo, visible para los revisores — nunca para el advisor):
  1. documento del emisor = el del advisor;
  2. fecha dentro del mes/quincena del corte;
  3. **horas = horas liquidables** de la plataforma (se corrige con ajuste);
  4. **bruto = horas × tarifa** (+ fijo en semiplanta). Por ahora siempre **bruto** (Chile: la retención SII se muestra pero no se valida).
- Reutiliza el servicio de extracción de recibos/facturas existente ([factura-extract.service.ts](../../src/services/factura-extract.service.ts)), archivos privados en Spaces.

### 1.10 Ajustes
- Movimiento de horas **con signo**, múltiplos de **0,5**, motivo ≥10, alcance **semana** o **total del corte**.
- Conceptos: NORMAL · FESTIVO · EXAM_INTERN · SIN_ASISTENTES · EXTRA_AUTORIZADA (semiplanta) · GESTION_ADMIN (planta/semiplanta).
- Nunca modifica datos de la plataforma: **liquidable = plataforma + Σ ajustes**.
- Solo en estado ABIERTO / FACTURA_RECIBIDA / DEVUELTA.

---

## 2. Pantallas

### 2.1 Sidebar
Grupo nuevo **Administración** › **Gestión Advisors** (`/dashboard/administracion/gestion-advisors`), visible con `ADMINISTRACION.GESTION_ADVISORS.VER`.

### 2.2 Pestaña Consolidado
- Filtros: **mes** (mes corriente = "parcial, al momento de la consulta"; mes verificado = congelado) y **plataforma** (Todos · CL · CO · EC).
- Contenido: la información de la hoja CONSOLIDACION, mejorada:
  - encabezado: mes, tipo de cambio, semáforo de estados por grupo de pago;
  - matriz **Valores a pagar**: filas LGS (por horas / semiplanta / planta), KIDS, gestión admin; columnas **CHILE · COLOMBIA · ECUADOR (incl. Perú) · Total**; cada celda en horas + **USD / CLP / COP**;
  - resumen por grupo de pago (Chile · Colombia 1ra Q · Colombia 2da Q · Ecuador) con bloqueo SIN_FACTURA visible.
- **PDF** (solo con todos VERIFICADOS) y **CSV**, cada uno con su permiso.
- Diseño moderno con la paleta corporativa LGS (azules del logo), fácil de leer.

### 2.3 Pestaña Detalle Advisors
- Selectores tipo hoja: **Todos · Chile · Colombia · Ecuador · Kids**.
  - Un país → tabla con **sus columnas** (CO: 1ra Q / 2da Q / mes; CL-EC: semanas / mes) + subtotal.
  - Todos → secciones apiladas por plataforma, encabezado fijo, subtotal por plataforma y **gran total**.
- Columnas: horas **por semana** y **total mensual**, desglosadas por tipo de evento (semanas contraíbles); ajustes; liquidable; valor (solo `VER_COMPENSACION`); semáforo de factura; estado; acciones (Ajustar · Devolver · Verificar · Pagado).
- Filtros: mes, plataforma, advisor (buscador). **CSV** de lo visible.
- Clic en advisor → eventos (fecha, tipo, inscritos/asistentes, horas, empresa a la que se carga), ajustes, factura y log.

### 2.4 Tarifas (sub-pestaña, permiso `TARIFAS`)
Catálogo de tarifas por país/programa/tipo/categoría/concepto con vigencias.

### 2.5 Panel Advisor (`/panel-advisor`)
- **Mis horas**: corte actual y anteriores, estado, horas por semana y tipo, ajustes con motivo. **Solo horas, sin tarifa ni valores.**
- **Facturas** (pestaña): subir factura/boleta por mes (o quincena), ver comentario de devolución y fecha límite. Verificada = solo lectura.
- Planta: solo Mis horas. Guías KIDS ven solo esta sección.

---

## 3. Permisos (módulo nuevo ADMINISTRACION)
Tres roles: **ACADEMICO_JEFE** revisa horas · **ADMINISTRACION** (rol nuevo, funcionaria que revisa facturas y boletas) · **ADMINISTRACION_JEFE** (ya existe: Mabel Nuñez, Jhon Mario Mejía) paga.

| Permiso | ACADEMICO_JEFE | ADMINISTRACION | ADMINISTRACION_JEFE |
|---|:-:|:-:|:-:|
| `ADMINISTRACION.GESTION_ADVISORS.VER` | ✓ | ✓ | ✓ |
| `…AJUSTAR` | ✓ | | |
| `…HORAS_OK` | ✓ | | |
| `…FACTURA_DEVOLVER` | | ✓ | |
| `…VERIFICAR` | | ✓ | |
| `…REGISTRAR_PAGO` | | | ✓ |
| `…CONSOLIDADO_IMPRIMIR` | | | ✓ |
| `…CONSOLIDADO_EXPORTAR` | | | ✓ |
| `…VER_COMPENSACION` | ✓ | ✓ | ✓ |
| `…TARIFAS` | ✓ | | ✓ |
| `…FICHA_PAGO` | ✓ | | ✓ |

SUPER_ADMIN: todo + reabrir VERIFICADO (fijo por rol). Advisor: sin permiso; su panel valida en servidor que solo vea lo suyo. Todos los endpoints con `handlerWithStaffAuth` + `requirePermission` (panel advisor: sesión + resolución del advisor desde la sesión).

---

## 4. Modelo de datos
**ADVISORS** (columnas nuevas): `tipoContratacion`, `categoriaTarifa`, `programa` (LGS/KIDS/AMBOS), `grupoPago`, `kidsUserId`, `valorFijoMensual`, `horasContratadas`, `horasGestionAdmin`.

**Tablas nuevas**
- `TARIFAS_ADVISOR` — ver 1.4.
- `TIPO_CAMBIO` — `fecha`, `moneda`, `valor`, `fuente`.
- `LIQ_ADVISOR` — una fila por advisor × programa × corte: `periodo` (YYYY-MM), `corte` (MES/Q1/Q2), `estado`, snapshot congelado al verificar (`horas` JSONB por tipo/semana, `tarifas` JSONB, `tipoCambio` JSONB, `reparto` JSONB CHILE/COLOMBIA/ECUADOR, `valor`), `verificadoPor/En`, `pagadoPor/En`, `referenciaPago`.
- `LIQ_ADVISOR_AJUSTES` — `liqId`, `alcance` (SEMANA/TOTAL), `semanaInicio`, `concepto`, `horas`, `motivo`, `usuario`, `_createdDate`.
- `LIQ_ADVISOR_FACTURAS` — `liqId`, `url` (Spaces privado), `nombre`, `tipo`, `extraido` JSONB, `inconsistencias` JSONB, `estado` (RECIBIDA/DEVUELTA/ACEPTADA), `comentarioDevolucion`, `subidoEn`.
- `LIQ_ADVISOR_LOG` — auditoría inmutable de cada transición.

Migraciones en `scripts/` (idempotentes, dry-run por defecto). Nada de DDL en el request path.

## 5. Cambios en KIDS2026
1. `scheduling_session.guia_user_id` (nullable) — se llena con la guía del salón al generar y se edita en reemplazos. Backfill con la guía actual del salón.
2. Endpoint de servicio `GET /api/kids-intake/horas-guias?desde&hasta` (`x-api-key`): por sesión → guía, fecha, salón, país del salón, festivo, inscritos y presentes por plataforma.
3. UI en KIDS para cambiar la guía de una sesión puntual.

---

## 6. Fases
| Fase | Entrega |
|---|---|
| **1. Base** | Migraciones (ADVISORS, tarifas, tipo de cambio, LIQ_*), rol ADMINISTRACION, permisos, grupo del sidebar, pantalla de Tarifas, campos de pago en la ficha del advisor, script de carga inicial desde la hoja |
| **2. Cálculo** | Servicio de liquidación LGS (horas por tipo/semana/corte, sin asistentes, festivos, reparto por empresa, monedas) + pestaña **Detalle** + **Consolidado** en modo lectura → **simulación de octubre 2026 contra la hoja** |
| **3. KIDS** | Cambios en KIDS2026 (sección 5) + integración en Detalle/Consolidado |
| **4. Flujo** | Ajustes, panel advisor (Mis horas + Facturas), lectura IA, estados, plazos, bloqueo por grupo, verificar/pagar/reabrir, PDF y CSV, log → **noviembre 2026 en paralelo con la hoja** |
| **5. Producción** | Ajustes finales con facturas reales de prueba → **diciembre 2026 paga el sistema** |

## 7. Hallazgos de la carga inicial (2026-11-03)
- **Cuentas múltiples de una misma persona**: Dario Rubio (2 ADVISORS), Hernán Tenorio (2), y en KIDS Shirley y Verónica (usuario guía + coordinadora). La Fase 2 debe **sumar las cuentas de una persona en una sola liquidación** (p. ej. `ADVISORS.liquidaConId` → cuenta principal).
- **KIDS aún no estabilizado** (decisión del usuario): guías y horas Kids se toman **de KIDS**; se cuadrará contra la hoja cuando KIDS termine de implementarse. En oct-2026 había 138 sesiones en salones sin guía y casi sin asistencia marcada (con la regla de ½ hora sin asistentes se pagaría la mitad).
- Kids en la hoja: cada guía cobra con la **tarifa LGS de su país** (CL 5.570 CLP, CO 25.000 COP, EC 5 USD), festivo 1,5×.
- INTERNACIONAL (Colombia) = normal 30.000 COP; festivo y exam. intern. iguales al estándar.
- Carga: [cargar-gestion-advisors-hoja.js](../../scripts/cargar-gestion-advisors-hoja.js) (fichas, 7 guías KIDS creadas con su `kidsUserId`, 24 tarifas desde 2026-10-01).

## 8. Pendientes del usuario
- Cargar tarifas (incl. categoría INTERNACIONAL de Colombia).
- Revisar tipo/categoría/grupo de cada advisor tras la carga inicial.
- Conseguir facturas y boletas reales de prueba (CL, CO, EC, semiplanta).
- Confirmar quién recibe el rol ADMINISTRACION.
