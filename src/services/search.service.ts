/**
 * Search Service
 *
 * Unified search across PEOPLE and ACADEMICA tables.
 */

import 'server-only';
import { PeopleRepository } from '@/repositories/people.repository';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { ValidationError } from '@/lib/errors';

/**
 * Unified search: searches PEOPLE and ACADEMICA in parallel.
 * Matches by primerNombre, primerApellido, numeroId, or contrato.
 */
export async function unifiedSearch(term: string, limit: number = 100) {
  if (!term || term.trim().length < 2) {
    throw new ValidationError('Search term must be at least 2 characters');
  }

  const trimmed = term.trim();

  const [people, academica] = await Promise.all([
    PeopleRepository.searchUnified(trimmed, limit),
    AcademicaRepository.searchWithPeople(trimmed, limit),
  ]);

  return {
    people,
    academica,
    totalCount: people.length + academica.length,
  };
}
