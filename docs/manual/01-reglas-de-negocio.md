# 01 — Reglas de negocio de la plataforma LGS

> Reglas que rigen el funcionamiento de la plataforma Let's Go Speak, escritas para el personal administrativo.
> Cada regla tiene un código (**RN-xx**) para poder citarla. Describen **cómo funciona hoy la plataforma**. Última actualización: **06-10-2026**.
> El ciclo de vida completo del contrato está en [02 — Proceso del contrato](02-proceso-de-contrato.md) (reglas **RC-xx**).

---

## 1. Acceso y usuarios

**RN-01 — Inicio de sesión.**
- Cada persona entra con su email y contraseña.
- Un alumno **no puede entrar** si:
  - su acceso está **inactivo** (contrato inactivado, OnHold o suspensión);
  - su contrato está **vencido**. En ese caso el mensaje indica que el contrato expiró.

**RN-02 — Roles y permisos.**
- Lo que cada usuario ve y puede hacer depende de su **rol**. Cada rol tiene una lista de permisos editable en **Permisos**.
- **Super Admin** y **Admin** tienen acceso a todo.
- Un cambio de permisos tarda hasta **5 minutos** en aplicarse.

**RN-03 — Alcance por país en Recaudos.** Los usuarios de Recaudos solo ven los contratos de su país:

| País del usuario | Qué ve |
|---|---|
| Chile | Solo Chile |
| Colombia | Todo excepto Chile |
| Ecuador, Perú u otro | Solo su país |
| Internacional, o sin país | Todo |

**RN-04 — Acceso de un alumno con varios contratos.** Si una persona aparece en más de un contrato, su agenda y su acceso se rigen por el contrato al que está ligada su **ficha académica**.

---

## 2. Contratos (resumen)

Detalle completo en [02 — Proceso del contrato](02-proceso-de-contrato.md).

**RN-05 — Número de contrato.**
- Formato `PP-NNNNN-AA`: país, consecutivo y año.
- Lo asigna el sistema al crear el contrato, sin duplicados. Ver RC-13 y RC-14.

**RN-06 — Verificación de personas.**
- Al crear un contrato el sistema revisa si el titular o los beneficiarios ya están en otro contrato vivo.
- **Una persona solo puede ser beneficiaria de un contrato vigente.** Ver RC-06 a RC-11.

**RN-07 — Anular, nunca borrar.** Al crear un contrato nuevo, el contrato anterior se **anula**, no se borra.
- No se puede anular un contrato **aprobado** ni uno con **pagos validados**.
- El borrado definitivo solo ocurre en la **Limpieza de Anulados**, con copia de respaldo. Ver RC-54.

**RN-08 — Aprobación.**
- Al aprobar, los beneficiarios adultos reciben su ficha académica en **WELCOME** y el mensaje de bienvenida. Ver RC-32.
- Un contrato aprobado solo cambia de estado desde la ficha del titular, con **motivo obligatorio**. Ver RC-35.
- Todo cambio de estado queda en el **historial de cambios de estado**.

**RN-09 — Firma.**
- El cliente firma con un **código de 6 dígitos** enviado por WhatsApp, que vale 10 minutos.
- La firma guarda un sello digital que prueba que el contrato no se alteró. Ver RC-26 a RC-30.

---

## 3. Estructura académica

**RN-10 — Niveles y steps.**

| Nivel | Steps | Notas |
|---|---|---|
| WELCOME | Welcome | Nivel de entrada al aprobar el contrato |
| ESS (Essential) | Step 0 | Nivel de inicio. A los **30 días** pasa solo a BN1 · Step 1 |
| BN1 · BN2 · BN3 (Beginner) | Steps 1–15 | 5 steps por nivel |
| P1 · P2 · P3 (Practical) | Steps 16–30 | 5 steps por nivel |
| F1 · F2 · F3 (Functional) | Steps 31–45 | 5 steps por nivel |
| MASTER / IELTS / B2 FIRST / TOEFL | Steps 46 / 47 / 48 / 49 | Después del Step 45, según la prueba internacional elegida |
| DONE | Step 50 | Fin del programa: el acceso se desactiva, pero nunca se borra |

**RN-11 — Steps "Jump".** Los steps **5, 10, 15, 20, 25, 30, 35, 40 y 45** son evaluaciones de cierre de nivel. Se llaman **Jumps**.

