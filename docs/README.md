# docs/ — Documentación del proyecto

Índice de la documentación del LGS Admin Panel.

## Manual (distribuible)

Material de referencia funcional/operativo. **Este es el corpus que se sube a NotebookLM** y se
comparte con personal administrativo.

- [`manual/00-inventario.md`](manual/00-inventario.md) — inventario de procesos (módulo · proceso · ruta · roles · modelos Prisma · irreversibilidad).
- [`manual/01-reglas-de-negocio.md`](manual/01-reglas-de-negocio.md) — reglas de negocio de la plataforma (RN-xx): acceso, contratos, estructura académica, reservas, complementarias, certificados, vigencia, pagos y mora, auditoría.
- [`manual/02-proceso-de-contrato.md`](manual/02-proceso-de-contrato.md) — ciclo de vida del contrato como reglas de negocio (RC-xx): creación, verificación de documentos, numeración, firma, aprobación, beneficiarios, vigencia, pagos, anulación y vencimiento.
- [`manual/03-guia-crear-contrato-y-aprobacion.md`](manual/03-guia-crear-contrato-y-aprobacion.md) — guía paso a paso para Comercial y Aprobación: crear el contrato, documentos, firma, aprobación, programa **Kids** de principio a fin, inactivación y preguntas frecuentes.
- [`manual/pdf/LGS-proceso-crear-contrato-y-aprobacion.pdf`](manual/pdf/LGS-proceso-crear-contrato-y-aprobacion.pdf) — PDF para **NotebookLM** con la guía 03 (Parte I) y las reglas 02 (Parte II). Se regenera desde los `.md` con Chrome headless (Markdown → HTML → PDF).
- [`manual/anexos/A-matriz-permisos.md`](manual/anexos/A-matriz-permisos.md) — matriz permiso ↔ rol (autogenerada por `npm run docs:permisos`).
- [`ARCHITECTURE.md`](ARCHITECTURE.md), [`TABLAS-Y-PROCESOS.md`](TABLAS-Y-PROCESOS.md) — arquitectura y mapa de tablas.

## Exclusiones de NotebookLM (⛔ NO subir)

Estos directorios/archivos contienen material sensible y **no deben subirse a NotebookLM** ni
distribuirse a personal administrativo o terceros:

- **`docs/security/`** — inventarios de endpoints con ruta+método, gaps de autorización y demás
  superficies explotables. Ver [`security/README.md`](security/README.md).

> Al preparar la carga a NotebookLM, subir `docs/manual/` (y `ARCHITECTURE.md` / `TABLAS-Y-PROCESOS.md`)
> pero **omitir `docs/security/`**. Todo documento nuevo con rutas+métodos explotables, mapas de gates
> o credenciales va a `docs/security/`, no a `docs/manual/`.
