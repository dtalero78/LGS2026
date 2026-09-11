import 'server-only';

/**
 * Configuración de la integración SENCE (Registro de Asistencia).
 *
 * Credenciales (`rutOtec`, `token`, `codSence`, `ambiente`) vienen de
 * variables de entorno — mismo patrón que `getSenceApiService()` en
 * `sence-api.service.ts`. `lineaCapacitacion` NO es secreta (es un valor
 * fijo del programa "Impulsa Personas"), así que se deja hardcodeada aquí,
 * igual que `SENCE_ID_SISTEMA` en `sence-api.service.ts`.
 *
 * CodigoCurso NO vive aquí — es por alumno, se lee de ACADEMICA.senceCode.
 */

const LINEA_CAPACITACION = 3; // 3 = Impulsa Personas

export interface SenceConfig {
  ambiente: 'test' | 'produccion';
  rutOtec: string;
  token: string;
  codSence: string;
  lineaCapacitacion: number;
}

let cachedConfig: SenceConfig | null = null;

/**
 * Lee la configuración SENCE desde variables de entorno, cacheada tras la
 * primera lectura. Lanza error si faltan `SENCE_RUT_OTEC` / `SENCE_COD_SENCE`
 * (credenciales reales de la integración); `SENCE_TOKEN` queda opcional
 * (pendiente de generar en https://sistemas.sence.cl/rts).
 */
export function getSenceConfig(): SenceConfig {
  if (cachedConfig) return cachedConfig;

  const rutOtec = process.env.SENCE_RUT_OTEC;
  const codSence = process.env.SENCE_COD_SENCE;
  if (!rutOtec || !codSence) {
    throw new Error(
      'Faltan las variables de entorno SENCE_RUT_OTEC / SENCE_COD_SENCE para la integración con SENCE.',
    );
  }

  cachedConfig = {
    ambiente: process.env.SENCE_AMBIENTE === 'produccion' ? 'produccion' : 'test',
    rutOtec,
    token: process.env.SENCE_TOKEN || '',
    codSence,
    lineaCapacitacion: LINEA_CAPACITACION,
  };
  return cachedConfig;
}

/** URL de inicio/cierre de sesión SENCE según el ambiente configurado. */
export function getSenceActionUrl(accion: 'IniciarSesion' | 'CerrarSesion' = 'IniciarSesion'): string {
  const base = getSenceConfig().ambiente === 'produccion'
    ? 'https://sistemas.sence.cl/rce/Registro'
    : 'https://sistemas.sence.cl/rcetest/Registro';
  return `${base}/${accion}`;
}
