import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/sence/cierre-error — UrlError del manual SENCE (cierre de sesión fallido).
 *
 * Ruta PÚBLICA a propósito: ver nota en /api/sence/retorno/route.ts. No
 * escribe en BD — solo reenvía el código de error al panel.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const idSesionAlumno = String(formData.get('IdSesionAlumno') || '');
    const glosaError = String(formData.get('GlosaError') || '');

    console.warn(
      `⚠️ [SENCE] Cierre de sesión fallido — IdSesionAlumno=${idSesionAlumno} GlosaError=${glosaError}`
    );

    const redirectUrl = new URL('/panel-estudiante', request.url);
    redirectUrl.searchParams.set('senceClose', 'error');
    if (glosaError) redirectUrl.searchParams.set('glosaError', glosaError);
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('❌ [SENCE] Error procesando retorno de cierre con error:', error);
    const redirectUrl = new URL('/panel-estudiante', request.url);
    redirectUrl.searchParams.set('senceClose', 'error');
    return NextResponse.redirect(redirectUrl, 302);
  }
}