**RN-12 — Cómo se completa un step normal.** Hacen falta:
- **2 sesiones exitosas** del step, o 1 sesión exitosa + 1 actividad complementaria aprobada;
- **y 1 TRAINING club exitoso** del step. Otros clubes, como Pronunciation, Grammar o Listening, **no** cuentan.

Una clase es exitosa si el alumno **asistió**.

**RN-13 — Cómo se aprueba un Jump.** Al menos **una** sesión del Jump debe cumplir las cuatro condiciones:
- asistió;
- participó;
- el advisor **no** la marcó como reprobada;
- no fue cancelada.

Si el alumno reprueba, repite el Jump. Un intento aprobado posterior **sí** cuenta, aunque haya reprobaciones anteriores.

**RN-14 — Avance automático.**
- Al marcar la asistencia o la evaluación, el alumno avanza **un step a la vez** si completó el step en el que está.
- Para que cuente, la clase debe ser del **step actual** del alumno.
- **Desde WELCOME**, cualquier asistencia lo pasa a BN1 · Step 1.

**RN-15 — Ajustes manuales.**
- Coordinación académica puede **marcar un step como completo o incompleto**. Ese ajuste manda sobre las reglas automáticas.
- También puede **cambiar el step** del alumno, por ejemplo cuando un alumno quedó "pegado" en un step anterior al real.

**RN-16 — El step que cuenta es el de la clase.** Una clase cuenta para el step **del evento**, no para el step en que estaba el alumno al agendarla.

---

## 4. Reservas y cancelaciones del alumno

**RN-17 — Reservar clases.** Desde su panel, el alumno reserva clases de **hoy o mañana** de su nivel y step, siempre que:
- haya **cupo**;
- no esté ya inscrito en esa clase;
- no tenga otra clase a la **misma hora**;
- no supere el límite semanal: **2 sesiones y 3 clubes**;
- falten **al menos 30 minutos** para la clase.

Las clases que empiezan en menos de 30 minutos se muestran como **"Próximamente"**, sin poder reservarse.

**RN-18 — Cancelar clases.**
- El alumno puede cancelar hasta **60 minutos antes** de la clase.
- Las sesiones de **exámenes internacionales** (IELTS, B2 First, TOEFL) no se pueden cancelar desde el panel.

**RN-19 — Cancelación de una sesión por la institución** ("Sesión con booking").
- La clase de cada inscrito se cancela **devolviéndole el cupo semanal**.
- Los alumnos afectados aparecen en **Servicio › Cancelación sin reemplazo** para contactarlos.
- Al marcar el lote como gestionado, esas clases canceladas se retiran del historial del alumno. Queda constancia en el histórico.

---

## 5. Actividades complementarias

**RN-20 — Cuándo se ofrecen.** Se ofrecen cuando el alumno:
- tiene **1 sesión exitosa** en un step normal (no Jump);
- **no** tuvo una sesión exitosa de ese step **esta semana**, de lunes a domingo.

Así se evita que la use para no asistir a la segunda sesión.

**RN-21 — Reglas del cuestionario.**
- 10 preguntas generadas a partir del contenido del step.
- Se aprueba con **50 % o más**.
- Máximo **3 intentos** por step.
- Al aprobar cuenta como una sesión y puede hacer avanzar el step.

---

## 6. Certificados de nivel

**RN-22 — Qué certificado corresponde a cada nivel.**

| Certificado | Se habilita al aprobar |
|---|---|
| **Beginner** | Jump 15 |
| **Practical** | Jump 30 |
| **Functional** | Jump 45 |

- La fecha del certificado es la del primer Jump aprobado.
- El PDF ya trae impresas las **60 horas** de formación.

**RN-23 — Protección del PDF.** El certificado se abre con el **número de documento** del alumno.

**RN-24 — Cuántas veces se genera.**
- El **alumno** puede generar cada certificado **una sola vez** desde su panel.
- El **personal** puede generarlo las veces que necesite desde el detalle del estudiante, donde además ve cuándo lo generó el alumno.
- Cada generación queda registrada. El informe **Informes › Académica › Certificados** muestra cuántas veces lo generó el alumno y cuántas el personal.
- Las generaciones del personal se cuentan desde el **05-10-2026**.

