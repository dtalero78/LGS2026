import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { PeopleRepository } from '@/repositories/people.repository';
import { CommentsRepository } from '@/repositories/comments.repository';
import { ValidationError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

/**
 * GET /api/postgres/people/[id]/comments
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const person = await PeopleRepository.findByIdOrNumeroIdOrThrow(params.id);
  const comments = await CommentsRepository.findByPersonId(person._id, person.numeroId, limit, offset);
  const totalComments = await CommentsRepository.countByPersonId(person._id, person.numeroId);

  return successResponse({
    person: { _id: person._id, numeroId: person.numeroId, nombre: `${person.primerNombre} ${person.primerApellido}` },
    comments,
    count: comments.length,
    totalComments,
    pagination: { limit, offset, hasMore: offset + comments.length < totalComments },
  });
});

/**
 * POST /api/postgres/people/[id]/comments
 */
export const POST = handlerWithAuth(async (request, { params, session }) => {
  const body = await request.json();
  const { comentario, tipo } = body;

  if (!comentario || comentario.trim() === '') throw new ValidationError('comentario is required');

  const person = await PeopleRepository.findByIdOrNumeroIdOrThrow(params.id);

  const comment = await CommentsRepository.create({
    _id: ids.comment(),
    personId: person._id,
    numeroId: person.numeroId,
    comentario: comentario.trim(),
    tipo: tipo || 'GENERAL',
    creadoPor: session.user?.name || 'System',
    creadoPorEmail: session.user?.email || 'system@lgs.com',
    creadoPorRol: (session.user as any)?.rol || 'USER',
  });

  return successResponse({ message: 'Comment added successfully', comment });
});
