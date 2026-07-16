import 'server-only';
import fs from 'fs';
import path from 'path';

/**
 * contract-pdf-html.ts — arma el HTML del contrato que se renderiza a PDF.
 *
 * Fuente ÚNICA del diseño: la usan send-pdf, auto-approve y regenerate-drive
 * (antes cada uno tenía su copia idéntica del HTML).
 *
 * El renderizador es Chrome headless (hoy vía API2PDF), así que todo el CSS de
 * impresión (@page, page-break-*, printBackground) se respeta. El diseño NO
 * depende de dónde se guarde el PDF ni de quién lo renderice.
 *
 * IMPORTANTE: `contractText` se inyecta tal cual (sin escapar) — es el
 * comportamiento existente y la plantilla puede traer marcado. El texto legal
 * NO se altera: solo se resalta visualmente (títulos en negrita) sin cambiar
 * una sola palabra.
 */

/** Logo en base64 (cacheado). Embebido para no depender de la red al renderizar. */
let logoDataUri: string | null | undefined;
function getLogo(): string | null {
  if (logoDataUri !== undefined) return logoDataUri;
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'));
    logoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    logoDataUri = null; // sin logo, el resto del diseño igual funciona
  }
  return logoDataUri;
}

const esc = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Resalta títulos del contrato SIN tocar el texto. Solo envuelve en <strong>
 * líneas que empiezan con patrones conocidos (ITEM Nº1, TITULAR:, etc.).
 * Si no matchea nada, el texto queda exactamente como estaba.
 */
function resaltarTitulos(texto: string): string {
  return texto
    // "ITEM Nº3" / "ITEM N°3" al inicio de línea
    .replace(/^(ITEM\s+N[º°]\s*\d+.*)$/gim, '<span class="item">$1</span>')
    // Encabezados en mayúsculas terminados en ":" (TITULAR:, BENEFICIARIOS:, ...)
    .replace(/^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.,´`'/()-]{3,60}:)\s*$/gm, '<span class="head">$1</span>')
    // Bloque del consentimiento
    .replace(/^(---\s*CONSENTIMIENTO DECLARATIVO VERIFICADO.*)$/gim, '<span class="consent">$1</span>')
    .replace(/^(SI,\s*ACEPTO\.?)$/gim, '<span class="acepto">$1</span>');
}

export interface ContractPdfOptions {
  /** Número de contrato — va en el encabezado y el <title>. */
  contrato?: string | null;
  /** Fecha a mostrar en el encabezado (ya formateada). */
  fecha?: string | null;
}

/** Construye el HTML completo del contrato listo para renderizar a PDF. */
export function buildContractPdfHtml(contractText: string, opts: ContractPdfOptions = {}): string {
  const contrato = (opts.contrato ?? '').toString().trim();
  const fecha = (opts.fecha ?? '').toString().trim();
  const logo = getLogo();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Contrato ${esc(contrato)}</title>
  <style>
    @page {
      margin: 16mm 16mm 18mm 18mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
    }

    /* ── Encabezado (solo primera página) ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
      margin-bottom: 18px;
    }
    .header .logo { height: 46px; width: auto; }
    .header .meta {
      text-align: right;
      font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.5;
      color: #555;
    }
    .header .meta .n {
      font-size: 12pt;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: .02em;
    }
    .header .meta .lbl {
      text-transform: uppercase;
      letter-spacing: .12em;
      font-size: 7.5pt;
      color: #8a93a3;
    }

    /* ── Cuerpo: conserva los saltos de línea del template ── */
    .doc {
      white-space: pre-wrap;
      word-wrap: break-word;
      text-align: justify;
      hyphens: auto;
    }

    /* ── Resaltados (solo presentación, el texto no cambia) ── */
    .item {
      font-weight: 700;
      font-size: 11pt;
      color: #1e40af;
      letter-spacing: .02em;
    }
    .head { font-weight: 700; color: #111; }
    .consent { font-weight: 700; color: #047857; }
    .acepto { font-weight: 700; font-size: 11pt; letter-spacing: .04em; }

    /* ── Pie (solo primera página, bajo el contenido) ── */
    .footer {
      margin-top: 22px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 7.5pt;
      color: #8a93a3;
      text-align: center;
    }

    /* ── Impresión ── */
    @media print {
      .item, .head { break-after: avoid; page-break-after: avoid; }
      .consent { break-before: auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${logo ? `<img class="logo" src="${logo}" alt="LGS">` : '<div></div>'}
    <div class="meta">
      ${contrato ? `<div class="lbl">Contrato</div><div class="n">${esc(contrato)}</div>` : ''}
      ${fecha ? `<div>${esc(fecha)}</div>` : ''}
    </div>
  </div>

  <div class="doc">${resaltarTitulos(contractText)}</div>

  <div class="footer">Let's Go Speak · Documento generado electrónicamente${contrato ? ` · Contrato ${esc(contrato)}` : ''}</div>
</body>
</html>`;
}
