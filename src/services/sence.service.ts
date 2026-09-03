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
import {
  tieneErroresDeDatos,
  SENCE_ESTADO_ALUMNO,
  type SenceCursoEnvio,
  type SenceAlumno,
  type SenceActividad,
  type SenceEstadoAlumno,
} from '@/types/sence';
import { getSenceConfig } from '@/lib/sence-config';
import { splitRutForSence } from '@/lib/rut-format';
import { extractStepNumber } from '@/lib/evento-compartido';
import { BookingRepository } from '@/repositories/booking.repository';
import { PeopleRepository } from '@/repositories/people.repository';
import type { CronRunResult } from '@/lib/cron-runs';

interface CursoEnvioDetail {
  codigoOferta: string;
  codigoGrupo: string;
  success: boolean;
  error?: string;
  datosError?: unknown;
}

/** Zona horaria del programa SENCE — es exclusivo de Chile. */
const SENCE_TZ = 'America/Santiago';

/** Tramo reportable a SENCE: Step 1 a 45 (BN1..F3). Más allá de esto, el curso está completo. */
const SENCE_STEP_MAX = 45;

/** Niveles posteriores a F3 — alcanzarlos implica haber completado el tramo 1-45. */
const NIVELES_APROBADOS = new Set(['MASTER', 'IELS', 'IELTS', 'B2FIRST', 'TOEFL', 'DONE']);

/** Fecha de hoy en la TZ del programa SENCE, formato YYYY-MM-DD. */
function hoySenceDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SENCE_TZ }).format(new Date());
}

/** Formatea una fecha (Date, ISO string, o null) a YYYY-MM-DD; null si no hay valor. */
function toYMD(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * % de avance acumulado del alumno sobre el tramo Step 1-45, y estado
 * (Cursando/Aprobado) resultante. Si el alumno ya está en un nivel posterior
 * a F3 (completó el tramo), se reporta 100% y Aprobado.
 */
function calcularAvance(nivel: string | null, step: string | null): { porcentajeAvance: number; estado: SenceEstadoAlumno } {
  if (NIVELES_APROBADOS.has((nivel || '').toUpperCase())) {
    return { porcentajeAvance: 100, estado: SENCE_ESTADO_ALUMNO.APROBADO };
  }
  const n = extractStepNumber(step) ?? 0;
  const porcentajeAvance = Math.round(Math.min(100, (n / SENCE_STEP_MAX) * 100));
  return { porcentajeAvance, estado: SENCE_ESTADO_ALUMNO.CURSANDO };
}

/**
 * Resuelve qué alumnos SENCE tuvieron avance HOY (aprobaron un Jump Step) y
 * arma el árbol Curso→Alumno→Módulo que exige el instructivo SENCE,
 * agrupando por `codigoGrupo` (= `ACADEMICA.senceCode`, el mismo código
 * usado en el flujo de login/logout SENCE). Cada alumno reporta un único
 * módulo fijo `lgs-course` (sin actividades todavía — placeholder hasta que
 * se modele el detalle de actividades).
 */
async function obtenerCursosParaEnviar(): Promise<SenceCursoEnvio[]> {
  const fechaHoy = hoySenceDate();
  const candidatos = await BookingRepository.findSenceAvanceCandidates(fechaHoy, SENCE_TZ);

  if (candidatos.length === 0) return [];

  const grupos = new Map<string, SenceAlumno[]>();

  for (const candidato of candidatos) {
    const contrato = await PeopleRepository.findContractDatesByNumeroId(candidato.numeroId);
    const fechaInicio = toYMD(contrato?.inicioContrato || contrato?.fechaContrato);
    const fechaFin = toYMD(contrato?.finalContrato);
    const { rutAlumno, dvAlumno } = splitRutForSence(candidato.numeroId);
    const { porcentajeAvance, estado } = calcularAvance(candidato.nivel, candidato.step);
    const listaActividades: SenceActividad[] = (
      await BookingRepository.findSenceActivityIds(candidato.academicaId)
    ).map(codigoActividad => ({ codigoActividad }));

    const alumno: SenceAlumno = {
      rutAlumno,
      dvAlumno,
      tiempoConectividad: 0,
      estado,
      porcentajeAvance,
      fechaInicio,
      fechaFin,
      fechaEjecucion: fechaHoy,
      evaluacionFinal: 0, // TODO: SET THIS
      listaModulos: [
        {
          codigoModulo: 'lgs-course',
          tiempoConectividad: 0,
          estado,
          porcentajeAvance: 100,
          fechaInicio,
          fechaFin,
          listaActividades,
          notaModulo: 0, // TODO: CHECL THIS
          cantActividadSincronica: 0,
          cantActividadAsincronica: 0,
        },
      ],
    };

    const codigoGrupo = candidato.senceCode;
    const lista = grupos.get(codigoGrupo) ?? [];
    lista.push(alumno);
    grupos.set(codigoGrupo, lista);
  }

  return Array.from(grupos.entries()).map(([codigoGrupo, listaAlumnos]) => ({
    codigoOferta: getSenceConfig().codSence,
    codigoGrupo,
    cantActividadSincronica: 0,
    cantActividadAsincronica: 0,
    listaAlumnos,
  }));
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
  obtenerCursosParaEnviar,
  enviarAvanceNocturno,
};
