/**
 * Orquestador del envío nocturno de avance a SENCE.
 *
 * Llamado por el cron `sence-envio-avance` (ver
 * `src/app/api/cron/sence-envio-avance/route.ts`). Resuelve qué cursos hay
 * que reportar y delega el envío HTTP a `SenceApiService`, agregando el
 * resultado por curso.
 */

import 'server-only';
import { getSenceApiService, SenceApiError } from '@/services/sence-api.service';
import { tieneErroresDeDatos, type SenceCursoEnvio } from '@/types/sence';
import type { CronRunResult } from '@/lib/cron-runs';

interface CursoEnvioDetail {
  codigoOferta: string;
  codigoGrupo: string;
  success: boolean;
  error?: string;
  datosError?: unknown;
}

/**
 * TODO (pendiente de definir): resolver qué alumnos/cursos SENCE deben
 * reportarse esta noche y construir el árbol Curso→Alumno→Módulo→Actividad
 * que exige el instructivo.
 *
 * Pista ya existente en el schema (sin usar todavía en este servicio):
 * `PEOPLE.sence` / `ACADEMICA.sence` (booleano, marca "Usuario SENCE") y
 * `ACADEMICA.senceCode` (código SENCE por alumno) — gestionados desde
 * `POST /api/postgres/students/[id]/sence`. Falta decidir cómo se agrupan
 * esos alumnos en `codigoOferta`/`codigoGrupo` (curso/sección) para armar
 * cada `SenceCursoEnvio`, y de dónde salen los datos de módulos/actividades
 * (dedicación, avance, notas) que exige el árbol.
 *
 * Se deja lanzando a propósito hasta que esa fuente de datos esté definida.
 */
async function obtenerCursosParaEnviar(): Promise<SenceCursoEnvio[]> {
  throw new Error(
    '[sence.service] obtenerCursosParaEnviar() no está implementado todavía: ' +
      'falta definir de dónde sale el universo de alumnos/cursos SENCE a reportar.',
  );
}

/**
 * Envía el avance de todos los cursos SENCE pendientes. Un curso que falle
 * no detiene a los demás — se agrega el detalle de cada uno.
 */
async function enviarAvanceNocturno(): Promise<CronRunResult & { metadata: { details: CursoEnvioDetail[] } }> {
  const cursos = await obtenerCursosParaEnviar();

  if (cursos.length === 0) {
    return { processedCount: 0, successCount: 0, failedCount: 0, metadata: { details: [] } };
  }

  const senceApi = getSenceApiService();
  const details: CursoEnvioDetail[] = [];

  for (const curso of cursos) {
    try {
      const respuesta = await senceApi.enviarAvanceCurso(curso);
      if (tieneErroresDeDatos(respuesta) && respuesta.datosError.length > 0) {
        details.push({
          codigoOferta: curso.codigoOferta,
          codigoGrupo: curso.codigoGrupo,
          success: false,
          error: `${respuesta.datosError.length} registro(s) con error`,
          datosError: respuesta.datosError,
        });
      } else {
        details.push({ codigoOferta: curso.codigoOferta, codigoGrupo: curso.codigoGrupo, success: true });
      }
    } catch (err) {
      details.push({
        codigoOferta: curso.codigoOferta,
        codigoGrupo: curso.codigoGrupo,
        success: false,
        error: err instanceof SenceApiError ? err.message : err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  }

  const successCount = details.filter(d => d.success).length;
  return {
    processedCount: cursos.length,
    successCount,
    failedCount: details.length - successCount,
    metadata: { details },
  };
}

export const senceService = {
  enviarAvanceNocturno,
};
