/**
 * Cliente HTTP hacia el "Gestor Intermedio" de SENCE (SIC — Sistema
 * Integrado de Capacitación). Solo sabe hablar con la API externa: no toca
 * la base de datos ni decide qué alumnos/cursos enviar (eso vive en
 * `sence.service.ts`).
 *
 * Referencia: "Instructivo de Conexión: Integración entre LMS y SIC
 * (API Gestor Intermedio)" v2.0, agosto 2023.
 */

import 'server-only';
import type {
  SenceCursoEnvio,
  SenceEnvioAvanceRequest,
  SenceEnvioAvanceResponse,
  SenceHistorialProceso,
} from '@/types/sence';

const DEFAULT_BASE_URL = 'https://auladigital.sence.cl/gestor/API';
/** idSistema es siempre 1350 para esta integración (fijo por el instructivo, no configurable). */
const SENCE_ID_SISTEMA = 1350;
/**
 * Timeout largo (10 min) — el instructivo ("Manejo de Timeouts y
 * Rendimiento") advierte que el envío puede ser demandante tanto del lado
 * del cliente como del endpoint de SENCE.
 */
const REQUEST_TIMEOUT_MS = 600_000;

export class SenceApiError extends Error {
  constructor(message: string, public code?: string, public raw?: unknown) {
    super(message);
    this.name = 'SenceApiError';
  }
}

interface SenceApiConfig {
  baseUrl: string;
  rutOtec: string;
  idSistema: number;
  token: string;
}

export interface SenceHistorialOpts {
  /** Fecha desde cuándo se obtienen los registros (YYYY-MM-DD). */
  fechaDesde?: string;
  /** Código personalizado enviado como "codigoEnvio" en el proceso de envío. */
  codigoExterno?: string;
  /** ID del proceso recibido luego de un envío exitoso. */
  idProceso?: number;
}

export class SenceApiService {
  constructor(private readonly config: SenceApiConfig) {}

  /** Credenciales de autenticación, con el token normalizado a mayúsculas (exigido por SENCE). */
  private authFields(): { rutOtec: string; idSistema: number; token: string } {
    return {
      rutOtec: this.config.rutOtec,
      idSistema: this.config.idSistema,
      token: this.config.token.toUpperCase(),
    };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Prueba de conexión (sección "Prueba de Conexión" del instructivo): SENCE
   * responde HTTP 200 aunque el token sea inválido — este método solo
   * confirma que se puede alcanzar el servidor y que responde JSON.
   */
  async probarConexion(): Promise<{ ok: boolean; status: number; body: unknown }> {
    const { rutOtec, idSistema, token } = this.authFields();
    const params = new URLSearchParams({ rutOtec, idSistema: String(idSistema), token });
    const url = `${this.config.baseUrl}/avance-sic/historialEnvios?${params.toString()}`;

    const response = await this.fetchWithTimeout(url, { method: 'GET' });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  }

  /**
   * GET /avance-sic/historialEnvios — historial de todo lo enviado por el
   * OTEC, opcionalmente filtrado por fecha, código externo o id de proceso.
   */
  async obtenerHistorialEnvios(opts: SenceHistorialOpts = {}): Promise<SenceHistorialProceso[]> {
    const { rutOtec, idSistema, token } = this.authFields();
    const params = new URLSearchParams({ rutOtec, idSistema: String(idSistema), token });
    if (opts.fechaDesde) params.set('fechaDesde', opts.fechaDesde);
    if (opts.codigoExterno) params.set('codigo_externo', opts.codigoExterno);
    if (opts.idProceso !== undefined) params.set('id_proceso', String(opts.idProceso));

    const url = `${this.config.baseUrl}/avance-sic/historialEnvios?${params.toString()}`;
    const response = await this.fetchWithTimeout(url, { method: 'GET' });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new SenceApiError(
        `Error consultando historial de envíos SENCE (HTTP ${response.status})`,
        undefined,
        body,
      );
    }
    return Array.isArray(body) ? (body as SenceHistorialProceso[]) : [];
  }

  /**
   * POST /avance-sic/enviarAvance — envía el avance de UN curso completo
   * (con todos sus alumnos, módulos y actividades).
   *
   * Solo lanza `SenceApiError` ante fallo de red/HTTP no-200. Si SENCE
   * responde con `datosError` parcial (algunos alumnos/módulos con
   * problemas de formato), la respuesta se devuelve tal cual — el
   * instructivo indica que los registros correctos igual se procesan; es
   * responsabilidad del llamador inspeccionarla con `tieneErroresDeDatos()`.
   */
  async enviarAvanceCurso(curso: SenceCursoEnvio): Promise<SenceEnvioAvanceResponse> {
    const body: SenceEnvioAvanceRequest = { ...this.authFields(), ...curso };

    const response = await this.fetchWithTimeout(`${this.config.baseUrl}/avance-sic/enviarAvance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new SenceApiError(
        `Respuesta no-JSON de SENCE (HTTP ${response.status})`,
        undefined,
        responseText,
      );
    }

    if (!response.ok) {
      throw new SenceApiError(
        `Error enviando avance a SENCE (HTTP ${response.status})`,
        undefined,
        parsed,
      );
    }

    return parsed as SenceEnvioAvanceResponse;
  }
}

let cachedInstance: SenceApiService | null = null;

/**
 * Instancia singleton lazy — lee las credenciales de env vars solo la
 * primera vez que se necesitan, para no romper el arranque/build si aún no
 * están configuradas (mismo patrón que otros clientes externos del repo).
 */
export function getSenceApiService(): SenceApiService {
  if (cachedInstance) return cachedInstance;

  const rutOtec = process.env.SENCE_RUT_OTEC;
  const token = process.env.SENCE_TOKEN;
  if (!rutOtec || !token) {
    throw new SenceApiError(
      'Faltan las variables de entorno SENCE_RUT_OTEC / SENCE_TOKEN para la integración con SENCE.',
    );
  }

  cachedInstance = new SenceApiService({
    baseUrl: process.env.SENCE_API_BASE_URL || DEFAULT_BASE_URL,
    rutOtec,
    idSistema: SENCE_ID_SISTEMA,
    token,
  });
  return cachedInstance;
}
