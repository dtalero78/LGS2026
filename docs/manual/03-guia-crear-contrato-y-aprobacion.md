# 03 — Guía paso a paso: crear un contrato y aprobarlo

> Guía práctica para el personal de **Comercial** y de **Aprobación** de Let's Go Speak.
> Explica, en el orden en que se hacen, los pasos para **crear un contrato** en la plataforma, **completarlo**, **hacerlo firmar** y **aprobarlo**, incluidos los beneficiarios **Kids**. El capítulo 6 reúne el programa **Kids** de principio a fin.
> Describe cómo funciona la plataforma al **08-10-2026**.
> Las reglas citadas como **RC-xx** están en [02 — Proceso del contrato](02-proceso-de-contrato.md); las generales del negocio, en [01 — Reglas de negocio](01-reglas-de-negocio.md).

---

## 0. Visión general

| Paso | Quién lo hace | Dónde | Resultado |
|---|---|---|---|
| 1. Crear el contrato | Comercial | Comercial › Crear Contrato | Contrato con número, en estado **Pendiente** |
| 2. Adjuntar documentos y recibo | Comercial | Detalle del contrato › Documentación y recibo | Cédulas, comprobantes y recibo de inscripción adjuntos |
| 3. Hacer firmar al cliente | Comercial / Cliente | Detalle del contrato › Solicitar firma | Contrato **firmado** con código por WhatsApp |
| 4. Aprobar | Aprobación | Aprobación › ficha del titular | Contrato **Aprobado**; alumnos con acceso o matriculados en Kids |

Un contrato tiene siempre:

- **Un titular**: quien firma y paga. Puede ser una persona natural o una empresa.
- **Uno o más beneficiarios**: quienes toman las clases. El titular puede ser también beneficiario.
- **Un plan financiero**: valor total, inscripción, cuotas, fecha de pago y vigencia.

Los beneficiarios pueden ser de dos programas:

- **Adultos** (programa de inglés de LGS): al aprobarse reciben su ficha académica y un WhatsApp para crear su usuario.
- **Kids** (programa infantil): se inscriben en un curso y un salón del sistema Kids, y allí reciben su usuario.

---

## 1. Crear el contrato

Menú: **Comercial › Crear Contrato**.

### 1.1 Antes de empezar

- Tenga a mano el documento, la fecha de nacimiento, el celular y el correo del titular y de cada beneficiario.
- Para beneficiarios **Kids**, tenga además la **fecha de nacimiento del niño**, el **curso y horario** acordados con la familia y los datos del **apoderado**.
- El formulario se guarda solo mientras escribe. Si cierra la página, al volver puede **continuar el borrador** durante 72 horas (RC-05).

### 1.2 Los pasos del asistente

El asistente tiene siete pasos. En contratos de **Empresa** se omite el paso 4 (RC-01).

1. **Asesor.** Nombre y correo del asesor comercial. Normalmente vienen precargados.
2. **Datos básicos.**
   - Tipo de titular: **Persona natural** o **Empresa**.
   - Nombre, apellido, documento y **plataforma (país)**: Chile, Colombia, Ecuador o Perú.
   - Respuesta obligatoria a **"¿Este titular será beneficiario?"** (SÍ / NO). Con SÍ, el titular también toma clases y se crea como beneficiario.
   - En Empresa: razón social, RUT y datos del representante legal.
   - Al salir de este paso, la plataforma **verifica el documento del titular** (ver 1.3).
3. **Ubicación.** Fecha de nacimiento, país, domicilio, ciudad y celular.
4. **Adicional.** Ingresos, correo y género (no aplica a Empresa).
5. **Referencias.** Dos referencias completas: nombre, parentesco y teléfono.
6. **Financiero.**
   - **Total del plan** (mayor que 0) e **inscripción**.
   - **Fecha de pago**: la fecha de la primera cuota. Su día del mes es el día de pago de todas las cuotas.
   - **Vigencia** en meses (de 1 a 12) y **medio de pago** según el país.
   - La plataforma calcula sola el **saldo** (total − inscripción) y el **valor de la cuota** (saldo ÷ cuotas).
7. **Beneficiarios.** Agregue a cada persona que tomará clases (ver 1.4 y 1.5).

Al final, pulse **Crear**.

### 1.3 Verificación de documentos

