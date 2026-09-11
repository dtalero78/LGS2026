import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';
import { getAcademicSnapshot } from '@/services/proteccion-historial.service';
import { buildInfoAcademicPdfHtml } from '@/lib/infoacademic-pdf-html';

const API2PDF_KEY = process.env.API2PDF_KEY || '';

/**
 * GET /api/postgres/proteccion-historial/preview?numeroId=X[&contrato=Y]
 *
 * SOLO LECTURA — para revisar el PDF del Histórico Académico antes de cablear la
 * parte destructiva. NO borra nada, NO adjunta nada.
 *   ?             → HTML en el navegador (instantáneo, gratis)
 *   ?pdf=1        → PDF real vía API2PDF (para ver paginación de la tabla)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const numeroId = (searchParams.get('numeroId') || '').trim();
  const contrato = (searchParams.get('contrato') || '').trim() || null;
  const wantPdf = searchParams.get('pdf') === '1';
  if (!numeroId) return NextResponse.json({ error: 'numeroId requerido' }, { status: 400 });

  const snap = await getAcademicSnapshot(numeroId, contrato);
  if (!snap) return NextResponse.json({ error: `Sin ficha académica para ${numeroId}` }, { status: 404 });

  const html = buildInfoAcademicPdfHtml(snap, { generadoPor: session.user?.name || 'Sistema' });

  if (!wantPdf) {
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  if (!API2PDF_KEY) return NextResponse.json({ error: 'API2PDF_KEY no configurada' }, { status: 500 });
  const pdfRes = await fetch('https://v2018.api2pdf.com/chrome/html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: API2PDF_KEY },
    body: JSON.stringify({ html, options: { printBackground: true } }),
  });
  const pdfData = await pdfRes.json();
  if (!pdfRes.ok || !pdfData?.pdf) {
    return NextResponse.json({ error: 'API2PDF falló', detail: pdfData }, { status: 502 });
  }
  return NextResponse.redirect(pdfData.pdf);
}
