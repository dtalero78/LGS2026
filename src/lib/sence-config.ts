/**
 * Configuración de la integración SENCE (Registro de Asistencia).
 *
 * Etapa actual: valores hardcodeados en código (decisión del usuario, aún no
 * definido si pasarán a APP_CONFIG o variables de entorno). Este módulo es el
 * único lugar que hay que tocar para: (a) mover la config a BD/env vars más
 * adelante, (b) pasar de Ambiente Test a Producción.
 *
 * CodigoCurso NO vive aquí — es por alumno, se lee de ACADEMICA.senceCode.
 */

export const SENCE_CONFIG = {
  ambiente: 'test' as 'test' | 'produccion', // cambiar aquí cuando se pase a Producción
  rutOtec: '77320181-1',
  token: '', // TODO: pendiente — se generará en https://sistemas.sence.cl/rts
  codSence: '1238074880',
  lineaCapacitacion: 3, // 3 = Impulsa Personas
};

/** URL de inicio/cierre de sesión SENCE según el ambiente configurado. */
export function getSenceActionUrl(accion: 'IniciarSesion' | 'CerrarSesion' = 'IniciarSesion'): string {
  const base = SENCE_CONFIG.ambiente === 'produccion'
    ? 'https://sistemas.sence.cl/rce/Registro'
    : 'https://sistemas.sence.cl/rcetest/Registro';
  return `${base}/${accion}`;
}
