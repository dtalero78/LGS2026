import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';
import { redirect } from 'next/navigation';
import { queryOne } from '@/lib/postgres';

/**
 * Server Layout for /panel-estudiante.
 * Redirects ESTUDIANTE to /student-setup if perfilActualizado is NULL.
 * /student-setup lives outside this layout to avoid redirect loops.
 * Students can skip — perfilActualizado stays null → asked again next login.
 */
export default async function PanelEstudianteLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role  = (session?.user as any)?.role;
  const email = session?.user?.email;

  if (role === 'ESTUDIANTE' && email) {
    const ur = await queryOne<{ perfilActualizado: string | null }>(
      `SELECT "perfilActualizado" FROM "USUARIOS_ROLES" WHERE LOWER("email") = LOWER($1) LIMIT 1`,
      [email]
    ).catch(() => null);

    if (ur && ur.perfilActualizado === null) {
      redirect('/student-setup');
    }
  }

  return <>{children}</>;
}