La plataforma busca el documento en los demás contratos **vivos**. Ignora los finalizados, anulados, rechazados, devueltos o retractados y los de prueba (RC-06 a RC-08).

| Si la persona ya está como… | Qué pasa |
|---|---|
| Beneficiaria de un contrato **aprobado** y aquí será beneficiaria | **No se puede crear.** Una persona solo puede ser beneficiaria de un contrato vigente. |
| Beneficiaria o titular de un contrato **pendiente** | Hay que **resolverlo**: ir a ese contrato y completarlo, o **anularlo** (RC-09). No se puede anular si ya está aprobado o tiene pagos validados. |
| Titular de un contrato **aprobado** | Solo informa y ofrece **"Traer sus datos"** para no volver a escribirlos (RC-10). |

Los contratos anulados y la ficha académica anterior se muestran solo como **antecedentes**: no bloquean.

### 1.4 Beneficiarios adultos

Para cada beneficiario se piden nombre, apellido, documento, fecha de nacimiento, celular y correo. Al pulsar **Crear**, la plataforma vuelve a verificar los documentos de todos los beneficiarios.

### 1.5 Beneficiarios Kids

El interruptor **Kids** aparece en cada beneficiario solo si el **Proceso Kids** está activado (Mantenimiento › Contratos › Proceso Kids). Al activarlo se abre la ventana **Beneficiario Kids**, con tres secciones.

**a) Datos del niño.** Nombres, apellidos, documento, **fecha de nacimiento** (obligatoria), correo y celular.

**b) Curso.** Se elige del catálogo del sistema Kids, en este orden:

1. **Campaña**: solo aparecen campañas **en matrícula**.
2. **Tipo de curso**:
   - **JUNIOR**, en color fucsia: niños de **6 a 9 años**.
   - **YOUNGSTER**, en color azul: niños de **10 a 13 años**.

   La edad se calcula **al día de hoy**. Debajo del campo aparece "Edad hoy: N años → CURSO" y el curso que corresponde queda preseleccionado.
3. **Salón / horario**: se hace clic en el salón deseado. Cada salón muestra su horario y los cupos disponibles.

Reglas del curso:

- **Solo se ven salones del país del contrato.** Un contrato de **Chile** ve solo los salones de Chile. Uno de **Colombia, Ecuador o Perú** ve los del grupo general.
- **No se muestran los salones llenos** ni los inactivos.
- En Crear Contrato **no se muestra el guía (profesor)** del salón.
- **El salón es obligatorio.**
- Si la edad del niño **no corresponde** al curso elegido, aparece un aviso que lo explica. Con **"Cambiar a YOUNGSTER/JUNIOR"** se corrige con un clic y luego se elige de nuevo el salón. Si el niño tiene **menos de 6 o más de 13 años**, el aviso indica que no puede inscribirse en Kids.
- El aviso de edad aparece **al terminar de escribir la fecha** (al salir del campo), no mientras se escribe.
- Si el catálogo de Kids **no responde**, la ventana muestra un recuadro rojo y no deja guardar, para que el niño no quede registrado solo en LGS.

**c) Apoderado.**

- Si marca **"¿El titular será el apoderado?"**, se copian los datos del titular.
- El campo **Parentesco** (madre, padre, tutor…) **siempre se puede editar**: es la relación del apoderado con el niño.
- Si el apoderado es otra persona, complete sus nombres, apellidos, documento, teléfono y correo.

Pulse **Guardar beneficiario Kids**. El niño queda en la lista de beneficiarios con su curso.

### 1.6 Qué pasa al pulsar "Crear"

- La plataforma **asigna el número de contrato** en ese momento, con el formato `PP-NNNNN-AA`. Por ejemplo, `01-10738-25`: 01 = Chile, 02 = Colombia, 03 = Ecuador, 04 = Perú (RC-13, RC-14).
- El contrato y todos sus beneficiarios quedan en estado **Pendiente**.
- Se registra el **pago de inscripción (cuota 0)** sin validar. Recaudos lo valida después.
- Cada beneficiario **Kids** queda con su cupo **reservado** en el salón elegido del sistema Kids.
- Si un beneficiario ya había tomado clases en otro contrato, su **historial se archiva en un PDF** antes de continuar.
- La plataforma lleva al **detalle del contrato**.

---

