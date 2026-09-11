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
    const idSesionSence = String(formData.get('IdSesionSence') || '');
    const runAlumno = String(formData.get('RunAlumno') || '');

    console.log(
      '📥 [SENCE] Retorno IniciarSesion (éxito) — form completo recibido:',
      Object.fromEntries(formData.entries())
    );
    console.log(
      `✅ [SENCE] Inicio de sesión exitoso — IdSesionAlumno=${idSesionAlumno} IdSesionSence=${idSesionSence} RunAlumno=${runAlumno}`
    );

    if (idSesionAlumno) {
      const { query } = await import('@/lib/postgres');
      await query(
        `UPDATE "ACADEMICA_BOOKINGS" SET "idSesionSence" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`,
        [idSesionSence, idSesionAlumno]
      );

      // El inicio de sesión SENCE cuenta como el acceso/validación de ingreso a
      // Zoom (equivale a pulsar el ícono): registra ZOOM_ACCESOS para que el
      // alumno conserve el enlace y su derecho a reconexión hasta el fin de la
      // clase, aunque el ida-y-vuelta de Clave Única lo haya pasado del +10 min.
      // Best-effort: no debe romper la redirección de retorno si falla.
      try {
        const { registrarAccesoZoomPorBooking } = await import('@/services/zoom-acceso.service');
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
        await registrarAccesoZoomPorBooking(idSesionAlumno, {
          ip,
          userAgent: request.headers.get('user-agent') || '',
        });
      } catch (e) {
        console.warn('⚠️ [SENCE] No se pudo registrar el acceso a Zoom tras el login SENCE:', e);
      }
    }

    const redirectUrl = new URL('/panel-estudiante', base);
    redirectUrl.searchParams.set('senceLogin', 'success');
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('❌ [SENCE] Error procesando retorno exitoso:', error);
    const redirectUrl = new URL('/panel-estudiante', base);
    redirectUrl.searchParams.set('senceLogin', 'error');
    return NextResponse.redirect(redirectUrl, 302);
  }
}
