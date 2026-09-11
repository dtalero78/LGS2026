/**
 * Conversión Titular → Beneficiario
 *
 * Replica lo que hace el wizard de Crear Contrato al marcar "Este titular será
 * beneficiario", pero de forma independiente sobre un contrato ya existente:
 *   - Duplica la fila del TITULAR en PEOPLE cambiando solo `tipoUsuario` a
 *     BENEFICIARIO (todos los demás campos se copian verbatim; `_id` nuevo,
 *     `titularId` apuntando al titular, fechas NOW()).
 *   - NO crea ACADEMICA ni asigna nivel: queda como beneficiario para ser
 *     aprobado, y el nivel + el registro en ACADEMICA se resuelven en ese
 *     proceso de aprobación (igual que cualquier beneficiario nuevo). Tampoco
 *     se crea login ni financiero.
 *
 * Validación previa: si ya existe un BENEFICIARIO con el id, email o celular del
 * titular, NO se convierte (la UI muestra un modal de advertencia y cancela).
 *
 * El beneficiario queda enlazado al titular por `contrato` compartido, así que
 * aparece automáticamente en /person/[titularId] (pestaña Administración).
 */
import 'server-only';
import { PeopleRepository } from '@/repositories/people.repository';
import { ids } from '@/lib/id-generator';
import { NotFoundError, ConflictError } from '@/lib/errors';

const nombreCompleto = (p: any) =>
  [p?.primerNombre, p?.segundoNombre, p?.primerApellido, p?.segundoApellido]
    .filter(Boolean)
    .join(' ')
    .trim();

/** Busca el titular por contrato + numeroId y reporta si ya existe el beneficiario. */
export async function lookupTitular(contrato: string, numeroId: string) {
  const c = contrato.trim();
  const n = numeroId.trim();
  const titular: any = await PeopleRepository.findTitularByContratoAndNumeroId(c, n);
  if (!titular) return { found: false as const };

  // Advertencia: ¿ya existe un beneficiario con el id/email/celular del titular?
  const existente: any = await PeopleRepository.findBeneficiarioByTitularData(
    titular.numeroId, titular.email ?? null, titular.celular ?? null
  );
  return {
    found: true as const,
    beneficiarioExistente: existente
      ? {
          nombre: nombreCompleto(existente),
          numeroId: existente.numeroId,
          email: existente.email ?? null,
          celular: existente.celular ?? null,
          contrato: existente.contrato ?? null,
        }
      : null,
    titular: {
      _id: titular._id,
      nombre: nombreCompleto(titular),
      numeroId: titular.numeroId,
      celular: titular.celular ?? null,
      email: titular.email ?? null,
      contrato: titular.contrato,
      plataforma: titular.plataforma ?? null,
    },
  };
}

/**
 * Ejecuta la conversión: duplica el titular como BENEFICIARIO en PEOPLE.
 * Bloquea si ya existe un beneficiario con el id/email/celular del titular.
 */
export async function convertirTitular(contrato: string, numeroId: string) {
  const c = contrato.trim();
  const n = numeroId.trim();

  const titular: any = await PeopleRepository.findTitularByContratoAndNumeroId(c, n);
  if (!titular) throw new NotFoundError('Titular', `${c} / ${n}`);

  const existente: any = await PeopleRepository.findBeneficiarioByTitularData(
    titular.numeroId, titular.email ?? null, titular.celular ?? null
  );
  if (existente) {
    const ref = [nombreCompleto(existente), existente.numeroId, existente.contrato ? `contrato ${existente.contrato}` : null]
      .filter(Boolean).join(' · ');
    throw new ConflictError(`Ya existe un beneficiario con los datos del titular (${ref}). No se puede convertir.`);
  }

  const newBenefId = ids.person();
  const beneficiario: any = await PeopleRepository.duplicateTitularAsBeneficiario(titular._id, newBenefId);

  return {
    titularId: titular._id,
    titularNombre: nombreCompleto(titular),
    beneficiarioId: beneficiario._id,
    beneficiarioNombre: nombreCompleto(beneficiario),
    contrato: c,
  };
}
