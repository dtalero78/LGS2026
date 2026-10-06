# 02 — Hallazgos en el proceso del contrato (06-10-2026)

> ⛔ Sensible: no subir a NotebookLM ni distribuir. Ver [README](README.md).
> Salieron al levantar las reglas de negocio de [`../manual/02-proceso-de-contrato.md`](../manual/02-proceso-de-contrato.md): diferencias entre la regla que aplica la pantalla y lo que valida el servidor. Para cada uno, la evidencia es `archivo:línea`.

## Controles que existen en pantalla pero no en el servidor

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| S1 | ✅ corregido 06-10 | **Eliminar beneficiario** (`DELETE /api/postgres/people/[id]`). La pantalla solo lo ofrece para beneficiarios no aprobados ni inactivos, pero el servidor **no revisa la aprobación**: borra la fila de PEOPLE y su ACADEMICA aunque el beneficiario esté aprobado y estudiando. | `people/[id]/route.ts:655-679` vs `PersonAdmin.tsx:1114-1138`. **Fix:** exige `PERSON.INFO.ELIMINAR`, rechaza aprobados y solo borra la ficha ACADEMICA del propio contrato sin clases |
| S2 | ✅ corregido 06-10 | **Extender vigencia**. Las rutas de extensión no exigen `STUDENT.CONTRATO.EXTENDER_VIGENCIA`. El permiso existe, pero el servidor no lo pide. | `types/permissions.ts:120`. **Fix:** `students/[id]/extend` exige `EXTENDER_VIGENCIA` |
| S3 | ✅ corregido 06-10 | **Migrar contrato** (`/admin/migrar-contrato`). No exige un permiso específico y crea la cuota 0 ya **validada** por "SISTEMA". | `admin/migrar-contrato` `:42-46`, `:199-235`. **Fix:** exige `MANTENIMIENTO.CONTRATOS.MIGRAR` |
| S4 | ✅ corregido 06-10 (permiso) | **Editar contrato** (`PUT /api/postgres/contracts/[id]`). Permite editar contratos **aprobados o firmados**, con lo que el hash del consentimiento deja de corresponder. Además no recalcula la fecha de fin al cambiar la vigencia y no propaga los cambios a ACADEMICA ni a USUARIOS_ROLES. | `contracts/[id]/route.ts:11-52`. **Fix:** staff obligatorio; contrato aprobado solo SUPER_ADMIN (servidor + botón). Siguen pendientes el recálculo del fin y la propagación |
| S5 | 🟡 | **Borrar desde el Centro de Aprobaciones** (`approvals/delete`). No revisa pagos validados, a diferencia de la anulación y de la Limpieza de Anulados. | `approvals/delete/route.ts` |
| S6 | 🟡 | El permiso `AprobacionPermission.APROBACION_AUTONOMA` aparece en el menú y en la matriz, pero **ninguna ruta lo exige**. La auto-aprobación real la controla `COMERCIAL.CONTRATO.APROBACION_AUTONOMA`. | `auto-approve/route.ts:41` |
| S7 | 🟡 | `POST /api/postgres/contracts` acepta beneficiarios Kids aunque `APP_CONFIG.kids_feature_activo` esté apagado. El servidor no revisa el ajuste. | `contracts/route.ts:257-308` |
| S9 | 🔴 | **`GET /api/postgres/people/[id]` es PÚBLICO** (`handler()`): sin sesión devuelve la ficha completa de la persona (datos personales, financiero, beneficiarios). Verificado en producción el 06-10: responde `200` sin sesión. Solo lo usan pantallas internas (`/person`, `/student`), así que pasar a `handlerWithStaffAuth` no afecta a las páginas públicas. **Pendiente de autorización** por si un sistema externo lo consume. | `people/[id]/route.ts` (`export const GET = handler(`) |
| S8 | 🟡 | **OTP de firma**: la espera de 30 s entre reenvíos solo la controla la pantalla. El servidor no limita intentos ni reenvíos; esto ya figuraba en CLAUDE.md. | `contrato/[id]/page.tsx:150`, `otp-store.ts` |

## Inconsistencias de reglas (no son de seguridad; requieren decisión)

| # | Inconsistencia | Evidencia |
|---|---|---|
| I1 | ✅ **Resuelto 06-10:** Retractado inhabilita a titular y beneficiarios (PEOPLE, ACADEMICA y acceso, `src/lib/retractado.ts`; 56 contratos existentes corregidos con `fix-retractados-inhabilitar.js`) y tiene pestaña propia en la Limpieza. Antes: **Retractado** no inactiva a las personas del contrato ni entra en la Limpieza de Anulados. Queda vivo para la verificación de documentos solo si no está inactivo. | `people/[id]/route.ts:399-413`, `limpieza-anulados.ts:8-11` |
| I2 | **Decisión 06-10:** la Limpieza sigue siendo manual; la automática queda pendiente de autorización. Antes: la ficha dice que los anulados "se depuran semanalmente", pero **no existe ningún proceso automático**: la Limpieza es manual. | `PersonAdmin.tsx` (aviso), `purge/route.ts` |
| I3 | ✅ **Resuelto 06-10:** solo se bloquea si el documento ya es beneficiario ACTIVO (aviso en pantalla + 409 del servidor); la re-matrícula sí se permite y al aprobar se re-liga la ficha. Antes: **Agregar beneficiario** a un contrato existente rechaza cualquier documento ya registrado en la plataforma. Choca con la re-matrícula que sí se permite al crear un contrato nuevo (RC-11/RC-12). | `people/route.ts:35-43` |
| I4 | **Contratos PRB-**: la pantalla oculta Solicitar firma, Enviar PDF y Auto-aprobar, pero la firma por OTP y la auto-aprobación **sí archivan en Drive** los PRB- (Enviar PDF no). | `comercial/contrato/[id]/page.tsx:632,691,961`, `contract-pdf-generate.ts:105`, `auto-approve:154`, `send-pdf:125` |
| I5 | Hay comentarios que contradicen al código: la cuota 0 "nace validada" (el código la crea sin validar), la cabecera de `reactivate-onhold` y la conversión de titular "lo ubica en WELCOME" (no crea ficha). | `contracts/route.ts:375,399-402`, `reactivate-onhold/route.ts:20`, `conversion-titular` |
| I6 | El número de cuotas y el tipo de plan no son obligatorios al crear el contrato. Sin cuotas, el valor de cuota es 0 y el cálculo de mora no se aplica a ese contrato. | `crear-contrato/page.tsx:441-499`, `mora.ts` |
| I7 | La fecha de fin del **titular** no se sincroniza con las extensiones del beneficiario. Se corrigieron 18 casos el 05-10-2026, pero el problema puede repetirse. | `fix-estado-titulares-null.js` |
