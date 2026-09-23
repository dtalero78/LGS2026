import 'server-only';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

/**
 * Genera el certificado de finalización de nivel (Beginner / Practical / Functional)
 * en PDF, usando la plantilla de arte (imagen de fondo en public/certificados/) y
 * sobreimprimiendo: nombre del estudiante, horas y fecha de aprobación del jump.
 *
 * El PDF sale CIFRADO (AES-128): `userPassword` = número de documento del alumno.
 * Página Letter HORIZONTAL (792×612 pt), misma proporción que las plantillas 3300×2550.
 */

export type NivelCertificado = 'beginner' | 'practical' | 'functional';

export interface CertificadoData {
  nivel: NivelCertificado;
  nombre: string;
  horas: number;
  fecha: string | Date | null;   // fecha de aprobación del jump
  password: string;              // numeroId del estudiante en ACADEMICA
}

const W = 792, H = 612;

// Posiciones (fracción de la página) de cada texto sobre la plantilla.
// Fáciles de ajustar si algún elemento queda corrido respecto al arte.
const POS = {
  nombre: { cx: 0.68, yTop: 0.470, boxW: 0.58, size: 26, color: '#1f2937' },
  // "60" centrado en el blanco de "____ hours of instruction" (a la izquierda de "hours", sobre la línea).
  horas:  { cx: 0.49, yTop: 0.640, size: 14, color: '#1f2937' },
  // Fecha en el hueco entre la frase "To live..." (arriba) y las firmas (abajo), sin montarse en ninguna.
  fecha:  { cx: 0.68, yTop: 0.710, boxW: 0.58, size: 12, color: '#374151' },
};

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function fmtFecha(v: string | Date | null): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function bgPath(nivel: NivelCertificado): string | null {
  try {
    const p = path.join(process.cwd(), 'public', 'certificados', `${nivel}.png`);
    return fs.existsSync(p) ? p : null;
  } catch { return null; }
}

export async function buildCertificadoPdf(data: CertificadoData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margin: 0,
        pdfVersion: '1.7',
        userPassword: data.password || undefined,
        ownerPassword: `LGS-CERT-${data.nivel}-${Date.now()}`,
        permissions: { printing: 'highResolution', copying: false, modifying: false },
        info: { Title: `Certificado ${data.nivel} — ${data.nombre}`, Author: "Let's Go Speak" },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Fondo (plantilla de arte a página completa)
      const bg = bgPath(data.nivel);
      if (bg) {
        try { doc.image(bg, 0, 0, { width: W, height: H }); } catch { /* fondo opcional */ }
      }

      // Nombre — centrado sobre la línea, ajusta el tamaño si es muy largo
      const boxW = POS.nombre.boxW * W;
      const xName = POS.nombre.cx * W - boxW / 2;
      let fs1 = POS.nombre.size;
      doc.font('Helvetica-Bold').fontSize(fs1);
      while (fs1 > 12 && doc.widthOfString(data.nombre || '') > boxW - 8) { fs1 -= 1; doc.fontSize(fs1); }
      doc.fillColor(POS.nombre.color).text(data.nombre || '', xName, POS.nombre.yTop * H, { width: boxW, align: 'center', lineBreak: false });

      // Horas (ej. "60") en el blanco de "____ hours of instruction"
      doc.font('Helvetica-Bold').fontSize(POS.horas.size).fillColor(POS.horas.color)
        .text(String(data.horas), POS.horas.cx * W - 30, POS.horas.yTop * H, { width: 60, align: 'center', lineBreak: false });

      // Fecha de aprobación (debajo del quote, sobre las firmas)
      const fBoxW = POS.fecha.boxW * W;
      doc.font('Helvetica').fontSize(POS.fecha.size).fillColor(POS.fecha.color)
        .text(`Fecha de aprobación: ${fmtFecha(data.fecha)}`, POS.fecha.cx * W - fBoxW / 2, POS.fecha.yTop * H, { width: fBoxW, align: 'center', lineBreak: false });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
