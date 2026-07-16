import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';
import { query, queryOne } from '@/lib/postgres';
import { fillContractTemplate } from '@/lib/contract-template-filler';
import { buildContractPdfHtml } from '@/lib/contract-pdf-html';
import { getAsesorInfo } from '@/lib/asesor';

const API2PDF_KEY = process.env.API2PDF_KEY || '';

/**
 * GET /api/contracts/[id]/preview
 *
 * PREVISUALIZA el contrato con el diseño real del PDF. Pensado para revisar el
 * diseño sin efectos: **NO envía WhatsApp y NO sube nada a Drive**.
 *
 *   ?           → devuelve el HTML (se abre en el navegador, instantáneo, gratis)
 *   ?pdf=1      → además lo renderiza con API2PDF y redirige al PDF real
 *                 (útil para verificar paginación / saltos de página)
 *
 * Requiere sesión. Es de solo lectura.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const titularId = params.id;
  const { searchParams } = new URL(request.url);
  const wantPdf = searchParams.get('pdf') === '1';

  // 1. Titular
  const titular = await queryOne<any>(`SELECT * FROM "PEOPLE" WHERE "_id" = $1`, [titularId]);
  if (!titular) return NextResponse.json({ error: 'Titular no encontrado' }, { status: 404 });

  // 2. Beneficiarios del mismo contrato
  const benRes = await query(
    `SELECT * FROM "PEOPLE" WHERE "contrato" = $1 AND "_id" != $2 ORDER BY "_createdDate" ASC`,
    [titular.contrato, titularId],
  );

  // 3. Financiero
  const financial = titular.contrato
    ? await queryOne<any>(
        `SELECT * FROM "FINANCIEROS" WHERE "contrato" = $1 ORDER BY "_createdDate" DESC LIMIT 1`,
        [titular.contrato],
      )
    : null;

  // 4. Template de la plataforma (tabla "ContractTemplates", con fallback
  //    case-insensitive — mismo lookup que send-pdf / auto-approve).
  let tpl = await queryOne<{ template: string }>(
    `SELECT "template" FROM "ContractTemplates" WHERE "plataforma" = $1`,
    [titular.plataforma],
  );
  if (!tpl) {
    tpl = await queryOne<{ template: string }>(
      `SELECT "template" FROM "ContractTemplates" WHERE LOWER("plataforma") = LOWER($1)`,
      [titular.plataforma],
    );
  }
  if (!tpl?.template) {
    return NextResponse.json(
      { error: `No hay plantilla de contrato para la plataforma "${titular.plataforma}"` },
      { status: 404 },
    );
  }

  // Consentimiento (si ya firmó) — mismo shape que usa regenerate-drive.
  const consentRaw = titular.consentimientoDeclarativo;
  const consentObj = typeof consentRaw === 'string' ? JSON.parse(consentRaw) : consentRaw;
  const consentData = consentObj?.aceptado || consentObj?.declaracionAceptada
    ? { hasConsent: true, consent: consentObj, hash: titular.hashConsentimiento }
    : { hasConsent: false };

  const asesorInfo = await getAsesorInfo(titular.asesor, titular.asesorCreadorContrato);

  const contractText = fillContractTemplate(
    tpl.template,
    titular,
    benRes.rows,
    financial,
    consentData as any,
    asesorInfo,
  );

  const html = buildContractPdfHtml(contractText, {
    contrato: titular.contrato,
    fecha: new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }),
  });

  // Sin ?pdf=1 → HTML directo en el navegador (gratis, instantáneo)
  if (!wantPdf) {
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // Con ?pdf=1 → PDF real vía API2PDF (verifica paginación). Sigue SIN enviar
  // WhatsApp ni subir a Drive: solo devuelve la URL temporal del PDF.
  if (!API2PDF_KEY) {
    return NextResponse.json({ error: 'API2PDF_KEY no configurada en el entorno' }, { status: 500 });
  }
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
