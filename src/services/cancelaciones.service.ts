/**
 * Cancelaciones Service — gestión de "Cancelación sin reemplazo".
 */

import 'server-only';
import { CancelacionesRepository } from '@/repositories/cancelaciones.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';

const GESTION_VALIDAS = ['SIN_GESTION', 'CONTACTADO_REAGENDO', 'NO_RESPONDE'];
const GESTOR_VALIDOS = ['SERVICIO', 'ACADEMICO'];

export const cancelacionesService = {
  /**
   * Lista por vista. En 'actual' calcula `puedeGestionar` (todos los registros
   * fuera de 'SIN_GESTION') para habilitar el botón global "Gestionada".
   */
  async list(vista: 'actual' | 'historico') {
    const rows = await CancelacionesRepository.findByVista(vista);
    const puedeGestionar =
      vista === 'actual' && rows.length > 0 && rows.every((r: any) => r.gestion !== 'SIN_GESTION');
    return { rows, puedeGestionar };
  },

  async updateGestion(id: string, gestion: string, gestionadaPor: string | null | undefined) {
    if (!GESTION_VALIDAS.includes(gestion)) {
      throw new ValidationError(`Estado de gestión inválido: ${gestion}`);
    }
    const gestor = gestionadaPor && gestionadaPor.trim() ? gestionadaPor.trim() : null;
    if (gestor && !GESTOR_VALIDOS.includes(gestor)) {
      throw new ValidationError(`"Gestionada por" inválido: ${gestor}`);
    }
    const row = await CancelacionesRepository.updateGestion(id, gestion, gestor);
    if (!row) throw new NotFoundError('Registro de cancelación', id);
    return row;
  },

  /** Botón global "Gestionada": solo si NINGÚN registro actual está en 'SIN_GESTION'. */
  async gestionarTodas() {
    const total = await CancelacionesRepository.countActual();
    if (total === 0) throw new ValidationError('No hay registros pendientes para gestionar');
    const pendientes = await CancelacionesRepository.countPendientesSinGestion();
    if (pendientes > 0) {
      throw new ValidationError(`Quedan ${pendientes} registro(s) sin gestionar`);
    }
    return CancelacionesRepository.marcarActualesGestionadas();
  },
};
