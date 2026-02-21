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
import { queryOne } from '@/lib/postgres';

/**
 * Get student profile.
 * Prioritizes ACADEMICA (beneficiaries), falls back to PEOPLE (titulares).
 * Also looks up login password from USUARIOS_ROLES by email.
 */
export async function getProfile(id: string) {
  // Try ACADEMICA first (has JOIN with PEOPLE for full profile)
  const profile = await AcademicaRepository.findProfileById(id);
  if (profile) return enrichWithLoginPassword(profile);

  // Fallback to PEOPLE (for titulares without academic record)
  const person = await PeopleRepository.findByIdOrNumeroId(id);
  if (!person) throw new NotFoundError('Student', id);
  return enrichWithLoginPassword(person);
}

/**
 * Look up USUARIOS_ROLES.password by email and attach as claveLogin.
 */
async function enrichWithLoginPassword(profile: any) {
  if (!profile?.email) return profile;
  try {
    const user = await queryOne(
      `SELECT "password" FROM "USUARIOS_ROLES" WHERE "email" = $1`,
      [profile.email]
    );
    if (user?.password) {
      const isBcrypt = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');
      profile.claveLogin = isBcrypt ? '(Encriptada)' : user.password;
    }
  } catch (e) {
    // Non-critical — don't fail the profile
  }
  return profile;
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
  const rawClasses = await BookingRepository.findByStudentId(academicRecord._id, limit);

  // Normalize: asistio is the source of truth (asistencia column has stale/inverted data from migration)
  const classes = rawClasses.map((c: any) => ({
    ...c,
    asistencia: c.asistio != null ? c.asistio : c.asistencia,
  }));

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
  // Try ACADEMICA first (the /student/[id] page uses ACADEMICA _id)
  const academic = await AcademicaRepository.findByAnyId(id);

  // Fall back to PEOPLE if not found in ACADEMICA
  const person = academic
    ? (academic.numeroId ? await PeopleRepository.findByIdOrNumeroId(academic.numeroId) : null)
    : await PeopleRepository.findByIdOrNumeroId(id);

  const numeroId = academic?.numeroId || person?.numeroId;
  if (!academic && !person) throw new NotFoundError('Student', id);

  // Look up the nivel info for this step
  const { NivelesRepository } = await import('@/repositories/niveles.repository');
  const nivelInfo = await NivelesRepository.findByStepName(newStep);
  if (!nivelInfo) throw new NotFoundError('Step', newStep);

  const isParallel = nivelInfo.esParalelo === true;
  const nivel = nivelInfo.code;

  // Update ACADEMICA
  if (numeroId) {
    await AcademicaRepository.updateStep(numeroId, nivel, newStep, isParallel);
  }

  // Update PEOPLE
  let updatedPerson = person;
  if (person) {
    updatedPerson = await PeopleRepository.updateStep(person._id, nivel, newStep, isParallel);
  }

  const fieldNames = isParallel
    ? { nivelParalelo: nivel, stepParalelo: newStep }
    : { nivel, step: newStep };

  return {
    student: updatedPerson || academic,
    isParallel,
    updatedFields: fieldNames,
  };
}
