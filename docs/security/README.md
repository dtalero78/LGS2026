# docs/security/ — ⛔ Contenido sensible

> **NO subir a NotebookLM. NO compartir con personal administrativo ni con terceros.**
> Acceso restringido al equipo de Tecnología / Seguridad.

Este directorio contiene documentación de **seguridad** de la plataforma: inventarios de
endpoints con su **ruta y método**, gaps de autorización y otras superficies **explotables**.
En manos equivocadas es un mapa para atacar la aplicación, por eso vive **fuera de `docs/manual/`**
(que sí se distribuye a NotebookLM y a personal administrativo).

## Reglas

- **Excluido del set que se sube a NotebookLM** — ver la lista de exclusiones en [`../README.md`](../README.md).
- No copiar su contenido a `docs/manual/` ni a ningún documento de distribución general.
- Cualquier documento nuevo con rutas+métodos explotables, mapas de gates o credenciales/tokens va **aquí**, no en `docs/manual/`.

## Contenido

- [`01-auditoria-gates.md`](01-auditoria-gates.md) — auditoría de gates de los handlers de escritura bajo `src/app/api/` (wrapper de auth, permiso exigido, pantalla que los invoca y banderas de gaps).

## Nota sobre el historial de git

Este material se movió aquí desde `docs/manual/`. El movimiento evita que siga expuesto en el
**árbol actual** (lo que se sincroniza a NotebookLM), pero el archivo **permanece accesible en el
historial** de los commits previos de la rama compartida. Sacarlo del historial requeriría
reescribir la historia y forzar el push — coordinarlo aparte si se considera necesario.
