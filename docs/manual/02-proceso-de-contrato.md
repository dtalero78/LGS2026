# 02 — Proceso del contrato: reglas de negocio

> Ciclo de vida completo de un contrato en la plataforma LGS: desde que el comercial lo crea hasta que vence o se depura.
> Cada regla tiene un código (**RC-xx**) para poder citarla. Las reglas describen **cómo funciona hoy la plataforma**, verificadas contra el sistema el **06-10-2026** y actualizadas el **08-10-2026** (Kids: país, edad, reserva y matrícula desde la ficha; efectos de inactivar).
> La guía paso a paso para el personal está en [03 — Guía: crear un contrato y aprobarlo](03-guia-crear-contrato-y-aprobacion.md).
> Las reglas generales del negocio (académico, certificados, pagos) están en [01 — Reglas de negocio](01-reglas-de-negocio.md).

---

## Resumen del ciclo

```
 1. CREACIÓN ──► 2. DOCUMENTOS ──► 3. FIRMA ──► 4. APROBACIÓN ──► 5. VIGENCIA ──► 6. VENCIMIENTO
   (Comercial)    (Comercial)      (Cliente)     (Aprobación)       (Servicio /     (automático)
                                                                    Recaudos)
                       ▲                                │
                       └── 7. ANULACIÓN / DEPURACIÓN ◄──┘ (si el contrato no sigue)
```

| Etapa | Quién | Resultado |
|---|---|---|
| 1. Creación | Comercial | Contrato con número asignado, titular, beneficiarios y plan financiero. Estado **SIN APROBAR**. |
| 2. Documentos | Comercial | Documentación y recibo de inscripción adjuntos. |
| 3. Firma | Cliente (o auto-aprobación autorizada) | Consentimiento firmado con código por WhatsApp. |
| 4. Aprobación | Aprobación | Contrato **Aprobado**, beneficiarios con ficha académica y mensaje de bienvenida. |
| 5. Vigencia | Servicio / Recaudos | Clases, pagos, extensiones y pausas (OnHold). |
| 6. Vencimiento | Automático | Contrato **FINALIZADA** y acceso bloqueado. |
| 7. Anulación / depuración | Comercial / Mantenimiento | Contrato anulado y, más adelante, borrado con copia de respaldo. |

---

## 1. Creación del contrato

Pantalla: **Comercial › Crear Contrato**.

### 1.1 Pasos y datos obligatorios

**RC-01 — Pasos del asistente**, en este orden:
1. Asesor
2. Datos básicos
3. Ubicación
4. Adicional
5. Referencias
6. Financiero
7. Beneficiarios

En los contratos de **Empresa** se omite el paso 4.

**RC-02 — Datos obligatorios.** No se puede avanzar sin ellos.

| Paso | Persona natural | Empresa |
|---|---|---|
| Asesor | Nombre y email válido del asesor | Igual |
| Datos básicos | Primer nombre, primer apellido, documento, plataforma (país) y respuesta SÍ/NO a "¿será beneficiario?" | Razón social, RUT, plataforma, y del representante legal: nombre, cargo, documento y celular |
| Ubicación | Fecha de nacimiento, país, domicilio, ciudad y celular | Email, domicilio, ciudad y celular |
| Adicional | Ingresos, email y género | — (se omite) |
| Referencias | Dos referencias completas: nombre, parentesco y teléfono | Igual |
| Financiero | Total del plan (> 0), inscripción (≥ 0), fecha de pago, vigencia y medio de pago | Igual |

> El número de cuotas y el tipo de plan **no son obligatorios** en el formulario.

**RC-03 — "¿Este titular será beneficiario?"** La respuesta SÍ/NO es obligatoria.
- **SÍ:** el titular también toma el programa y se crea automáticamente como beneficiario del contrato.
- **NO:** el titular solo paga. Si además no se agrega ningún beneficiario, el sistema pide confirmar que **nadie** tomará clases.
- En los contratos de **Empresa** el titular nunca es beneficiario.

**RC-04 — Asesor.** El asesor viene precargado desde el CRM y queda registrado en el equipo comercial. El gestor de recaudo inicial de la inscripción es el usuario de ese asesor.

