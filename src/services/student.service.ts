/**
 * Student Service
 *
 * Business logic for student profiles, academic history, step changes,
 * and status management.
 */

import 'server-only';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { PeopleRepository } from '@/repositories/people.repository';
import { BookingRepository } from '@/repositories/booking.repository';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * Get student profile.
 * Prioritizes ACADEMICA (beneficiaries), falls back to PEOPLE (titulares).
 */
export async function getProfile(id: string) {
  // Try ACADEMICA first (has JOIN with PEOPLE for full profile)
  const profile = await AcademicaRepository.findProfileById(id);
  if (profile) return profile;

  // Fallback to PEOPLE (for titulares without academic record)
  const person = await PeopleRepository.findByIdOrNumeroId(id);
  if (!person) throw new NotFoundError('Student', id);
  return person;
}

/**
 * Get academic history: academic record + class list.
 */
export async function getAcademicHistory(id: string, limit: number = 100) {
  // Try ACADEMICA by any ID field
  let academicRecord = await AcademicaRepository.findByAnyId(id);

  // Fallback: find person, then look up ACADEMICA by numeroId
  if (!academicRecord) {
    const person = await PeopleRepository.findByIdOrNumeroId(id);
    if (person?.numeroId) {
      academicRecord = await AcademicaRepository.findByNumeroId(person.numeroId);
    }
  }

  if (!academicRecord) throw new NotFoundError('Academic record', id);

  // Get class history using the student's _id
  const classes = await BookingRepository.findByStudentId(academicRecord._id, limit);

  return {
    academicRecord,
    classes,
    totalClasses: classes.length,
  };
}

/**
 * Update student fields (whitelisted).
 */
const ALLOWED_UPDATE_FIELDS = [
  'primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido',
  'email', 'celular', 'telefono', 'fechaNacimiento', 'genero',
  'ciudad', 'domicilio', 'nivel', 'step', 'nivelParalelo', 'stepParalelo',
  'plataforma', 'plan', 'contrato', 'vigencia', 'finalContrato',
  'estadoInactivo', 'empresa', 'cargo', 'ingresos', 'medioPago',
  'asesor', 'agenteAsignado', 'asesorAsignado',
  'comentarios', 'comentariosAdministrativo', 'observacionesContrato',
  'tipoUsuario', 'estado', 'numeroId',
];

export async function updateStudent(id: string, body: Record<string, any>) {
  const student = await PeopleRepository.updateFields(id, body, ALLOWED_UPDATE_FIELDS);
  if (!student) throw new ValidationError('No valid fields to update');
  return student;
}

/**
 * Toggle student active/inactive status.
 * Returns null if status is already the same (no-op).
 */
export async function toggleStatus(id: string, active: boolean) {
  const person = await PeopleRepository.findByIdOrThrow(id);

  const currentlyInactive = person.estadoInactivo === true;
  const wantInactive = !active;

  if (currentlyInactive === wantInactive) {
    return { student: person, statusChanged: false };
  }

  const updated = await PeopleRepository.toggleStatus(id, wantInactive);
  return {
    student: updated,
    statusChanged: true,
    previousStatus: currentlyInactive,
    newStatus: wantInactive,
  };
}

/**
 * Change student step (regular or parallel level).
 * Updates both PEOPLE and ACADEMICA tables.
 */
export async function changeStep(
  id: string,
  newStep: string
) {
  const person = await PeopleRepository.findByIdOrNumeroIdOrThrow(id);

  // Look up the nivel info for this step
  const { NivelesRepository } = await import('@/repositories/niveles.repository');
  const nivelInfo = await NivelesRepository.findByStepName(newStep);
  if (!nivelInfo) throw new NotFoundError('Step', newStep);

  const isParallel = nivelInfo.esParalelo === true;
  const nivel = nivelInfo.code;

  // Update PEOPLE
  const updatedPerson = await PeopleRepository.updateStep(person._id, nivel, newStep, isParallel);

  // Update ACADEMICA (uses numeroId)
  if (person.numeroId) {
    await AcademicaRepository.updateStep(person.numeroId, nivel, newStep, isParallel);
  }

  const fieldNames = isParallel
    ? { nivelParalelo: nivel, stepParalelo: newStep }
    : { nivel, step: newStep };

  return {
    student: updatedPerson,
    isParallel,
    updatedFields: fieldNames,
  };
}
