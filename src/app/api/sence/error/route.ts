import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/sence/error — UrlError del manual SENCE (inicio de sesión fallido).
 *
 * Ruta PÚBLICA a propósito: ver nota en /api/sence/retorno/route.ts sobre por
 * qué no puede pasar por handlerWithAuth (POST cross-site sin cookie de sesión).
 * No escribe en BD — solo reenvía el código de error al panel para que se
 * muestre un mensaje legible al alumno.
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
      '📥 [SENCE] Retorno IniciarSesion (error) — form completo recibido:',
      Object.fromEntries(formData.entries())
    );
    console.warn(
      `⚠️ [SENCE] Inicio de sesión fallido — IdSesionAlumno=${idSesionAlumno} GlosaError=${glosaError}`
    );

    const redirectUrl = new URL('/panel-estudiante', base);
    redirectUrl.searchParams.set('senceLogin', 'error');
    if (glosaError) redirectUrl.searchParams.set('glosaError', glosaError);
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('❌ [SENCE] Error procesando retorno de error:', error);
    const redirectUrl = new URL('/panel-estudiante', base);
    redirectUrl.searchParams.set('senceLogin', 'error');
    return NextResponse.redirect(redirectUrl, 302);
  }
}
