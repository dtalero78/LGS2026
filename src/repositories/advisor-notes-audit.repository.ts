/**
 * AdvisorNotesAudit Repository
 *
 * Inserts inmutables — registra cada edición admin sobre los campos
 * `timeout`/`notasadvisor` de CALENDARIO (Ctrl Horas).
 *
 * Solo se registra cuando el editor NO es el advisor propio del evento
 * (es decir, cuando un admin edita), o cuando la sesión ya estaba cerrada.
 * Las ediciones del propio advisor en su evento abierto NO se registran.
 */

import 'server-only';
import { queryMany, queryOne } from '@/lib/postgres';
import { ids } from '@/lib/id-generator';

export interface AdvisorNotesAuditRow {
  _id: string;
  eventoId: string;
  advisorIdAtEdit: string | null;
  actorEmail: string;
  actorRole: string;
  motivo: string;
  timeoutBefore: string | null;
  timeoutAfter: string | null;
  notasBefore: string | null;
  notasAfter: string | null;
  sesionEstabaCerrada: boolean;
  _createdDate: Date | string;
}

export interface InsertAuditInput {
  eventoId: string;
  advisorIdAtEdit: string | null;
  actorEmail: string;
  actorRole: string;
  motivo: string;
  timeoutBefore: string | null;
  timeoutAfter: string | null;
  notasBefore: string | null;
  notasAfter: string | null;
  sesionEstabaCerrada: boolean;
}

class AdvisorNotesAuditRepositoryClass {
  async insert(input: InsertAuditInput): Promise<AdvisorNotesAuditRow> {
    const _id = ids.audit();
    return (await queryOne<AdvisorNotesAuditRow>(
      `INSERT INTO "ADVISOR_NOTES_AUDIT" (
         "_id", "eventoId", "advisorIdAtEdit", "actorEmail", "actorRole", "motivo",
         "timeoutBefore", "timeoutAfter", "notasBefore", "notasAfter", "sesionEstabaCerrada"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        _id, input.eventoId, input.advisorIdAtEdit, input.actorEmail, input.actorRole, input.motivo,
        input.timeoutBefore, input.timeoutAfter, input.notasBefore, input.notasAfter, input.sesionEstabaCerrada,
      ],
    ))!;
  }

  async findByEventoId(eventoId: string): Promise<AdvisorNotesAuditRow[]> {
    return queryMany<AdvisorNotesAuditRow>(
      `SELECT * FROM "ADVISOR_NOTES_AUDIT" WHERE "eventoId" = $1 ORDER BY "_createdDate" DESC`,
      [eventoId],
    );
  }
}

export const AdvisorNotesAuditRepository = new AdvisorNotesAuditRepositoryClass();