## 2. Completar el contrato

Pantalla: **detalle del contrato**. Se abre al terminar de crearlo o desde la búsqueda.

### 2.1 Documentación y recibo

- El botón **"Documentación y recibo"** permite subir **imágenes o PDF** (cédulas, comprobantes) y el **recibo de inscripción** (RC-22).
- Subir y eliminar documentos exigen permisos distintos.
- Si la función **"Leer recibo"** está encendida, la plataforma lee el comprobante y extrae medio de pago, fecha, monto, referencia y banco (RC-24).

### 2.2 Revisar y editar

- **Vista previa**: muestra el contrato completo con la plantilla del país.
- **Editar Contrato**: un contrato **sin aprobar** lo puede editar el personal de Comercial. Uno **aprobado** solo lo edita un **Super Administrador** (RC-59).

---

## 3. Firma del cliente

Desde el detalle del contrato:

- **Solicitar firma**: envía por WhatsApp al titular el enlace a la página pública de su contrato.
- **Enviar PDF**: envía el contrato en PDF por WhatsApp.

En la página pública, el cliente (RC-26):

1. Escribe su **número de documento**.
2. Recibe un **código de 6 dígitos** por WhatsApp. Vale **10 minutos** y sirve una sola vez.
3. Marca la **declaración jurada**.
4. Escribe el código. El contrato queda **firmado**.

Notas:

- La firma guarda la fecha, la hora, el documento, el celular verificado y un **sello digital** que prueba que el contrato no se modificó después.
- Después de enviar la solicitud por WhatsApp, el detalle del contrato revisa la firma durante **10 minutos** y **se actualiza solo** cuando el cliente firma.
- **Auto-Aprobar Consentimiento**: con un permiso especial, un administrador puede dar por firmado el contrato **sin código**. Queda registrado como aprobación **AUTOMÁTICA**, con su nombre (RC-29).
- Al firmar, el PDF se archiva en Google Drive.

---

## 4. Aprobación

### 4.1 Encontrar los contratos por aprobar

Menú: **Aprobación**. La lista muestra los contratos **no aprobados**, sin incluir los de prueba, con su estado:

- **Firmado sin aprobar**: el cliente ya firmó.
- **Sin firmar - Sin aprobar**: aún no firma.

Al hacer clic en un contrato se abre la **ficha del titular**: **ahí se aprueba**. La pantalla de Aprobación sirve para encontrar los contratos; no aprueba por sí misma.

> Se puede aprobar un contrato **aunque no esté firmado** (RC-33). La decisión es del área de Aprobación.

### 4.2 Aprobar todo el contrato

En la ficha del titular › pestaña **Administración** › **Estado del Titular**:

1. Elija **Aprobado** y confirme.
2. El titular queda **Aprobado** y su contrato en estado **ACTIVA**, con **fecha de ingreso = hoy**.
3. **Todos los beneficiarios pendientes se aprueban en cascada.**
4. Aparece un resumen con el resultado de cada beneficiario.

### 4.3 Aprobar un solo beneficiario

En **Gestión de Beneficiarios**, pulse **Aprobar** junto al beneficiario. Si el titular seguía pendiente, se aprueba también.

### 4.4 Qué recibe cada beneficiario al aprobarse

| Tipo | Qué pasa al aprobar | Qué ve quien aprueba |
|---|---|---|
| **Adulto nuevo** | Se crea su **ficha académica** en el nivel **WELCOME** y se le envía el **WhatsApp de bienvenida** con el enlace para crear su usuario. | "WhatsApp enviado", o el error si no se pudo enviar. |
| **Adulto que vuelve** (re-matrícula) | Su ficha académica anterior pasa a este contrato y se **reactiva su acceso**. | Igual que el anterior. |
| **Kids** | Su reserva se **activa** en el sistema Kids: queda **matriculado** en su curso y salón. Si la reserva no había llegado a Kids, se crea en ese momento. No recibe ficha académica de adultos ni el WhatsApp de LGS. | "Matriculado en KIDS" con su **usuario y contraseña inicial**, o el error que devolvió Kids. |

El titular no recibe ficha académica, salvo que también sea beneficiario.

### 4.5 Otros estados

Además de **Aprobado**, el Estado del Titular puede ser (RC-34):