**RC-05 — Borrador automático.** El formulario se guarda solo en el navegador del comercial mientras escribe. Al volver puede continuarlo durante **72 horas**; después se descarta. El borrador nunca guarda número de contrato. Se borra al crear el contrato o al ir a un contrato anterior.

### 1.2 Verificación de documentos (personas ya registradas)

**RC-06 — Cuándo se verifica.**
- El **titular**, al salir del paso Datos básicos.
- Los **beneficiarios**, al pulsar "Crear".

Se busca el número de documento (sin puntos, guiones ni espacios) en los demás contratos.

**RC-07 — Contratos que no cuentan.** La verificación ignora:
- los contratos **finalizados** o **anulados**;
- los **Contrato nulo, Devuelto, Rechazado o Retractado**;
- los **inactivos**, salvo los que están en **OnHold**;
- los **contratos de prueba**.

Un contrato **Aprobado** cuenta como aprobado **tenga o no firma**.

**RC-08 — Qué hace el sistema según el caso.**

| La persona ya aparece como… | Si será beneficiaria (SÍ, o es beneficiario) | Si NO será beneficiaria |
|---|---|---|
| **Beneficiario de un contrato aprobado** | ⛔ **Bloquea.** No puede estar en dos contratos aprobados | Solo informa |
| **Beneficiario de un contrato pendiente** | ⚠️ **Hay que resolver** (ver RC-09) | Solo informa |
| **Titular de un contrato aprobado** | ℹ️ Informa y ofrece **"Traer sus datos"** | Igual |
| **Titular de un contrato pendiente** | ⚠️ **Hay que resolver** (ver RC-09) | Igual |

Mientras haya un bloqueo o un caso por resolver, el contrato no se puede crear.
Los contratos anulados, rechazados o devueltos y la ficha académica anterior se muestran como **antecedentes** informativos y no bloquean.

**RC-09 — Resolver un contrato pendiente anterior.** El comercial tiene dos opciones:
- **Ir al contrato anterior** y completarlo, en vez de crear uno nuevo.
- **Anular el contrato anterior.**
  - Nunca se borra nada: queda **ANULADO**, inactivo y en **Contrato nulo**.
  - Si la persona era titular se anula **todo el contrato**; si era beneficiaria, **solo su registro**.
  - **Prohibido** si el contrato ya está **aprobado**.
  - **Prohibido** si el titular tiene **pagos validados**.
  - Cada anulación queda registrada en el historial de cambios de estado.

**RC-10 — "Traer sus datos".** Cuando el titular ya tiene un contrato aprobado:
- Se pueden copiar sus datos de contacto, perfil y referencias desde su registro más reciente.
- **Solo se rellenan los campos vacíos.**
- **Nunca** se copian el contrato, la aprobación ni los datos financieros.

**RC-11 — Un beneficiario, un contrato vivo.** Una persona puede ser **titular** de varios contratos, pero **beneficiaria** de **uno solo** vigente.
- Si ya es beneficiaria de un contrato **aprobado**, la creación se bloquea.
- Si lo es de uno **sin aprobar**, ese registro anterior se anula automáticamente al crear el nuevo.

**RC-12 — Historial de clases previo.** Si un beneficiario ya tenía clases tomadas en un contrato anterior:
- su historial se **archiva en un PDF**;
- su ficha académica pasa al contrato nuevo.

### 1.3 Número de contrato

**RC-13 — Formato:** `PP-NNNNN-AA`.
- `PP` es el país: **01** Chile · **02** Colombia · **03** Ecuador · **04** Perú.
- `NNNNN` es un consecutivo por país y año. El primero real de cada año es el **10000**.
- `AA` son los dos últimos dígitos del año.

Ejemplo: `01-10738-25`.

**RC-14 — Lo asigna el sistema al crear**, después de pasar todas las verificaciones.
- El formulario no lo reserva antes.
- Dos comerciales creando a la vez **nunca** obtienen el mismo número.
- Un número asignado no se reutiliza.

