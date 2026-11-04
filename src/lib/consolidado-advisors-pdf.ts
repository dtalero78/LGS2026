import 'server-only';
import PDFDocument from 'pdfkit';

/**
 * PDF del Consolidado de Gestión Advisors (Administración). Solo se genera cuando todos
 * los cortes del mes están VERIFICADOS o PAGADOS; usa los valores CONGELADOS al verificar.
 * Paleta corporativa LGS (azules del logo).
 */

export interface FilaPdf {
  programa: string; pais: string; nombre: string; tipo: string; corte: string;
  horas: number; valor: number; moneda: string; usd: number | null; estado: string; verificadoPor: string | null;
}
export interface ConsolidadoPdfData {
  periodoEtiqueta: string; generadoPor: string; generadoEn: string; logoPath: string | null;
  tipoCambio: { COP: number | null; CLP: number | null; fecha: string | null };
  porPais: { pais: string; horas: number; usd: number }[];
  filas: FilaPdf[];
}

const C = { brand: '#1c6fe0', dark: '#123f7d', ink: '#111827', sub: '#6b7280', line: '#e5e7eb', soft: '#e9f2fd' };
const M = 36;
const fmt = (v: number | null, mon: string) => v === null ? '—'
  : `${mon === 'USD' ? 'U$' : '$'}${v.toLocaleString('es-CO', { minimumFractionDigits: mon === 'USD' ? 2 : 0, maximumFractionDigits: mon === 'USD' ? 2 : 0 })}`;

export async function buildConsolidadoPdf(d: ConsolidadoPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: M, bufferPages: true, info: { Title: `Consolidado advisors ${d.periodoEtiqueta}`, Author: "Let's Go Speak" } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const W = doc.page.width - 2 * M;

      // Encabezado
      doc.rect(0, 0, doc.page.width, 70).fill(C.brand);
      if (d.logoPath) { try { doc.image(d.logoPath, M, 16, { fit: [110, 38] }); } catch { /* opcional */ } }
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(`Consolidado de horas advisors · ${d.periodoEtiqueta}`, M + 130, 22, { width: W - 130 });
      doc.font('Helvetica').fontSize(9).text(
        `Tipo de cambio (1 USD): COP ${d.tipoCambio.COP?.toLocaleString('es-CO') ?? '—'} · CLP ${d.tipoCambio.CLP?.toLocaleString('es-CO') ?? '—'}${d.tipoCambio.fecha ? ` al ${d.tipoCambio.fecha}` : ''}`,
        M + 130, 46, { width: W - 130 });

      // Tarjetas por país
      let y = 86;
      const total = d.porPais.reduce((s, p) => s + p.usd, 0);
      const cards = [...d.porPais.map((p) => ({ t: p.pais, h: p.horas, usd: p.usd })), { t: 'TOTAL', h: d.porPais.reduce((s, p) => s + p.horas, 0), usd: total }];
      const cw = (W - (cards.length - 1) * 8) / cards.length;
      cards.forEach((c, i) => {
        const x = M + i * (cw + 8);
        const last = i === cards.length - 1;
        doc.roundedRect(x, y, cw, 58, 6).fill(last ? C.dark : C.soft);
        doc.fillColor(last ? '#ffffff' : C.dark).font('Helvetica-Bold').fontSize(9).text(c.t.toUpperCase(), x + 10, y + 8);
        doc.fontSize(15).text(fmt(c.usd, 'USD'), x + 10, y + 21);
        doc.font('Helvetica').fontSize(8).fillColor(last ? '#ffffff' : C.sub)
          .text(`${c.h.toLocaleString('es-CO', { maximumFractionDigits: 2 })} h · ${d.tipoCambio.CLP ? fmt(c.usd * d.tipoCambio.CLP, 'CLP') + ' CLP' : ''} · ${d.tipoCambio.COP ? fmt(c.usd * d.tipoCambio.COP, 'COP') + ' COP' : ''}`, x + 10, y + 41, { width: cw - 20 });
      });
      y += 74;

      // Tabla de advisors
      const cols = [
        { h: 'Prog.', w: 38 }, { h: 'País', w: 58 }, { h: 'Advisor', w: 190 }, { h: 'Tipo', w: 64 }, { h: 'Corte', w: 38 },
        { h: 'Horas', w: 48, r: true }, { h: 'Valor', w: 92, r: true }, { h: 'USD', w: 70, r: true }, { h: 'Estado', w: 64 }, { h: 'Verificó', w: W - 662 },
      ];
      const encabezado = () => {
        doc.rect(M, y, W, 18).fill(C.dark);
        let x = M + 4;
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
        for (const c of cols) { doc.text(c.h, x, y + 5, { width: c.w - 6, align: (c as any).r ? 'right' : 'left' }); x += c.w; }
        y += 18;
      };
      encabezado();
      doc.font('Helvetica').fontSize(8);
      d.filas.forEach((f, i) => {
        if (y > doc.page.height - M - 30) { doc.addPage(); y = M; encabezado(); doc.font('Helvetica').fontSize(8); }
        if (i % 2) doc.rect(M, y, W, 15).fill('#f8fafc');
        const vals = [f.programa, f.pais, f.nombre, f.tipo, f.corte, f.horas.toLocaleString('es-CO', { maximumFractionDigits: 2 }),
          `${fmt(f.valor, f.moneda)} ${f.moneda}`, fmt(f.usd, 'USD'), f.estado, f.verificadoPor || ''];
        let x = M + 4;
        doc.fillColor(C.ink);
        cols.forEach((c, j) => { doc.text(vals[j], x, y + 4, { width: c.w - 6, align: (c as any).r ? 'right' : 'left', lineBreak: false, ellipsis: true }); x += c.w; });
        y += 15;
      });

      // Pie en todas las páginas
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor(C.sub).font('Helvetica').fontSize(7).text(
          `Generado por ${d.generadoPor} el ${d.generadoEn} · Valores congelados al verificar cada corte · Página ${i + 1} de ${range.count}`,
          M, doc.page.height - M + 6, { width: W, align: 'center', lineBreak: false });
      }
      doc.end();
    } catch (e) { reject(e); }
  });
}