| Estado | Efecto |
|---|---|
| **Pendiente** | Sin cambios. |
| **Contrato nulo / Devuelto / Rechazado** | Inactiva al titular y a todos sus beneficiarios. El contrato queda para la Limpieza de Anulados. |
| **Retractado** | El cliente se retractó dentro del plazo legal. Inhabilita al titular y a los beneficiarios, incluido su acceso. |

**Cambiar un contrato ya aprobado** (RC-35):

- Solo desde la ficha del titular.
- Aparece una **advertencia roja**: hay que escribir un **motivo de al menos 10 caracteres** y confirmar.
- Un contrato aprobado solo puede pasar a **Pendiente** o **Retractado**.

Todo cambio de estado queda en el **Historial de cambios de estado**, debajo de Gestión de Beneficiarios (RC-36).

---

## 5. Beneficiarios Kids desde la ficha del titular

Pantalla: ficha del titular › **Administración › Gestión de Beneficiarios**.

### 5.1 Agregar un niño a un contrato existente

1. Pulse **Agregar Beneficiario**.
2. Pulse **Activar Kids** y complete la ventana Kids igual que en 1.5. Aquí la ventana también muestra los salones **llenos**, en rojo y no seleccionables.
3. Pulse **Continuar →**. La ventana **todavía no guarda**: lo lleva al paso 2 del formulario.
4. Complete **género, ciudad y domicilio** y pulse **Crear Beneficiario**.
5. Aparece un aviso que confirma que el cupo quedó **reservado** en Kids, o el error si Kids no lo aceptó.
6. Para que el niño quede **matriculado**, **apruébelo** (paso 4.3).

### 5.2 Estado del niño en Kids

Junto al nombre de cada niño aparece su estado:

| Etiqueta | Significado |
|---|---|
| **MATRICULADO EN KIDS** (verde) | Aprobado y activo en su salón. |
| **RESERVADO EN KIDS** (azul) | Cupo reservado. Falta aprobarlo. |
| **SIN RESERVA EN KIDS** (rojo) | Kids no registró la reserva. Debajo se muestra el motivo, por ejemplo que la edad no corresponde al curso. |

### 5.3 Corregir una reserva que falló

Si el niño aparece **SIN RESERVA**, use el botón **"Reservar en KIDS"**, o **"Matricular en KIDS"** si ya está aprobado:

1. Elija de nuevo campaña, curso y salón.
2. Pulse **Enviar a KIDS**.
3. Si el niño ya estaba aprobado, queda matriculado de una vez y se muestran su usuario y contraseña.

### 5.4 Modificar a un niño

**Modificar** abre la ventana Kids con sus datos, su curso y su apoderado.

- Si el niño **aún no está en Kids**, se puede cambiar el curso y el salón.
- Si ya está **reservado o matriculado**, el curso se muestra solo para consulta: **el cambio de salón se hace en el sistema Kids**. Se pueden actualizar el apoderado y el parentesco.
- Los datos personales (nombre, documento, fecha de nacimiento, correo, celular) se guardan con los mismos permisos que para cualquier beneficiario.

### 5.5 La ficha del niño

La ficha de un beneficiario Kids muestra solo **Información General** y **Contacto y Referencias**. Lo financiero, la administración y el contrato se gestionan en la ficha del **titular**. Tampoco tiene los botones **Descargar Contrato** ni **Documentación y recibo**. La sección **Programa Kids** muestra su estado real en Kids: Cursando, Suspendido o No cursando.

---

## 6. Programa Kids: de principio a fin

Este capítulo reúne todo el recorrido de un niño en el programa **Kids**, desde la venta hasta que está en clase.

### 6.1 Qué es y cómo se conecta con LGS

- **Kids** es el programa de inglés para niños de **6 a 13 años**. Funciona en su propio sistema (KIDS2026), con campañas, cursos, salones, guías (profesores) y su propio acceso para el niño.
- La **venta** del contrato se hace en LGS: titular, plan financiero, firma y aprobación siguen el mismo proceso que un contrato de adultos.
- El **niño** se inscribe en el sistema Kids. LGS le envía automáticamente sus datos, su curso, su salón y su apoderado.
- Un contrato puede tener **beneficiarios adultos y Kids a la vez**.

### 6.2 Requisitos previos