**RC-15 — Contratos de prueba** (`PRB-NNNNN-AA`):
- Tienen su propio consecutivo, que empieza en 00001, y no consumen números reales.
- No exigen plataforma.
- **No se pueden aprobar.**
- Su PDF lleva marca de agua.
- No se les pueden agregar beneficiarios después de creados.

### 1.4 Tipos de contrato y beneficiarios

**RC-16 — Persona natural o Empresa.** Se elige en el paso Datos básicos.
- En **Empresa**:
  - el país se toma de la plataforma;
  - se registran rubro y representante legal;
  - el titular nunca es beneficiario;
  - el tipo de plan puede ser **Contado, Crédito, Colaborador o Empresa**.
- **SENCE** (Chile) solo aplica a contratos de **Empresa** en **Chile**, y se registra un código SENCE por beneficiario.

**RC-17 — Beneficiarios Kids.**
- El interruptor "Kids" aparece por beneficiario **solo si el Proceso Kids está activado** en Mantenimiento.
- Al marcarlo se registran el curso y los datos del apoderado. Si se cierra sin guardar, el beneficiario deja de ser Kids.
- Un beneficiario Kids **no es alumno del programa de adultos**: al aprobarse **no** se le crea ficha académica ni recibe mensaje de bienvenida.
- **Campaña, curso y salón** se eligen del catálogo del sistema Kids:
  - solo aparecen campañas **en matrícula** y salones **activos** del **país del contrato**. Chile ve solo los salones de Chile; Colombia, Ecuador y Perú, los del grupo general. El servidor rechaza un salón de otro país;
  - en **Crear Contrato** solo se ven salones **con cupo** y **no se muestra el guía**. En la ficha del titular también se ven los **llenos**, en rojo y no seleccionables;
  - el curso **JUNIOR** se muestra en fucsia y el **YOUNGSTER** en azul;
  - el **salón es obligatorio**: sin él no se crea el beneficiario Kids;
  - si el catálogo no responde, el formulario muestra el error y no deja inscribir al niño, para que no quede registrado solo en LGS.
- **Edad y curso** (misma regla del sistema Kids): **JUNIOR = 6 a 9 años**, **YOUNGSTER = 10 a 13 años**, con la edad cumplida **al día de hoy**.
  - El formulario muestra la edad, preselecciona el curso que corresponde y deshabilita el otro.
  - Si no corresponde, un aviso ofrece **cambiar al curso correcto**. Fuera de 6 a 13 años, el niño no puede inscribirse en Kids.
  - El servidor también lo valida antes de crear nada.
- **Apoderado:** si es el titular, se copian sus datos. El **parentesco** siempre se puede editar.
- Su inscripción se envía al sistema Kids como **reserva** del cupo, tanto al **crear el contrato** como al **agregar el beneficiario** desde la ficha.
- La ficha de la persona muestra su estado real en el sistema Kids: **Cursando, Suspendido o No cursando**.
- Si el envío falla, el beneficiario igual se crea y el error queda registrado en su inscripción. En la ficha aparece como **SIN RESERVA EN KIDS**, con el motivo y un botón para corregirlo (RC-37).

### 1.5 Plan financiero

**RC-18 — Cálculos.**
- **Saldo = Total del plan − Inscripción.**
- **Valor de la cuota = Saldo ÷ número de cuotas**, redondeado. Si no hay cuotas es 0.
- La **vigencia** va de **1 a 12 meses**.
- **Fin del contrato = fecha de creación + vigencia.** Al firmar, la fecha de inicio pasa a ser la de la firma.

**RC-19 — Medios de pago según el país.**

| País | Medios de pago |
|---|---|
| Colombia | Transferencia, Epayco, Paypal |
| Ecuador | Transferencia, Datafast, Paypal |
| Chile | Transferencia, Webpay, Paypal |
| Perú | Transferencia, Niubiz |

**RC-20 — Fecha de pago (corte).**
- Es la fecha de la **primera cuota**. Su día del mes es el día de pago de todas las cuotas.
- La cuota *k* vence en **fecha de pago + (k − 1) meses**.

