import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/sence/cierre-error — UrlError del manual SENCE (cierre de sesión fallido).
 *
 * Ruta PÚBLICA a propósito: ver nota en /api/sence/retorno/route.ts. No
 * escribe en BD — solo reenvía el código de error al panel.
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
    const glosaError = String(formData.get('GlosaError') || '');

    console.warn(
      '📥 [SENCE] Retorno CerrarSesion (error) — form completo recibido:',
      Object.fromEntries(formData.entries())
    );
    console.warn(
      `⚠️ [SENCE] Cierre de sesión fallido — IdSesionAlumno=${idSesionAlumno} GlosaError=${glosaError}`
    );

    const redirectUrl = new URL('/panel-estudiante', base);
    redirectUrl.searchParams.set('senceClose', 'error');
    if (glosaError) redirectUrl.searchParams.set('glosaError', glosaError);
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('❌ [SENCE] Error procesando retorno de cierre con error:', error);
    const redirectUrl = new URL('/panel-estudiante', base);
    redirectUrl.searchParams.set('senceClose', 'error');
    return NextResponse.redirect(redirectUrl, 302);
  }
}
