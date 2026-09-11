/**
 * Tipos de la integración con SENCE (SIC — Sistema Integrado de Capacitación)
 * vía la API REST del "Gestor Intermedio".
 *
 * Modelan el árbol Curso → Alumno → Módulo → Actividad tal como lo exige el
 * "Instructivo de Conexión: Integración entre LMS y SIC (API Gestor Intermedio)".
 *
 * Solo tipos — sin `server-only`, se pueden importar desde cualquier capa.
 */

/** 1 = Cursando · 2 = Aprobado · 3 = Reprobado */
export type SenceEstadoAlumno = 1 | 2 | 3;

/** 1 = En curso · 2 = Aprobado (nota ≥ 4) · 3 = Reprobado (nota < 4) */
export type SenceEstadoModulo = 1 | 2 | 3;

export const SENCE_ESTADO_ALUMNO = {
  CURSANDO: 1,
  APROBADO: 2,
  REPROBADO: 3,
} as const;

export const SENCE_ESTADO_MODULO = {
  EN_CURSO: 1,
  APROBADO: 2,
  REPROBADO: 3,
} as const;

export interface SenceActividad {
  /** Código de la actividad asociada a un módulo. Se trunca a 50 chars si excede. */
  codigoActividad: string;
}

export interface SenceModulo {
  /** Código del módulo asociado al alumno. */
  codigoModulo: string;
  /** Tiempo de conectividad del módulo, en segundos. */
  tiempoConectividad: number;
  estado: SenceEstadoModulo;
  /** Porcentaje de avance del módulo (0-100). */
  porcentajeAvance: number;
  /** Fecha de inicio del curso para este módulo, formato YYYY-MM-DD. */
  fechaInicio: string;
  /** Fecha de término del curso para este módulo, formato YYYY-MM-DD. */
  fechaFin: string;
  listaActividades: SenceActividad[];
  /** Porcentaje de evaluación del módulo (0-100). */
  notaModulo: number;
  cantActividadSincronica: number;
  cantActividadAsincronica: number;
}

export interface SenceAlumno {
  /** RUT del alumno sin dígito verificador. */
  rutAlumno: number;
  /** Dígito verificador del alumno. */
  dvAlumno: string;
  /** Tiempo de conectividad del alumno, en segundos. */
  tiempoConectividad: number;
  estado: SenceEstadoAlumno;
  /** Porcentaje de avance general (actividades obligatorias completadas), 0-100 entero. */
  porcentajeAvance: number;
  /** Fecha de inicio del curso, formato YYYY-MM-DD. */
  fechaInicio: string;
  /** Fecha de término del curso, formato YYYY-MM-DD. */
  fechaFin: string;
  /** Fecha a la que corresponde el avance enviado, formato YYYY-MM-DD. */
  fechaEjecucion: string;
  /** Porcentaje de nota final del alumno en el curso (0-100). */
  evaluacionFinal: number;
  listaModulos: SenceModulo[];
}

/**
 * Payload de un curso a enviar a SENCE — SIN credenciales (rutOtec/idSistema/
 * token). El cliente HTTP (`SenceApiService`) es quien las inyecta antes de
 * llamar al endpoint `enviarAvance`, para no esparcir el token por el resto
 * del código.
 */
export interface SenceCursoEnvio {
  /** Código del curso (codigoOferta entregado por SIC). */
  codigoOferta: string;
  /** Código de la sección/grupo. */
  codigoGrupo: string;
  /** ID de uso interno del ejecutor para identificar transacciones de envío. Opcional. */
  codigoEnvio?: string;
  cantActividadSincronica: number;
  cantActividadAsincronica: number;
  listaAlumnos: SenceAlumno[];
}

/** Body completo enviado a POST /avance-sic/enviarAvance (incluye credenciales). */
export interface SenceEnvioAvanceRequest extends SenceCursoEnvio {
  rutOtec: string;
  idSistema: number;
  token: string;
}

/** Respuesta cuando el envío se procesó sin errores de datos. */
export interface SenceEnvioAvanceExitoso {
  id_proceso: number;
  envio: unknown[];
  errores: unknown[];
  respuesta_SIC: string;
}

