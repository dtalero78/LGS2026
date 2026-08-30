import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/sence/error — UrlError del manual SENCE (inicio de sesión fallido).
 *
 * Ruta PÚBLICA a propósito: ver nota en /api/sence/retorno/route.ts sobre por
 * qué no puede pasar por handlerWithAuth (POST cross-site sin cookie de sesión).
 * No escribe en BD — solo reenvía el código de error al panel para que se
 * muestre un mensaje legible al alumno.
 */
export async function POST(request: NextRequest) {
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

    const redirectUrl = new URL('/panel-estudiante', request.url);
    redirectUrl.searchParams.set('senceLogin', 'error');
    if (glosaError) redirectUrl.searchParams.set('glosaError', glosaError);
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('❌ [SENCE] Error procesando retorno de error:', error);
    const redirectUrl = new URL('/panel-estudiante', request.url);
    redirectUrl.searchParams.set('senceLogin', 'error');
    return NextResponse.redirect(redirectUrl, 302);
  }
}
