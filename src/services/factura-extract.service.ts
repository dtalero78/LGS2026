/**
 * Factura Extract Service — "Leer # factura" del Centro de Validación › Facturación.
 *
 * Lee con OpenAI gpt-4o-mini (visión, misma llave que "Leer recibo") el archivo
 * adjunto al pago y devuelve el NÚMERO DE FACTURA impreso (folio de la factura /
 * boleta electrónica). No guarda nada: el número solo se propone en el modal y el
 * usuario lo confirma con "Registrar Factura".
 *
 * Seguridad: solo lee archivos de NUESTRO bucket de Spaces (se descargan por key con
 * las credenciales del servidor), nunca una URL arbitraria (evita SSRF).
 */

import 'server-only';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { ValidationError } from '@/lib/errors';
import { llamarOpenAIJson, archivoComoContenidoIA } from './recibo-extract.service';

export interface FacturaExtraida {
  numeroFactura: string | null;  // solo [A-Za-z0-9-], tal como aparece impreso
  esFactura: boolean;            // false si el archivo es un comprobante de pago, no una factura
  tipoDocumento: string | null;  // "Factura electrónica", "Boleta electrónica", …
  emisor: string | null;
  fecha: string | null;          // YYYY-MM-DD
  monto: number | null;
  confianza: number | null;      // 0..1
}

const PROMPT = `Eres un extractor de datos de FACTURAS y BOLETAS ELECTRÓNICAS de Latinoamérica (Chile: factura/boleta electrónica SII con "Folio" o "N°"; Colombia: "Factura electrónica de venta No." con prefijo, p. ej. FE-1234; Ecuador: "Factura No. 001-001-000001234"; Perú: serie-número, p. ej. F001-123).

Analiza el documento adjunto y devuelve EXCLUSIVAMENTE un objeto JSON válido (sin texto adicional) con EXACTAMENTE estas claves:
{
  "esFactura": boolean,          // true solo si el documento es una FACTURA o BOLETA emitida por un vendedor.
  "numeroFactura": string|null,  // el número/folio de la factura tal como aparece impreso (con su prefijo o serie si lo tiene).
  "tipoDocumento": string|null,  // p. ej. "Factura electrónica", "Boleta electrónica", "Factura de venta".
  "emisor": string|null,         // razón social de quien emite la factura.
  "fecha": string|null,          // fecha de emisión en formato YYYY-MM-DD.
  "monto": number|null,          // total de la factura, solo el número sin símbolos ni separadores de miles.
  "confianza": number            // 0 a 1: qué tan seguro estás del número de factura.
}

Reglas ESTRICTAS:
- El número de factura NO es: el número de autorización/aprobación, la referencia o código de transacción, el número de operación bancaria, el CUFE/CUDE, el RUT/NIT, el número de resolución ni el número de orden. Si el documento es un COMPROBANTE DE PAGO o una transferencia (WebPay, Nequi, PSE, banco…), pon "esFactura": false y "numeroFactura": null.
- Si no estás seguro de cuál es el número de factura, usa null. NUNCA inventes datos.
- Responde ÚNICAMENTE el objeto JSON.`;

/** Key de Spaces a partir de una URL de nuestro bucket (o null si es de otro sitio). */
function keyDeNuestroBucket(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  const bucket = SPACES_BUCKET.toLowerCase();
  // https://<bucket>.<region>.digitaloceanspaces.com/<key>  (o el CDN del mismo bucket)
  if (!(host.startsWith(`${bucket}.`) && /\.digitaloceanspaces\.com$/.test(host))) return null;
  const key = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
  return key || null;
}

export async function extraerNumeroFacturaDesdeUrl(url: string): Promise<FacturaExtraida> {
  const key = keyDeNuestroBucket(String(url || '').trim());
  if (!key) throw new ValidationError('Solo se pueden leer archivos subidos a la plataforma.');

  let buf: Buffer;
  let contentType: string | null = null;
  try {
    const obj = await spacesClient.send(new GetObjectCommand({ Bucket: SPACES_BUCKET, Key: key }));
    if ((obj.ContentLength ?? 0) > 8 * 1024 * 1024) throw new ValidationError('El archivo supera el tamaño máximo para leerlo (8 MB).');
    buf = Buffer.from(await (obj.Body as any).transformToByteArray());
    contentType = obj.ContentType || null;
  } catch (e: any) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError(`No se pudo descargar el archivo (${e?.name || e?.message || 'error'}).`);
  }
  if (buf.length > 8 * 1024 * 1024) throw new ValidationError('El archivo supera el tamaño máximo para leerlo (8 MB).');

  const p = await llamarOpenAIJson(PROMPT, archivoComoContenidoIA(buf, contentType, key), 'facturas');

  const num = (x: any) => (x === null || x === undefined || x === '' ? null : Number(x));
  const esFactura = p.esFactura === true;
  // Mismo saneo que el campo "# Factura" del modal (solo letras, dígitos y guion).
  const limpio = typeof p.numeroFactura === 'string' ? p.numeroFactura.replace(/[^A-Za-z0-9\-]/g, '') : '';
  return {
    numeroFactura: esFactura && limpio ? limpio : null,
    esFactura,
    tipoDocumento: p.tipoDocumento ?? null,
    emisor: p.emisor ?? null,
    fecha: (typeof p.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) ? p.fecha : null,
    monto: Number.isFinite(num(p.monto)) ? (num(p.monto) as number) : null,
    confianza: Number.isFinite(num(p.confianza)) ? (num(p.confianza) as number) : null,
  };
}
