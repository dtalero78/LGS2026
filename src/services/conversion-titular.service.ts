/**
 * Conversión Titular → Beneficiario
 *
 * Replica lo que hace el wizard de Crear Contrato al marcar "Este titular será
 * beneficiario", pero de forma independiente sobre un contrato ya existente:
 *   - Duplica la fila del TITULAR en PEOPLE cambiando solo `tipoUsuario` a
 *     BENEFICIARIO (todos los demás campos se copian verbatim; `_id` nuevo,
 *     `titularId` apuntando al titular, fechas NOW()).
 *   - Lo ubica en WELCOME creando su registro en ACADEMICA.
 *   - Queda listo para ser aprobado (no se crea login ni financiero — eso ocurre
 *     después en el flujo normal de aprobación/registro).
 *
 * El beneficiario queda enlazado al titular por `contrato` compartido, así que
 * aparece automáticamente en /person/[titularId] (pestaña Administración).
 */
import 'server-only';
import { PeopleRepository } from '@/repositories/people.repository';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { withTransaction } from '@/lib/postgres';
import { ids } from '@/lib/id-generator';
import { NotFoundError, ConflictError } from '@/lib/errors';

const nombreCompleto = (p: any) =>
  [p?.primerNombre, p?.segundoNombre, p?.primerApellido, p?.segundoApellido]
    .filter(Boolean)
    .join(' ')
    .trim();

/** Busca el titular por contrato + numeroId y reporta si ya fue convertido. */
export async function lookupTitular(contrato: string, numeroId: string) {
  const c = contrato.trim();
  const n = numeroId.trim();
  const titular = await PeopleRepository.findTitularByContratoAndNumeroId(c, n);
  if (!titular) return { found: false as const };

  const yaConvertido = await PeopleRepository.existsBeneficiarioByNumeroIdAndContrato(n, c);
  return {
    found: true as const,
    yaConvertido,
    titular: {
      _id: (titular as any)._id,
      nombre: nombreCompleto(titular),
      numeroId: (titular as any).numeroId,
      celular: (titular as any).celular ?? null,
      email: (titular as any).email ?? null,
      contrato: (titular as any).contrato,
      plataforma: (titular as any).plataforma ?? null,
    },
  };
}

/**
 * Ejecuta la conversión: duplica el titular como beneficiario (PEOPLE) + lo ubica
 * en WELCOME (ACADEMICA), todo en una transacción.
 */
export async function convertirTitular(contrato: string, numeroId: string) {
  const c = contrato.trim();
  const n = numeroId.trim();

  const titular: any = await PeopleRepository.findTitularByContratoAndNumeroId(c, n);
  if (!titular) throw new NotFoundError('Titular', `${c} / ${n}`);

  if (await PeopleRepository.existsBeneficiarioByNumeroIdAndContrato(n, c)) {
    throw new ConflictError('Este titular ya fue convertido en beneficiario para este contrato');
  }

  const newBenefId = ids.person();

  const beneficiario: any = await withTransaction(async (client) => {
    const benef = await PeopleRepository.duplicateTitularAsBeneficiario(titular._id, newBenefId, client);
    await AcademicaRepository.createWelcomeRecord(
      {
        _id: ids.academic(),
        numeroId: titular.numeroId,
        primerNombre: titular.primerNombre,
        segundoNombre: titular.segundoNombre,
        primerApellido: titular.primerApellido,
        segundoApellido: titular.segundoApellido,
        email: titular.email,
        celular: titular.celular,
        plataforma: titular.plataforma,
      },
      client
    );
    return benef;
  });

  return {
    titularId: titular._id,
    titularNombre: nombreCompleto(titular),
    beneficiarioId: beneficiario._id,
    beneficiarioNombre: nombreCompleto(beneficiario),
    contrato: c,
  };
}
