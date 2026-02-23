import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';

const API2PDF_KEY = process.env.API2PDF_KEY || '9450b12a-4c5f-4e8e-a605-2b61fe4807f2';
const WHAPI_TOKEN = 'VSyDX4j7ooAJ7UGOhz8lGplUVDDs2EYj';
const CONTRACT_BASE_URL = 'https://talero.studio/contrato';

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

  const pdfUrl: string = pdfData.pdf;

  // 2. Send PDF via Whapi
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
      document: { link: pdfUrl },
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
    whatsapp: whapiData,
    sentTo: phone,
  });
});