- El **Proceso Kids** debe estar **activado** en Mantenimiento › Contratos › Proceso Kids. Si está apagado, no aparece el interruptor Kids en los beneficiarios.
- Debe haber una **campaña en matrícula** en Kids, con salones activos y con cupo para el país del contrato.

### 6.3 Consultar la oferta: Comercial › Cursos Kids

Antes de vender, el comercial puede revisar la oferta en **Comercial › Cursos Kids** (requiere su permiso):

- muestra la campaña en matrícula **tal como está en Kids**: fechas de la campaña, del programa (inicio y fin del curso) y el **cierre de ventas**;
- por cada salón: curso (**JUNIOR** en fucsia, **YOUNGSTER** en azul), país, guía, horario, inscritos sobre cupo, disponibles y estado;
- los salones **llenos** aparecen en **rojo** con la etiqueta LLENO, y los **inactivos** atenuados;
- se puede filtrar por país, curso y estado, o ver **solo los que tienen cupo**;
- el botón **Descargar CSV** exporta lo que se ve en pantalla.

### 6.4 Reglas de inscripción

| Regla | Detalle |
|---|---|
| **Edad y curso** | **JUNIOR = 6 a 9 años**, **YOUNGSTER = 10 a 13 años**, con la edad cumplida **al día de hoy**. Si no corresponde, el sistema Kids rechaza la inscripción; por eso LGS lo valida antes y avisa. |
| **País** | Contratos de **Chile** → solo salones de Chile. **Colombia, Ecuador y Perú** → salones del grupo general. |
| **Salón** | Obligatorio. En Crear Contrato solo se ofrecen salones con cupo y sin mostrar el guía. |
| **Apoderado** | Adulto responsable del niño. Puede ser el titular. El parentesco siempre se registra. |
| **Un niño, un contrato vivo** | Igual que en adultos: un documento solo puede ser beneficiario de un contrato vigente. |

### 6.5 Ciclo de vida del niño

| Momento | En LGS | En el sistema Kids |
|---|---|---|
| Se crea el contrato o se agrega el niño | Beneficiario **Pendiente**, con su curso y apoderado | **Reserva**: el cupo queda apartado en el salón |
| Se aprueba al niño (o al contrato) | Beneficiario **Aprobado**, sin ficha académica de adultos ni WhatsApp de LGS | **Matrícula** activa: el niño queda en su salón y se crea su usuario |
| Clases | La ficha muestra su estado: **Cursando** | El niño toma clases con su guía |
| Se inactiva en LGS | Inactivo, con motivo | Contrato **suspendido** y acceso del niño bloqueado |
| Se reactiva en LGS | Activo de nuevo | Se reactiva su contrato y su acceso |

Al aprobar, quien aprueba ve el **usuario y la contraseña inicial** del niño en Kids para entregárselos a la familia.

### 6.6 Dónde se hace cada cosa

| Necesito… | Dónde |
|---|---|
| Ver la oferta de cursos y cupos | Comercial › Cursos Kids |
| Vender un contrato con niños | Comercial › Crear Contrato (interruptor **Kids** en el beneficiario) |
| Agregar un niño a un contrato existente | Ficha del titular › Administración › Agregar Beneficiario › **Activar Kids** |
| Aprobar y matricular | Ficha del titular › Administración (Estado del Titular o botón **Aprobar**) |
| Corregir una reserva que falló | Botón **Reservar / Matricular en KIDS** junto al niño |
| Corregir datos o apoderado | Botón **Modificar** junto al niño |
| **Cambiar de salón** a un niño ya reservado o matriculado | En el **sistema Kids**: desde LGS no se cambia de salón |
| Ver si está cursando | Ficha del niño › sección **Programa Kids** |

### 6.7 Errores frecuentes con Kids

- **Se eligió el curso equivocado para la edad.** Kids rechaza la reserva y el niño queda **SIN RESERVA**. Se corrige con **Reservar / Matricular en KIDS**, eligiendo el curso que corresponde.
- **Se cerró la ventana Kids pensando que ya había guardado.** Desde la ficha hay que pulsar **Continuar →** y luego **Crear Beneficiario**.
- **No aparece el salón acordado con la familia.** Puede estar lleno, inactivo o ser de otro país. Revise **Cursos Kids**.
- **El titular es una empresa.** En ese caso hay que registrar como apoderado al padre, la madre o el tutor, no a la empresa.

