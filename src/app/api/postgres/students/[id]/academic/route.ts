import { handler, successResponse } from '@/lib/api-helpers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';
import { getAcademicHistory } from '@/services/student.service';
import { ValidationError } from '@/lib/errors';
import { filtroAplica, filtrarClasesPorAdvisorChile } from '@/lib/filtro-advisors-chile';

/**
 * GET /api/postgres/students/[id]/academic
 *
 * Get student academic record + class history.
 * Filtro temporal (capacitación): para los usuarios de `filtro_advisors_chile`
 * solo se devuelven las clases con advisors de Chile (src/lib/filtro-advisors-chile.ts)
 * y `filtroAdvisorsChile: true` para que la tabla lo indique.
 */
export const GET = handler(async (request, { params }) => {
  if (!params.id) throw new ValidationError('Student ID is required');

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');

  const data: any = await getAcademicHistory(params.id, limit);

  const session = await getServerSession(authOptions).catch(() => null);
  if (await filtroAplica((session?.user as any)?.email)) {
    data.classes = await filtrarClasesPorAdvisorChile(data.classes || []);
    data.totalClasses = data.classes.length;
    data.filtroAdvisorsChile = true;
  }

  return successResponse({ data });
});