**RC-21 — Inscripción (cuota 0).** Al crear el contrato se registra el pago de inscripción **sin validar**. Recaudos lo valida después en Inscripciones pendientes.

---

## 2. Documentación y recibo

**RC-22 — Un solo botón: "Documentación y recibo".** Abre la misma ventana en tres lugares:
- en el detalle del contrato;
- en la ficha de la persona;
- en Matrículas.

En esa ventana se gestionan la **documentación** del contrato (imágenes o PDF) y el **recibo de inscripción**.

**RC-23 — Permisos.** Subir documentación exige un permiso y eliminarla otro distinto.

**RC-24 — Lectura del recibo con IA.**
- Al subir el recibo de inscripción, la plataforma lee el comprobante:
  - medio de pago, fecha, monto, referencia y banco;
  - nivel de confianza de la lectura.
- Los datos quedan en el titular y en los datos financieros del contrato.
- Exige su propio permiso y que la función **"Leer recibo"** esté encendida. Hoy solo la usan los administradores.
- No aplica a contratos de prueba.

---

## 3. Firma (consentimiento declarativo)

**RC-25 — Envío al cliente.**
- **"Solicitar firma"** envía por WhatsApp el enlace a la página pública del contrato.
- **"Enviar PDF"** envía el contrato en PDF.

**RC-26 — Pasos de la firma**, en la página pública:
1. El cliente escribe su **número de documento**. Se compara sin puntos, guiones ni espacios.
2. Recibe un **código de 6 dígitos** por WhatsApp en el celular del titular.
3. Marca la **declaración jurada**.
4. Ingresa el código y el contrato queda firmado.

**RC-27 — El código.**
- Vale **10 minutos** y sirve **una sola vez**.
- Cada reenvío reemplaza el código anterior. Entre reenvíos hay que esperar 30 segundos.

**RC-28 — Qué se guarda al firmar.**
- Un registro con la declaración, el documento, la fecha y hora, la IP, el navegador y el celular verificado.
- Un **sello digital** (hash SHA-256) que prueba que el contenido no se alteró.

Un contrato **no se puede firmar dos veces**.

**RC-29 — Auto-aprobación del consentimiento.**
- Con un permiso especial, un administrador puede dar por firmado el contrato **sin código**.
- Queda marcado como aprobación **AUTOMÁTICA**, con el nombre del administrador, y se registra en una auditoría propia: contrato, usuario, IP y navegador.

**RC-30 — Después de firmar.**
- El PDF del contrato se archiva en **Google Drive** con el nombre `lgs Nombre Apellido Documento.pdf`.
- Se genera un **anexo de constancia** (`ANEX-`) con clave propia, para no reemplazar el contrato en Drive. No aplica a contratos de prueba.
- Si la **Página de Bienvenida** está activada, el cliente pasa a ella al terminar. El acceso dura 60 minutos.

---

## 4. Aprobación

**RC-31 — Centro de Aprobaciones.**
- Lista los contratos **no aprobados**, sin contar los de prueba. Su estado aparece como **"Firmado sin aprobar"** o **"Sin firmar - Sin aprobar"**.
- Al hacer clic se abre la ficha del titular, que es **donde se aprueba**.
- Desde el Centro también se pueden **borrar** contratos no aprobados, con permiso propio. Antes de borrar se guarda una copia de respaldo.

**RC-32 — Aprobar el contrato** (botón **Aprobar** en la ficha):
- El contrato pasa a **Aprobado**, estado **ACTIVA**, con **fecha de ingreso = hoy**.
- **Aprobar el titular aprueba en cascada a todos sus beneficiarios pendientes** y les copia la fecha de inicio.
- **Aprobar un beneficiario aprueba también al titular** si seguía pendiente.
- Cada beneficiario **adulto**:
  - recibe su **ficha académica** en el nivel **WELCOME**;
  - recibe el **WhatsApp de bienvenida** con su enlace de registro.