---

## 7. Inactivar y reactivar beneficiarios

En **Gestión de Beneficiarios**, **Inactivar** pide un **motivo**. Antes de confirmar, la ventana muestra **"Qué va a pasar"** (RC-39):

- Se **bloquea su acceso** y no puede agendar clases.
- Sus **clases futuras se cancelan** y se libera el cupo.
- Si su **correo lo usa otro beneficiario activo** (por ejemplo, hermanos con el correo del papá o la mamá), su acceso **no se bloquea**, para no dejar sin entrada al otro. La ventana lo avisa.
- Si la persona **sigue estudiando por otro contrato**, no se tocan sus clases ni su acceso.
- Si es **Kids**, su contrato en Kids queda **suspendido** y su acceso a Kids bloqueado.
- La **vigencia del contrato sigue corriendo**: inactivar no es un OnHold y no devuelve días.

Al **reactivar** se desbloquea su acceso y, si es Kids, se reactiva en Kids. Las clases que se cancelaron no vuelven: hay que agendarlas de nuevo.

Al terminar aparece un resumen de lo que ocurrió, y queda en el historial de la persona.

---

## 8. Preguntas frecuentes

**¿Por qué no me deja crear el contrato?**
Puede faltar un dato obligatorio del paso, o la verificación encontró a una persona ya activa en otro contrato. Si está como beneficiaria de un contrato aprobado, no puede ser beneficiaria de otro. Si está en un contrato pendiente, hay que completarlo o anularlo primero.

**¿Por qué no puedo elegir JUNIOR para un niño?**
La edad hoy no corresponde: JUNIOR es de 6 a 9 años y YOUNGSTER de 10 a 13. El curso que no corresponde aparece deshabilitado. Si cree que es un error, revise la fecha de nacimiento.

**¿Por qué no aparece un salón que existe en Kids?**
Puede ser de otro país, estar lleno o estar inactivo. Crear Contrato solo muestra salones con cupo del país del contrato. La consulta **Comercial › Cursos Kids** muestra todos los salones, incluidos los llenos (en rojo) y los inactivos.

**Agregué un niño desde la ficha y no quedó guardado.**
La ventana Kids no guarda por sí sola: hay que pulsar **Continuar →** y luego **Crear Beneficiario** en el paso 2. Si el botón está deshabilitado, debajo dice qué dato falta.

**El niño quedó "SIN RESERVA EN KIDS".**
Lea el motivo debajo de su nombre (por ejemplo, la edad no corresponde) y use **Reservar / Matricular en KIDS** para elegir de nuevo el curso y el salón.

**¿Puedo aprobar un contrato sin firma?**
Sí. La plataforma lo permite y es una decisión del área de Aprobación.

**Aprobé un contrato por error.**
Desde la ficha del titular se puede volver a **Pendiente**, con motivo, solo durante el primer mes y si ningún beneficiario avanzó de WELCOME.

**¿Qué diferencia hay entre Inactivar y OnHold?**
**OnHold** es una pausa programada que al terminar **devuelve los días** al contrato. **Inactivar** es una suspensión administrativa: la vigencia sigue corriendo y cancela las clases futuras.

---

## Glosario

| Término | Significado |
|---|---|
| **Titular** | Quien firma y paga el contrato. |
| **Beneficiario** | Quien toma las clases. Puede ser el mismo titular. |
| **Apoderado** | Adulto responsable de un niño Kids. Puede ser el titular. |
| **Campaña Kids** | Período de matrícula del programa Kids, con sus cursos y salones. |
| **Salón** | Grupo de un curso Kids con horario, guía y cupo propios. |
| **Reserva** | Cupo apartado en un salón Kids mientras el contrato no está aprobado. |
| **Matrícula** | Reserva activada al aprobar: el niño queda en su salón. |
| **Ficha académica** | Registro del alumno adulto con su nivel y step. Se crea al aprobarlo. |
| **WELCOME** | Primer nivel de un alumno adulto nuevo. |
| **Cuota 0** | El pago de inscripción. |
| **Contrato vivo** | Contrato que no está finalizado, anulado, rechazado, devuelto, retractado ni inactivo (salvo OnHold). |
| **Contrato de prueba (PRB-)** | Contrato para ensayos. No consume numeración real y no se aprueba. |
