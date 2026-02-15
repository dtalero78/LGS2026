/**
 * Contract Service
 *
 * Business logic for contract extensions and OnHold management.
 */

import 'server-only';
import { PeopleRepository } from '@/repositories/people.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';

// ── Contract Extension ──

interface ExtendByDaysInput {
  studentId: string;
  diasExtension: number;
  motivo: string;
  ejecutadoPor: string;
  ejecutadoPorEmail: string;
}

export async function extendByDays(input: ExtendByDaysInput) {
  if (!input.diasExtension || input.diasExtension <= 0) {
    throw new ValidationError('diasExtension must be a positive number');
  }
  if (!input.motivo?.trim()) {
    throw new ValidationError('motivo is required');
  }

  const person = await PeopleRepository.findByIdOrThrow(input.studentId);

  if (!person.finalContrato) {
    throw new ValidationError('Student does not have a contract end date (finalContrato)');
  }

  const currentFinal = new Date(person.finalContrato);
  const newFinal = new Date(currentFinal);
  newFinal.setDate(newFinal.getDate() + input.diasExtension);

  const today = new Date();
  const newVigencia = Math.ceil((newFinal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const currentHistory = Array.isArray(person.extensionHistory) ? person.extensionHistory : [];
  const extensionEntry = {
    numero: (person.extensionCount || 0) + 1,
    fechaEjecucion: new Date().toISOString(),
    vigenciaAnterior: currentFinal.toISOString().split('T')[0],
    vigenciaNueva: newFinal.toISOString().split('T')[0],
    diasExtendidos: input.diasExtension,
    motivo: input.motivo,
    ejecutadoPor: input.ejecutadoPor,
    ejecutadoPorEmail: input.ejecutadoPorEmail,
  };

  const updatedHistory = [...currentHistory, extensionEntry];

  const student = await PeopleRepository.extendContract(
    input.studentId,
    newFinal.toISOString().split('T')[0],
    newVigencia,
    updatedHistory
  );

  return {
    student,
    extension: {
      vigenciaAnterior: currentFinal.toISOString().split('T')[0],
      vigenciaNueva: newFinal.toISOString().split('T')[0],
      diasExtendidos: input.diasExtension,
      nuevaVigencia: newVigencia,
      motivo: input.motivo,
    },
    extensionEntry,
  };
}

interface ExtendToDateInput {
  studentId: string;
  nuevaFecha: string;
  motivo: string;
  ejecutadoPor: string;
  ejecutadoPorEmail: string;
}

export async function extendToDate(input: ExtendToDateInput) {
  const person = await PeopleRepository.findByIdOrThrow(input.studentId);

  if (!person.finalContrato) {
    throw new ValidationError('Student does not have a contract end date (finalContrato)');
  }
  if (!input.motivo?.trim()) {
    throw new ValidationError('motivo is required');
  }

  const currentFinal = new Date(person.finalContrato);
  const newFinal = new Date(input.nuevaFecha);

  if (newFinal <= currentFinal) {
    throw new ValidationError('nuevaFecha must be after current finalContrato');
  }

  const diasExtendidos = Math.ceil(
    (newFinal.getTime() - currentFinal.getTime()) / (1000 * 60 * 60 * 24)
  );

  return extendByDays({
    studentId: input.studentId,
    diasExtension: diasExtendidos,
    motivo: input.motivo,
    ejecutadoPor: input.ejecutadoPor,
    ejecutadoPorEmail: input.ejecutadoPorEmail,
  });
}

// ── OnHold ──

interface ActivateOnHoldInput {
  studentId: string;
  fechaOnHold: string;
  fechaFinOnHold: string;
  motivo?: string;
  activadoPor: string;
}

export async function activateOnHold(input: ActivateOnHoldInput) {
  if (!input.fechaOnHold || !input.fechaFinOnHold) {
    throw new ValidationError('fechaOnHold and fechaFinOnHold are required');
  }

  const person = await PeopleRepository.findByIdOrThrow(input.studentId);

  const currentHistory = Array.isArray(person.onHoldHistory) ? person.onHoldHistory : [];
  const onHoldEntry = {
    fechaActivacion: new Date().toISOString(),
    fechaOnHold: input.fechaOnHold,
    fechaFinOnHold: input.fechaFinOnHold,
    motivo: input.motivo || '',
    activadoPor: input.activadoPor,
  };

  const updatedHistory = [...currentHistory, onHoldEntry];

  const student = await PeopleRepository.activateOnHold(
    input.studentId,
    input.fechaOnHold,
    input.fechaFinOnHold,
    updatedHistory
  );

  return { student, onHoldEntry };
}

export async function deactivateOnHold(studentId: string) {
  const person = await PeopleRepository.findByIdOrThrow(studentId);

  if (!person.fechaOnHold || !person.fechaFinOnHold) {
    throw new ValidationError('Student is not currently on hold');
  }
  if (!person.finalContrato) {
    throw new ValidationError('Student does not have a contract end date');
  }

  // Calculate paused days
  const fechaOnHold = new Date(person.fechaOnHold);
  const fechaFinOnHold = new Date(person.fechaFinOnHold);
  const daysPaused = Math.ceil(
    (fechaFinOnHold.getTime() - fechaOnHold.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Extend contract automatically
  const currentFinal = new Date(person.finalContrato);
  const newFinal = new Date(currentFinal);
  newFinal.setDate(newFinal.getDate() + daysPaused);

  const today = new Date();
  const newVigencia = Math.ceil(
    (newFinal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Build extension history entry
  const currentExtHistory = Array.isArray(person.extensionHistory) ? person.extensionHistory : [];
  const extensionEntry = {
    numero: (person.extensionCount || 0) + 1,
    fechaEjecucion: new Date().toISOString(),
    vigenciaAnterior: currentFinal.toISOString().split('T')[0],
    vigenciaNueva: newFinal.toISOString().split('T')[0],
    diasExtendidos: daysPaused,
    motivo: `Extensión automática por OnHold (${daysPaused} días pausados desde ${person.fechaOnHold} hasta ${person.fechaFinOnHold})`,
  };

  const updatedExtHistory = [...currentExtHistory, extensionEntry];

  const student = await PeopleRepository.deactivateOnHold(
    studentId,
    newFinal.toISOString().split('T')[0],
    newVigencia,
    updatedExtHistory
  );

  return {
    student,
    extension: {
      daysPaused,
      previousFinalContrato: currentFinal.toISOString().split('T')[0],
      newFinalContrato: newFinal.toISOString().split('T')[0],
      newVigencia,
    },
    extensionEntry,
  };
}
