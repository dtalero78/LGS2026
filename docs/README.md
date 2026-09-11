# docs/ — Documentación del proyecto

Índice de la documentación del LGS Admin Panel.

## Manual (distribuible)

Material de referencia funcional/operativo. **Este es el corpus que se sube a NotebookLM** y se
comparte con personal administrativo.

- [`manual/00-inventario.md`](manual/00-inventario.md) — inventario de procesos (módulo · proceso · ruta · roles · modelos Prisma · irreversibilidad).
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
