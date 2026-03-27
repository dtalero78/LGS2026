import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { getStats } from '@/services/dashboard.service';

export const POST = handlerWithAuth(async () => {
  try {
    console.log('📊 Dashboard Stats: Fetching from PostgreSQL');
    const data = await getStats();

    const stats = {
      totalUsuarios: data.totalUsers,
      totalInactivos: data.inactiveUsers,
      sesionesHoy: data.eventsToday,
      usuariosInscritosHoy: data.enrollmentsToday,
      advisorsHoy: data.uniqueAdvisorsToday,
    };

    console.log('📊 Dashboard Stats:', stats);
    return successResponse({ stats, source: 'postgres' });
  } catch (error: any) {
    console.error('📊 Dashboard Stats Error:', error.message);
    return successResponse({
      stats: { totalUsuarios: 0, totalInactivos: 0, sesionesHoy: 0, usuariosInscritosHoy: 0, advisorsHoy: 0 },
      source: 'fallback',
    });
  }
});
