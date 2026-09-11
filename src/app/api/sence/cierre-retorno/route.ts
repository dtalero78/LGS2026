import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/sence/cierre-retorno — UrlRetoma del manual SENCE (cierre de sesión exitoso).
 *
 * Ruta PÚBLICA a propósito: ver nota en /api/sence/retorno/route.ts sobre por
 * qué no puede pasar por handlerWithAuth (POST cross-site sin cookie de sesión).
 *
 * IMPORTANTE: la base de la redirección se arma con NEXTAUTH_URL, no con
 * request.url — en producción (Digital Ocean, detrás de Cloudflare) request.url
 * resuelve al host interno del contenedor (0.0.0.0:PORT) para este POST
 * cross-site de SENCE, no al dominio público.
 */
export async function POST(request: NextRequest) {
  const base = process.env.NEXTAUTH_URL || request.url;
  try {
    const formData = await request.formData();
    const idSesionAlumno = String(formData.get('IdSesionAlumno') || '');
    const runAlumno = String(formData.get('RunAlumno') || '');

    console.log(
      '📥 [SENCE] Retorno CerrarSesion (éxito) — form completo recibido:',
      Object.fromEntries(formData.entries())
    );
    console.log(
      `✅ [SENCE] Cierre de sesión exitoso — IdSesionAlumno=${idSesionAlumno} RunAlumno=${runAlumno}`
    );

    if (idSesionAlumno) {
      const { query } = await import('@/lib/postgres');
      await query(
        `UPDATE "ACADEMICA_BOOKINGS" SET "senceSessionClosedAt" = NOW() WHERE "_id" = $1`,
        [idSesionAlumno]
      );
    }

    const redirectUrl = new URL('/panel-estudiante', base);
    redirectUrl.searchParams.set('senceClose', 'success');
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('❌ [SENCE] Error procesando retorno de cierre exitoso:', error);
    const redirectUrl = new URL('/panel-estudiante', base);
    redirectUrl.searchParams.set('senceClose', 'error');
    return NextResponse.redirect(redirectUrl, 302);
  }
}
