import 'server-only';
import { withTransaction } from '@/lib/postgres';

/**
 * Contrato RETRACTADO (2026-10-06): el cliente se retractó dentro del plazo legal.
 * No es un "Contrato nulo": conserva estado RETRACTADO (pestaña propia en la
 * Limpieza de Anulados, para decidir si se borra o se conserva como histórico),
 * pero inhabilita a TODAS las personas del contrato:
 *   - PEOPLE: titular + beneficiarios → estadoInactivo=true, estado='RETRACTADO'
 *   - ACADEMICA: las fichas de esos beneficiarios (ligadas por usuarioId o por
 *     contrato) → estadoInactivo=true
 *   - USUARIOS_ROLES: el acceso ESTUDIANTE de esos beneficiarios → activo=false
 * El acceso solo se corta si el correo no pertenece a un beneficiario VIVO de
 * otro contrato (re-matrícula en curso).
 */
export async function inhabilitarContratoRetractado(contrato: string): Promise<{ beneficiarios: number; fichas: number; logins: number }> {
  return withTransaction(async (client) => {
    const people = await client.query(
      `UPDATE "PEOPLE" SET "estadoInactivo" = true, "estado" = 'RETRACTADO', "_updatedDate" = NOW()
        WHERE "contrato" = $1
        RETURNING "_id", "tipoUsuario"`,
      [contrato]);
    const benefIds = people.rows.filter((r: any) => r.tipoUsuario !== 'TITULAR').map((r: any) => r._id);

    const fichas = await client.query(
      `UPDATE "ACADEMICA" SET "estadoInactivo" = true, "_updatedDate" = NOW()
        WHERE "usuarioId" = ANY($1::text[]) OR "contrato" = $2`,
      [benefIds, contrato]);

    const logins = await client.query(
      `UPDATE "USUARIOS_ROLES" u SET "activo" = false
        WHERE UPPER(COALESCE(u."rol",'')) = 'ESTUDIANTE'
          AND LOWER(TRIM(u."email")) IN (
                SELECT LOWER(TRIM(p."email")) FROM "PEOPLE" p
                 WHERE p."_id" = ANY($1::text[]) AND COALESCE(p."email",'') <> '')
          AND NOT EXISTS (
                SELECT 1 FROM "PEOPLE" o
                 WHERE LOWER(TRIM(o."email")) = LOWER(TRIM(u."email"))
                   AND o."contrato" IS DISTINCT FROM $2 AND o."tipoUsuario" <> 'TITULAR'
                   AND UPPER(COALESCE(o."estado",'')) NOT IN ('FINALIZADA','ANULADO','RETRACTADO')
                   AND UPPER(COALESCE(o."aprobacion",'')) NOT IN ('CONTRATO NULO','DEVUELTO','RECHAZADO','RETRACTADO')
                   AND (o."estadoInactivo" IS NOT TRUE OR o."fechaOnHold" IS NOT NULL))`,
      [benefIds, contrato]);

    return { beneficiarios: benefIds.length, fichas: fichas.rowCount || 0, logins: logins.rowCount || 0 };
  });
}