**RN-25 — Certificado y pagos.**
- El certificado solo se expide si el contrato está **al día en los pagos**.
- El bloqueo por mora está **apagado** hasta que los pagos de cuotas estén completos en la plataforma.
- Con el bloqueo encendido, el alumno ve la causa antes de generar el certificado, y Recaudos puede desbloquear contratos puntuales con motivo. Ver RC-53.

---

## 7. Vigencia, pausas y vencimiento

**RN-26 — Vencimiento.**
- Un contrato vence cuando la fecha actual supera en **2 días** su fecha de fin. Es un día de gracia para alumnos de otros husos horarios.
- Cada noche, a las 11:00 p. m. de Colombia, los contratos vencidos pasan a **FINALIZADA** y sus alumnos quedan sin acceso.

**RN-27 — Extensión.** Se puede extender el contrato por días o hasta una fecha, con motivo. La extensión **reactiva** al alumno y queda en su historial.

**RN-28 — OnHold (pausa).**
- Máximo **2 pausas** por contrato, y ninguna si ya tuvo extensión manual.
- Durante la pausa el alumno no tiene acceso.
- Al terminar, la fecha de fin se **corre por los días pausados**, para que el alumno no pierda días.

**RN-29 — Exámenes internacionales.** Al confirmar el examen:
- el contrato se extiende hasta **7 días después del fin del ciclo**;
- el alumno queda en estado **EXAM. INTER.**
- Al vencer, vuelve a FINALIZADA.

---

## 8. Pagos, recaudos y mora

**RN-30 — Cuotas.**
- La **cuota 0** es la inscripción.
- Las demás vencen cada mes en el **día de corte**, que es el día de la fecha de la primera cuota.

**RN-31 — Validación.**
- Recaudos **valida** los pagos.
- Un pago validado no se puede modificar ni eliminar. Solo se facturan pagos validados.

**RN-32 — Saldo.**
- El saldo del panel descuenta solo los pagos **validados** y los descuentos.
- El **Estado de Cuenta** en PDF cuenta todos los pagos registrados, validados o no. Está protegido con el documento del titular.

**RN-33 — Mora.**
- Un contrato está en mora cuando tiene **menos cuotas registradas que cuotas vencidas**.
- Con **saldo $0** nunca está en mora.
- La misma regla se usa en la ficha financiera, en el bloqueo de certificados y en **Recaudos › Usuarios en mora**.

**RN-34 — Gestor y cartera.**
- Cada titular puede tener un **gestor de recaudo** asignado.
- El **estado de cartera** puede ser Normal, Prejurídico, Último Pago o Penalidad. Cambiarlo exige motivo y queda en un historial.

**RN-35 — Cambio a contado.** Se atribuye a **Comercial** si ocurre dentro de los 30 días desde la creación del contrato; después, a **Recaudos**.

---

## 9. Registros, respaldos y auditoría

**RN-36 — Lo que queda registrado.**

| Qué | Dónde se consulta |
|---|---|
| Cambios de estado de aprobación del contrato | Ficha del titular › Administración › Historial de cambios de estado |
| Auto-aprobaciones de firma | Auditoría de auto-aprobaciones |
| Extensiones y pausas | Ficha del estudiante (historial de extensiones y de OnHold) |
| Contratos borrados | Respaldo completo, en Limpieza de Anulados › Histórico |
| Generación de certificados | Informes › Académica › Certificados |
| Desbloqueos de certificado por mora | Recaudos › Usuarios en mora |
| Cambios de estado de cartera | Ficha financiera del titular |
| Envío de mensajes de WhatsApp | Historial de mensajes del estudiante |

**RN-37 — Nada se borra sin respaldo.**
- Los contratos se **anulan**, no se borran.
- El borrado definitivo, en la Limpieza de Anulados o en el borrado desde el Centro de Aprobaciones, siempre guarda antes una copia completa recuperable.
- El acceso de un alumno que termina el programa se **desactiva**, nunca se elimina.

---

## Historial de este documento

| Fecha | Cambio |
|---|---|
| 06-10-2026 | Primera versión. Incluye los cambios del 05-10-2026: verificación de documentos y número asignado al crear, historial de cambios de estado, Limpieza de Anulados, regla única de mora, bloqueo de certificados por mora con desbloqueo, informe de Usuarios en mora, informe de Certificados y registro de generaciones por el personal. |
