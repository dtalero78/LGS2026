import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { updateStudent } from '@/services/student.service';

/**
 * PUT /api/postgres/students/[id]/update
 *
 * Update student information (whitelisted fields)
 */
export const PUT = handlerWithAuth(async (request, { params }) => {
  const body = await request.json();
  const student = await updateStudent(params.id, body);

  return successResponse({ student });
});