- El **usuario de acceso** lo crea el propio alumno desde ese enlace. Aprobar no lo crea.
- Los titulares no reciben ficha académica, salvo que también sean beneficiarios.
- Si el beneficiario **ya tenía ficha académica** de un contrato anterior (re-matrícula), esa ficha pasa a este contrato y su acceso se reactiva, salvo que la ficha pertenezca a un beneficiario activo de otro contrato.
- Los beneficiarios **Kids** quedan aprobados y su reserva se **activa** en el sistema Kids: quedan **matriculados** en su salón. Si la reserva no había llegado a Kids, se crea en ese momento. Al aprobar se muestran su **usuario y contraseña inicial** de Kids, o el error si Kids no lo aceptó.
- Los **contratos de prueba no se pueden aprobar.**

**RC-33 — Aprobar sin firma.** Se puede aprobar un contrato que aún no está firmado. Hoy cerca del **44 %** de los contratos aprobados no tiene firma.

**RC-34 — Estados de aprobación y su efecto.**

| Estado de aprobación | Estado del contrato | Efecto |
|---|---|---|
| *(nuevo, sin decidir)* | **SIN APROBAR** | Estado con el que nace todo contrato y todo beneficiario agregado. Distinto de PENDIENTE |
| **Pendiente** | PENDIENTE | Se puso en espera a propósito (por ejemplo, un aprobado devuelto a Pendiente) |
| **Aprobado** | ACTIVA | Beneficiarios con ficha académica y bienvenida (RC-32) |
| **Contrato nulo / Devuelto / Rechazado** | ANULADO | **Inactiva al titular y a todos sus beneficiarios.** El contrato queda listo para la Limpieza de Anulados |
| **Retractado** | RETRACTADO | **Inhabilita al titular y a todos sus beneficiarios**, incluidos su ficha académica y su acceso. No es un Contrato nulo: tiene su propia pestaña en la Limpieza (ver RC-55) |

**RC-35 — Cambiar un contrato ya aprobado.**
- Solo se hace desde la **ficha del titular**: Administración › Estado del Titular.
- Aparece una **advertencia roja**. Hay que escribir un **motivo de al menos 10 caracteres** y confirmar.
- Un contrato aprobado **no** puede pasar a Contrato nulo, Devuelto ni Rechazado. Solo a **Pendiente** o **Retractado**.
- Volver a **Pendiente** solo se permite:
  - durante el **primer mes** desde el inicio;
  - si **ningún beneficiario avanzó de WELCOME**.

  Al hacerlo se bloquea el acceso de los beneficiarios.
- El Centro de Aprobaciones **no** permite modificar contratos aprobados.

**RC-36 — Historial de cambios de estado.**
- Todo cambio de estado de aprobación queda registrado: quién, cuándo, de qué estado a cuál, por qué vía y con qué motivo.
- Se consulta en la ficha › Administración › **Historial de cambios de estado**, debajo de Gestión de Beneficiarios.
- El registro empezó el **05-10-2026**; los cambios anteriores no quedaron guardados.

---

## 5. Gestión de beneficiarios (contrato ya creado)

Pantalla: ficha del titular › **Administración › Gestión de Beneficiarios**.

**RC-37 — Agregar beneficiario.**
- Datos obligatorios: nombre, apellido, documento, país, fecha de nacimiento, género, ciudad, domicilio, celular y email.
- Hereda del titular el contrato, las fechas y la vigencia, y nace **SIN APROBAR**.
- **No se puede agregar si el documento ya es beneficiario activo** en un contrato vivo, sea este u otro. Al salir de los datos básicos aparece un aviso con el nombre y el contrato donde ya está activo.
- Si el documento solo aparece en contratos **finalizados, anulados o retractados**, o como titular, **sí se puede agregar** (re-matrícula):
  - si tenía clases, su historial se archiva en PDF;
  - al aprobarlo, su ficha académica pasa a este contrato y su acceso se reactiva.
- **Beneficiario Kids desde la ficha:**
  - Se pulsa **Activar Kids**. La ventana Kids **no guarda por sí sola**: con **Continuar →** lleva al paso 2, y el beneficiario se crea con **Crear Beneficiario**. Un aviso confirma si el cupo quedó reservado en Kids.
  - El prefijo del celular se toma del país del contrato.
  - Cada niño muestra su estado: **MATRICULADO**, **RESERVADO** o **SIN RESERVA EN KIDS**.
  - Si falta la reserva, el botón **"Reservar / Matricular en KIDS"** permite elegir de nuevo curso y salón y la envía. Si el niño ya está aprobado, queda matriculado de una vez. Exige el permiso de aprobar beneficiarios.
