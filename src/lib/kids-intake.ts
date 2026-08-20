import 'server-only';

/**
 * Cliente HTTP de la "puerta de servicio" (máquina-a-máquina) de KIDS2026.
 * Autenticación por header `x-api-key`. Parametrizado por dos env vars:
 *   - KIDS_API_URL         → base URL de KIDS2026 (ej. https://kids.dominio.com o http://localhost:3002 en dev)
 *   - KIDS_INTAKE_API_KEY  → la clave de servicio (corresponde a LGS_INTAKE_API_KEY del lado de KIDS)
 *
 * Si alguna falta, la integración se considera NO configurada y los callers
 * degradan sin romper (el proceso Kids sigue capturando/guardando local).
 *
 * Endpoints (todos idempotentes por `externalRef` = N° de contrato LGS):
 *   GET  /api/kids-intake/availability
 *   POST /api/kids-intake/reservations
 *   POST /api/kids-intake/reservations/{externalRef}/approve
 */

const BASE = (process.env.KIDS_API_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.KIDS_INTAKE_API_KEY || '';

export function isKidsIntakeConfigured(): boolean {
  return !!BASE && !!API_KEY;
}

// ── Tipos de availability ──
export interface KidsSlot { tipo: string; diaSemana: number; horaLocal: string; duracionMin: number }
export interface KidsSalon {
  id: string; nombre: string; courseId: string;
  cupo: number; ocupados: number; cupoDisponible: number;
  guia: string | null; horario: KidsSlot[];
}
export interface KidsCurso { tipo: string; salones: KidsSalon[] }
export interface KidsCampania { id: string; nombre: string; inicio: string; fin: string; cursos: KidsCurso[] }
export interface KidsAvailability { campanias: KidsCampania[] }

// ── Tipos de reserva ──
export interface KidsPersona {
  nombres: string; apellidos: string; fechaNacimiento?: string | null;
  docTipo: string; docNumero: string; countryCode: string;
  email?: string | null; telefono?: string | null;
}
export interface KidsReservationInput {
  externalRef: string;      // N° de contrato LGS (clave de idempotencia)
  countryCode: string;      // 2 letras (CL/CO/EC/PE)
  tipoCurso: string;        // JUNIOR | YOUNGSTER
  inicio: string;           // YYYY-MM-DD
  finalContrato: string;    // YYYY-MM-DD (> inicio)
  classroomId: string;      // uuid del salón elegido en availability
  titular: KidsPersona;
  titularEsApoderado?: boolean;
  apoderadoNuevo?: KidsPersona;
  nino: KidsPersona & { fechaNacimiento: string }; // fechaNacimiento obligatoria para el niño
  parentesco?: string | null;
}
export interface KidsReservationResult { contractId: string; externalRef: string; enrollmentId: string }
export interface KidsCredenciales { userId: string; username: string; correo: string; passwordInicial: string }
export interface KidsApproveResult { credenciales: KidsCredenciales | null; enrollmentId: string | null }

/** Error tipado de la puerta KIDS (lleva status HTTP y code del cuerpo). */
export class KidsIntakeError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'KidsIntakeError';
    this.status = status;
    this.code = code;
  }
}

async function call<T>(method: string, path: string, body?: any): Promise<T> {
  if (!isKidsIntakeConfigured()) {
    throw new KidsIntakeError('Integración KIDS no configurada (faltan KIDS_API_URL / KIDS_INTAKE_API_KEY).');
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'x-api-key': API_KEY,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* respuesta no-JSON */ }
  if (!res.ok) {
    const msg = json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || `KIDS intake HTTP ${res.status}`;
    throw new KidsIntakeError(msg, res.status, json?.error?.code);
  }
  return json as T;
}

export const kidsIntake = {
  isConfigured: isKidsIntakeConfigured,
  /** Catálogo: campañas EN_MATRICULA con salones que tienen cupo (cascada Campaña→Curso→Salón). */
  availability: () => call<KidsAvailability>('GET', '/api/kids-intake/availability'),
  /** Crea la reserva (RESERVADA, retiene cupo). Idempotente por externalRef → 409 si ya existe. */
  createReservation: (input: KidsReservationInput) =>
    call<KidsReservationResult>('POST', '/api/kids-intake/reservations', input),
  /** Aprueba la reserva por externalRef (RESERVADA→ACTIVA). Devuelve credenciales del alumno (1 sola vez). */
  approveReservation: (externalRef: string) =>
    call<KidsApproveResult>('POST', `/api/kids-intake/reservations/${encodeURIComponent(externalRef)}/approve`),
};
