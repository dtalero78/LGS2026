import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/sence/retorno — UrlRetoma del manual SENCE (inicio de sesión exitoso).
 *
 * Ruta PÚBLICA a propósito: SENCE redirige a esta URL con un POST cross-site
 * (application/x-www-form-urlencoded) tras el login por Clave Única — el
 * navegador no envía la cookie de sesión de NextAuth en esa navegación, así
 * que no puede pasar por handlerWithAuth. La identidad del alumno ya quedó
 * verificada por SENCE (Clave Única); acá solo asociamos el resultado al
 * booking correspondiente vía IdSesionAlumno (= nuestro bookingId).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const idSesionAlumno = String(formData.get('IdSesionAlumno') || '');
    const idSesionSence = String(formData.get('IdSesionSence') || '');
    const runAlumno = String(formData.get('RunAlumno') || '');

    console.log(
      `✅ [SENCE] Inicio de sesión exitoso — IdSesionAlumno=${idSesionAlumno} IdSesionSence=${idSesionSence} RunAlumno=${runAlumno}`
    );

    // TODO(SENCE-idSesionSence): descomentar cuando exista la columna
    // ACADEMICA_BOOKINGS."idSesionSence" en BD (la agrega otro compañero).
    // if (idSesionAlumno) {
    //   const { query } = await import('@/lib/postgres');
    //   await query(
    //     `UPDATE "ACADEMICA_BOOKINGS" SET "idSesionSence" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`,
    //     [idSesionSence, idSesionAlumno]
    //   );
    // }

    const redirectUrl = new URL('/panel-estudiante', request.url);
    redirectUrl.searchParams.set('senceLogin', 'success');
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('❌ [SENCE] Error procesando retorno exitoso:', error);
    const redirectUrl = new URL('/panel-estudiante', request.url);
    redirectUrl.searchParams.set('senceLogin', 'error');
    return NextResponse.redirect(redirectUrl, 302);
  }
}