/** Un registro individual que falló dentro de un envío (parcial o total). */
export interface SenceDatoError {
  alumno: unknown;
  /** Código de error de la tabla de referencia (ver SENCE_ERROR_CODES). */
  codigo: string;
  mensaje: string;
}

/** Respuesta cuando alguno(s) de los datos enviados tuvo un problema. */
export interface SenceEnvioAvanceConErrores {
  id_proceso: number;
  datosEnviados: unknown[];
  datosError: SenceDatoError[];
  respuesta_SIC: string;
}

export type SenceEnvioAvanceResponse = SenceEnvioAvanceExitoso | SenceEnvioAvanceConErrores;

export function tieneErroresDeDatos(
  response: SenceEnvioAvanceResponse,
): response is SenceEnvioAvanceConErrores {
  return Array.isArray((response as SenceEnvioAvanceConErrores).datosError);
}

/** Un registro dentro del historial de envíos (GET historialEnvios). */
export interface SenceHistorialRegistro {
  id_registro: string;
  rut_otec: string;
  dv_otec: string;
  oferta_cod: string;
  seccion_cod: string;
  rut_alumno: string;
  dv_alumno: string;
  tiempo_conectividad: string;
  estado: string;
  porcentaje_avance: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_ejecucion: string;
  mod_cod: string | null;
  mod_tiempo_conectividad: string | null;
  mod_estado: string | null;
  mod_porcentaje_avance: string | null;
  mod_fecha_inicio: string | null;
  mod_fecha_fin: string | null;
  mod_obligatorio: string | null;
  mod_nota: string | null;
  act_cod: string | null;
  act_estado: string | null;
  /** '1' = OK, otro valor = error (ver obs_registro). */
  estado_registro: string;
  obs_registro: string;
  id_proceso_externo: string;
}

/** Un proceso de envío dentro del historial (GET historialEnvios). */
export interface SenceHistorialProceso {
  id_proceso_externo: string;
  id_lms: string;
  codigo_externo: string | null;
  fecha: string;
  horario: string | null;
  observaciones: string | null;
  observaciones_sic: string | null;
  status_code: string;
  estado: string;
  rut_otec: string;
  listaregistros: SenceHistorialRegistro[];
}

/**
 * Tabla de referencia de códigos de error del servicio `enviarAvance`
 * (sección "Envío de Datos a API REST" del instructivo). Solo para logging /
 * debug — no se usa para tomar decisiones de negocio.
 */
export const SENCE_ERROR_CODES: Record<string, string> = {
  '001': 'Token inválido: algún dato de autenticación (idSistema, RUT, token) no es válido. No se guarda registro del avance enviado.',
  '002': 'Error con la autenticación (conexión o servicio de autenticación de SENCE).',
  '003': 'El curso (codigoCurso) no se encuentra registrado en el Gestor Intermedio.',
  '010': 'El alumno (rutAlumno) no se encuentra registrado en el módulo (codigoModulo).',
  '011': 'El alumno (rutAlumno) no se encuentra registrado en este curso.',
  '012': 'El alumno (rutAlumno) no se encuentra registrado en la plataforma de SENCE.',
  '021': 'alumno.tiempoConectividad inválido (no numérico o < 0).',
  '022': 'alumno.porcentajeAvance inválido (no numérico o < 0).',
  '023': 'modulo.tiempoConectividad inválido (no numérico o < 0).',
  '024': 'modulo.porcentajeAvance inválido (no numérico o < 0).',
  '025': 'modulo.porcentajeAvance debe ser mayor al anterior (porcentajeAnterior).',
  '026': "modulo.fechaInicio inválido (formato distinto a 'yyyy-mm-dd').",
  '027': "modulo.fechaFin inválido (formato distinto a 'yyyy-mm-dd').",
  '028': 'modulo.notaModulo inválido (no numérico o < 0).',
  '029': 'modulo.cantActividadSincronica inválido (no numérico o < 0).',
  '030': 'modulo.cantActividadAsincronica inválido (no numérico o < 0).',
  '031': 'alumno.evaluacionFinal inválido (no numérico o < 0).',
  '032': 'curso.cantActividadSincronica inválido (no numérico o < 0).',
  '033': 'curso.cantActividadAsincronica inválido (no numérico o < 0).',
};