- La ficha de un **beneficiario Kids** muestra solo Información General y Contacto y Referencias, sin los botones Descargar Contrato ni Documentación y recibo.

**RC-38 — Modificar beneficiario.**
- Se pueden cambiar nombres, documento, fecha de nacimiento, celular, domicilio y email.
- Antes de guardar se muestra un resumen de los cambios.
- Cambiar nombres o documento exige permisos específicos.
- El cambio se aplica también a la ficha académica, al usuario de acceso, a las clases y a los datos financieros.
- **Modificar un beneficiario Kids** abre la ventana Kids con sus datos, su curso y su apoderado:
  - si aún no está en Kids, se puede cambiar el curso y el salón, y se intenta la reserva;
  - si ya está reservado o matriculado, el curso se muestra solo para consulta: **el cambio de salón se hace en el sistema Kids**. En LGS se actualizan el apoderado y el parentesco.

**RC-39 — Inactivar / activar beneficiario** (o todo el contrato, con el interruptor Estado del Contrato).
- Solo si está **aprobado**, con **motivo obligatorio** y con el permiso de activar/desactivar.
- Antes de confirmar, la ventana muestra **"Qué va a pasar"**. Al terminar, un resumen de lo ocurrido queda en el historial de la persona.
- Al **inactivar**:
  - se **bloquea su acceso** y no puede agendar;
  - sus **clases futuras se cancelan** y se libera el cupo;
  - si su **correo lo usa otro beneficiario activo** (hermanos con el correo del apoderado), su acceso **no se bloquea** y se avisa;
  - si la persona **sigue estudiando por otro contrato**, no se tocan sus clases, su ficha académica ni su acceso;
  - si es **Kids**, su contrato en Kids queda **suspendido** y su acceso a Kids bloqueado.
- La **vigencia sigue corriendo**: inactivar no es un OnHold y no devuelve días. El estado del contrato no cambia; se muestra la marca "Suspendida".
- Al **reactivar** se desbloquea el acceso y, si es Kids, se reactiva en Kids, salvo que la pausa la haya puesto el propio sistema Kids. Las clases canceladas no vuelven.

**RC-40 — Eliminar beneficiario.**
- Solo se ofrece para beneficiarios **no aprobados** y **no inactivos**, y exige el permiso de eliminar.
- Un beneficiario **aprobado nunca se elimina**: se inactiva (RC-39).
- Borra su registro. Su ficha académica solo se borra si pertenece a este contrato y **no tiene clases**.

**RC-41 — Convertir titular en beneficiario.**
- Duplica al titular como beneficiario **Pendiente**. La ficha académica y el acceso llegan al aprobarlo.
- Se bloquea si ya existe un beneficiario con el mismo documento, email o celular.

**RC-59 — Editar el contrato** (botón "Editar Contrato" del detalle del contrato).
- Un contrato **sin aprobar** lo puede editar el personal con acceso a Comercial.
- Un contrato **aprobado** solo lo edita un **Super Administrador**. Para los demás, el botón aparece bloqueado con la leyenda "Aprobado · solo Super Admin edita".

---

## 6. Vigencia del contrato

**RC-42 — Fechas.**
- **Inicio** = fecha de creación, reemplazada por la **fecha de firma** al firmar.
- **Fin** = inicio + vigencia en meses.
- Un contrato se considera **vencido** cuando la fecha actual supera en **al menos 2 días** su fecha de fin. Ese día extra de gracia evita bloquear a alumnos de otros husos horarios mientras su último día sigue en curso.

**RC-43 — Extensión manual.**
- Por un número de días o hasta una fecha, siempre con **motivo**, y solo con el permiso de **extender vigencia**.
- Suma al contador de extensiones, queda en el **historial de extensiones** y el estado pasa a **CON EXTENSIÓN**.
- **Reactiva** al alumno, su ficha académica y su acceso.

