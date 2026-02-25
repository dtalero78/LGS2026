import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { PeopleRepository } from '@/repositories/people.repository';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/people/[id]/comments
 *
 * Returns the raw PEOPLE.comentarios field (PostgreSQL text[] stored as text).
 * The frontend parses it into structured comments.
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  const person = await PeopleRepository.findByIdOrNumeroIdOrThrow(params.id);
  const result = await PeopleRepository.getComments(person._id);

  return successResponse({ comments: result?.comentarios || null });
});

/**
 * POST /api/postgres/people/[id]/comments
 *
 * Appends a new comment JSON string to PEOPLE.comentarios text[].
 */
export const POST = handlerWithAuth(async (request, { params }, session) => {
  const body = await request.json();
  const { texto, usuario, areaDestinatario, areaRemitente } = body;

  if (!texto || texto.trim() === '') throw new ValidationError('texto is required');

  const person = await PeopleRepository.findByIdOrNumeroIdOrThrow(params.id);

  const commentObj = {
    id: `comment_${Date.now()}`,
    texto: texto.trim(),
    usuario: usuario || session.user?.email || 'admin@lgs.com',
    fecha: new Date().toISOString(),
    areaDestinatario: areaDestinatario || 'General',
    areaRemitente: areaRemitente || 'General',
  };

  await PeopleRepository.appendComment(person._id, JSON.stringify(commentObj));

  return successResponse({ message: 'Comment added successfully' });
});
