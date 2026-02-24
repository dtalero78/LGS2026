import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';

const API2PDF_KEY = process.env.API2PDF_KEY || '9450b12a-4c5f-4e8e-a605-2b61fe4807f2';
const WHAPI_TOKEN = 'VSyDX4j7ooAJ7UGOhz8lGplUVDDs2EYj';
const CONTRACT_BASE_URL = 'https://talero.studio/contrato';
const BSL_UPLOAD_URL = 'https://bsl-utilidades-yp78a.ondigitalocean.app/subir-pdf-directo';

export const POST = handler(async (_request, { params }) => {
  const titularId = params.id;

  // Get celular from DB
  const titular = await queryOne(
    `SELECT "celular", "primerNombre", "contrato" FROM "PEOPLE" WHERE "_id" = $1`,
    [titularId]
  );
  if (!titular) throw new NotFoundError('Titular', titularId);
  if (!titular.celular) throw new ValidationError('El titular no tiene celular registrado');

  const contractUrl = `${CONTRACT_BASE_URL}/${titularId}`;

  // 1. Generate PDF with API2PDF (delay:10000 to let the page render)
  const pdfRes = await fetch('https://v2018.api2pdf.com/chrome/url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API2PDF_KEY,
    },
    body: JSON.stringify({
      url: contractUrl,
      options: {
        printBackground: true,
        delay: 10000,
        scale: 0.75,
      },
    }),
  });

  if (!pdfRes.ok) {
    const err = await pdfRes.text();
    throw new Error(`API2PDF error ${pdfRes.status}: ${err}`);
  }

  const pdfData = await pdfRes.json();
  if (!pdfData.success || !pdfData.pdf) {
    throw new Error(`API2PDF falló: ${pdfData.error || 'Sin URL de PDF'}`);
  }

  const tempPdfUrl: string = pdfData.pdf;

  // 2. Upload PDF to Drive via bsl-utilidades (permanent URL)
  const uploadRes = await fetch(BSL_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfUrl: tempPdfUrl,
      documento: titularId,
      empresa: 'LGS',
    }),
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Drive upload error ${uploadRes.status}: ${err}`);
  }

  const uploadData = await uploadRes.json();
  // Use permanent Drive URL if available, otherwise fall back to API2PDF temp URL
  const pdfUrl: string = uploadData.url || uploadData.fileUrl || uploadData.link || tempPdfUrl;

  // 3. Send PDF via Whapi using the permanent URL
  const phone = titular.celular.toString().replace(/\D/g, '');
  const filename = titular.contrato
    ? `Contrato-${titular.contrato}.pdf`
    : `Contrato-LGS.pdf`;

  const whapiRes = await fetch('https://gate.whapi.cloud/messages/document', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'authorization': `Bearer ${WHAPI_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      to: phone,
      media: pdfUrl,
      filename,
      caption: `Hola ${titular.primerNombre || ''}, adjunto encontrarás tu contrato con LetsGoSpeak. 📄`,
    }),
  });

  if (!whapiRes.ok) {
    const err = await whapiRes.text();
    throw new Error(`Whapi error ${whapiRes.status}: ${err}`);
  }

  const whapiData = await whapiRes.json();

  return successResponse({
    pdfUrl,
    driveUpload: uploadData,
    whatsapp: whapiData,
    sentTo: phone,
  });
});