**RC-44 — OnHold (pausa).**
- **Máximo 2** por contrato.
- **No** se permite si el contrato ya tuvo una extensión manual.
- Al activarlo, el alumno queda **sin acceso** durante la pausa.
- Al terminar, el **fin del contrato se corre por los días pausados**, para que el alumno no pierda días.
- La reactivación ocurre:
  - **manualmente**, desde la ficha;
  - **automáticamente** cada noche, cuando vence la fecha de fin de la pausa;
  - al iniciar sesión el alumno, si su pausa ya terminó.

**RC-45 — Fecha final original y fecha final vigente.**
- Las extensiones, las pausas y los exámenes internacionales se aplican al **alumno**, es decir, al beneficiario.
- Cada vez que cambia la fecha de fin de un beneficiario, el **titular** toma automáticamente la fecha del beneficiario **más extendido**. Si estaba FINALIZADA y esa fecha sigue vigente, vuelve a **ACTIVA**.
- El cambio queda en el **historial de extensiones** del titular como "sincronización". No cuenta como una extensión del titular.
- La **fecha final original**, la del contrato al crearse, **se conserva siempre** y nunca se modifica.
- La ficha muestra ambas: "Final Contrato: 10/10/2026 (original: 21/05/2026)".

**RC-46 — Exámenes internacionales (IELTS, B2 First, TOEFL).**
- Si el alumno **confirma** su inscripción:
  - el contrato se extiende hasta **7 días después del fin del ciclo**;
  - se reactiva;
  - queda en estado **EXAM. INTER.**
- Si **no confirma**, pasa a **DONE** y se bloquea.

---

## 7. Pagos y recaudos durante el contrato

**RC-47 — Registro y validación de pagos.**
- Cada pago se registra con su número de cuota. La **cuota 0** es la inscripción.
- Un pago **validado** queda **bloqueado**:
  - no se puede modificar ni eliminar, aunque sí adjuntarle documentos;
  - solo se facturan pagos validados;
  - impide **anular** el contrato al crear uno nuevo (RC-09) y que la Limpieza lo borre (RC-54).
- Queda registrado quién validó y cuándo. Recaudos puede validar pagos **en bloque**, hasta 500 a la vez.

**RC-48 — Saldo.**
- **Saldo del contrato = Total del plan − (pagos validados + descuentos)**, nunca menor que 0.
- El **Estado de Cuenta** en PDF cuenta **todos** los pagos registrados, validados o no. Por eso su saldo puede diferir del saldo del panel.

**RC-49 — Gestor de recaudo.**
- Cada titular puede tener asignado un ejecutivo de recaudo activo, con rol Asistente o Jefe de Recaudos.
- La asignación masiva admite hasta 2.000 contratos.

**RC-50 — Estado de cartera.**
- Valores: **Normal, Prejurídico, Último Pago o Penalidad**.
- Cambiarlo exige permiso y motivo, y queda un historial que no se puede alterar.
- Un pago de penalidad o un cambio a contado exige nota.

**RC-51 — Cambio a contado.** Si el cliente paga todo de contado:
- dentro de los **30 días** desde la creación del contrato, se atribuye a **Comercial**;
- después, a **Recaudos**.

**RC-52 — Mora.** El contrato está **en mora** cuando tiene **menos cuotas registradas que cuotas vencidas** a la fecha.
- Un contrato con **saldo $0** nunca está en mora.
- El indicador junto a "Corte de Pago" en la ficha financiera muestra **En tiempo / Pagado / En mora**.
- Recaudos ve los contratos en mora en **Recaudos › Usuarios en mora**, que permite:
  - filtrar por gestor de recaudo, nivel de los beneficiarios, plataforma, estado del contrato y estado del certificado;
  - desplegar cada contrato para ver sus beneficiarios.
- ⚠️ Los pagos de cuotas se registran en la plataforma desde **mayo de 2026**. Muchos contratos anteriores aparecen en mora sin estarlo, porque sus cuotas pagadas no se cargaron.

**RC-53 — Certificados y mora.**
- El certificado de nivel **solo se expide si el contrato está al día**.
- Este bloqueo está **apagado por ahora** (Mantenimiento › Bloqueo Certificados por Mora) hasta que los pagos estén completos (ver RC-52).
- Con el bloqueo encendido, el alumno en mora ve la **causa** antes de generar el certificado: cuotas vencidas, corte, días y valor aproximado.
- Recaudos puede **desbloquear** un contrato puntual con motivo, lo que libera a todos sus beneficiarios. También puede **revocar** el desbloqueo.

---

## 8. Anulación y depuración

**RC-54 — Limpieza de Anulados** (Mantenimiento › Contratos).
- **Pestañas:**
  - **Anulados:** Contrato nulo, Devuelto o Rechazado.
  - **Retractados:** contratos retractados (RC-55).
  - **Histórico de borrados:** indica si cada contrato borrado era anulado o retractado.

  Nunca entran contratos aprobados ni de prueba.
- **Cómo se hace:**
  - es una tarea **manual** de Mantenimiento. Una depuración automática queda pendiente de autorización;
  - se pueden seleccionar varios contratos a la vez, hasta 100 por operación;
  - se exige un motivo.
- **Antes de borrar**, cada contrato se respalda **completo**. El respaldo se consulta en la pestaña **Histórico**.
- **Se borra:**
  - el titular y los beneficiarios del contrato;
  - sus datos financieros;
  - sus pagos;
  - sus inscripciones Kids.
- **Se conserva** lo que la persona usa en **otro contrato**:
  - su ficha académica, sus clases y su usuario de acceso;
  - si el documento o el correo también aparecen en otro contrato, esa ficha y ese acceso **no se borran**.
- **Contratos con pagos validados:** se omiten, salvo que se marque una casilla específica y se confirme dos veces.

**RC-55 — Retractado.** Es el cliente que **se retracta dentro del plazo legal**. No es un Contrato nulo.
- Al marcarlo se **inhabilitan** el titular y todos los beneficiarios: quedan inactivos y **sin acceso**, incluidas sus fichas académicas.
- Se puede marcar incluso sobre un contrato **aprobado**, desde la ficha del titular y con motivo (RC-35).
- En la Limpieza tiene su **propia pestaña**, para decidir caso a caso si se borra, con respaldo, o se conserva como histórico. Los que no se borran permanecen en esa pestaña.

---

## 9. Vencimiento

**RC-56 — Proceso nocturno de vencimiento.** Todas las noches, a las 11:00 p. m. de Colombia:
- los beneficiarios **vencidos** (RC-42) que no están en OnHold pasan a **FINALIZADA**, inactivos y sin acceso, junto con su ficha académica;
- su titular queda también **FINALIZADA**.

**RC-57 — Inicio de sesión con contrato vencido.**
- El alumno no puede entrar y el sistema le indica que su contrato **expiró**.
- Si el acceso está bloqueado por otra causa, como OnHold o inactivación, el mensaje es de **bloqueo**.

**RC-58 — Bloqueo manual de contrato** (Mantenimiento).
- Bloquea al titular y a los beneficiarios de un contrato vencido.
- **Respeta a los beneficiarios** que tienen una extensión vigente.

---

## Glosario rápido

| Término | Significado |
|---|---|
| **Titular** | Quien firma y paga el contrato. |
| **Beneficiario** | Quien toma las clases. Puede ser el mismo titular (RC-03). |
| **Ficha académica** | Registro del alumno con su nivel y step. Se crea al aprobar al beneficiario adulto. |
| **Contrato vivo** | Contrato que no está finalizado, anulado, rechazado, devuelto, retractado ni inactivo (salvo OnHold). |
| **Cuota 0** | El pago de inscripción. |
| **Pago validado** | Pago confirmado por Recaudos. Queda bloqueado a cambios. |
| **Contrato de prueba (PRB-)** | Contrato para ensayos. No consume numeración real y no se aprueba. |
| **OnHold** | Pausa temporal del contrato. Corre la fecha de fin por los días pausados. |
