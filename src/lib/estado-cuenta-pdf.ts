import 'server-only';
import PDFDocument from 'pdfkit';

/**
 * Generador del "Estado de Cuenta" del titular en PDF (protegido con contraseña).
 *
 * El PDF sale CIFRADO: `userPassword` = número de documento del titular, de modo
 * que sólo quien conozca el documento puede abrirlo. La maquetación es propia de
 * PDFKit (no HTML) para no depender de un servicio externo ni de binarios del
 * sistema (qpdf) — pdfkit trae el cifrado nativo y es JS puro.
 *
 * Lo consume `GET /api/postgres/pagos-titulares/estado-cuenta`.
 */

export interface EstadoCuentaMov {
  n: string;                 // 'CI' (inscripción) o '1','2',… (cuota)
  concepto: string;
  vence: string | null;      // ISO
  pago: string | null;       // ISO (fecha en que pagó) o null
  valor: number;
  canal: string;
  estado: 'Pagado' | 'En mora' | 'Por vencer' | 'Pendiente';
}

export interface EstadoCuentaData {
  modo: 'mes' | 'total';
  mesLabel: string;
  empresa: { razon: string; nit: string };
  logoPath: string | null;
  contrato: string;
  corte: string;             // ISO (hoy)
  diaPago: number | null;
  plan: { nombre: string; cuotas: number; valorCuota: number; valorTotal: number; inscripcion: number };
  titular: { nombre: string; documento: string; cel: string; email: string };
  estudiantes: { nombre: string; documento: string; cel: string; programa: string }[];
  cartera: { nombre: string; cargo: string; email: string };
  resumen: { pagado: number; mora: number; porVencer: number; saldo: number; avancePct: number };
  movimientos: EstadoCuentaMov[];
  proximoPago: EstadoCuentaMov | null;
  ultimoPago: EstadoCuentaMov | null;
  password: string;          // documento del titular
}

// Paleta (alineada con los morados del panel)
const C = {
  brand: '#6d28d9',
  brandDark: '#4c1d95',
  ink: '#111827',
  sub: '#6b7280',
  line: '#e5e7eb',
  soft: '#f5f3ff',
  green: '#047857',
  greenBg: '#ecfdf5',
  red: '#b91c1c',
  redBg: '#fef2f2',
  amber: '#b45309',
  amberBg: '#fffbeb',
  gray: '#4b5563',
  grayBg: '#f3f4f6',
};

const money = (n: number) =>
  '$ ' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
};

const ESTADO_STYLE: Record<string, { fg: string; bg: string }> = {
  Pagado:      { fg: C.green, bg: C.greenBg },
  'En mora':   { fg: C.red,   bg: C.redBg },
  'Por vencer':{ fg: C.amber, bg: C.amberBg },
  Pendiente:   { fg: C.gray,  bg: C.grayBg },
};

const MARGIN = 40;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Columnas de la tabla de movimientos (suman CONTENT_W = 515.28)
const COLS = [
  { key: 'n',        label: '#',        w: 30,  align: 'center' as const },
  { key: 'concepto', label: 'Concepto', w: 150, align: 'left'   as const },
  { key: 'vence',    label: 'Vence',    w: 62,  align: 'center' as const },
  { key: 'pago',     label: 'Pago',     w: 62,  align: 'center' as const },
  { key: 'valor',    label: 'Valor',    w: 80,  align: 'right'  as const },
  { key: 'canal',    label: 'Canal',    w: 75,  align: 'left'   as const },
  { key: 'estado',   label: 'Estado',   w: 56.28, align: 'center' as const },
];

export async function buildEstadoCuentaPdf(data: EstadoCuentaData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: MARGIN,
        bufferPages: true,           // requerido para el pie de página en todas las páginas
        pdfVersion: '1.7',           // AES-128
        userPassword: data.password || undefined,
        ownerPassword: `LGS-${data.contrato}-${Date.now()}`,
        permissions: { printing: 'highResolution', copying: false, modifying: false },
        info: {
          Title: `Estado de Cuenta ${data.contrato}`,
          Author: data.empresa.razon,
          Subject: `Estado de cuenta — ${data.titular.nombre}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      renderHeader(doc, data);
      renderInfoBlocks(doc, data);
      renderResumen(doc, data);
      if (data.modo === 'mes') renderProximoUltimo(doc, data);
      renderMovimientos(doc, data);
      renderFirma(doc, data);
      renderFooters(doc, data);

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ─── Header (banda morada + logo + título) ─────────────────────────────────
function renderHeader(doc: any, data: EstadoCuentaData) {
  const H = 96;
  doc.rect(0, 0, PAGE_W, H).fill(C.brand);
  // Logo (fondo blanco redondeado a la izquierda)
  if (data.logoPath) {
    try {
      doc.roundedRect(MARGIN, 24, 132, 48, 6).fill('#ffffff');
      doc.image(data.logoPath, MARGIN + 8, 30, { fit: [116, 36], align: 'center', valign: 'center' });
    } catch { /* logo opcional */ }
  }
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
    .text('ESTADO DE CUENTA', MARGIN, 28, { width: CONTENT_W, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#ede9fe')
    .text(
      `${data.empresa.razon}${data.empresa.nit ? '  ·  NIT ' + data.empresa.nit : ''}`,
      MARGIN, 54, { width: CONTENT_W, align: 'right' },
    );
  doc.fontSize(9).fillColor('#ffffff')
    .text(
      `Contrato ${data.contrato}   ·   Corte ${fmtDate(data.corte)}   ·   ${data.modo === 'mes' ? data.mesLabel : 'Consolidado total'}`,
      MARGIN, 70, { width: CONTENT_W, align: 'right' },
    );
  doc.y = H + 16;
  doc.fillColor(C.ink);
}

// ─── Bloques Titular / Estudiantes / Plan ──────────────────────────────────
function renderInfoBlocks(doc: any, data: EstadoCuentaData) {
  const top = doc.y;
  const colW = (CONTENT_W - 16) / 2;

  // Titular (izq)
  doc.roundedRect(MARGIN, top, colW, 78, 6).fill(C.soft);
  doc.fillColor(C.brandDark).font('Helvetica-Bold').fontSize(9).text('TITULAR', MARGIN + 12, top + 10);
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(11).text(data.titular.nombre || '—', MARGIN + 12, top + 24, { width: colW - 24 });
  doc.font('Helvetica').fontSize(8.5).fillColor(C.sub)
    .text(`Documento: ${data.titular.documento || '—'}`, MARGIN + 12, top + 42, { width: colW - 24 })
    .text(`Cel: ${data.titular.cel || '—'}`, MARGIN + 12, top + 54, { width: colW - 24 })
    .text(`Email: ${data.titular.email || '—'}`, MARGIN + 12, top + 66, { width: colW - 24 });

  // Plan (der)
  const rx = MARGIN + colW + 16;
  doc.roundedRect(rx, top, colW, 78, 6).fill(C.grayBg);
  doc.fillColor(C.brandDark).font('Helvetica-Bold').fontSize(9).text('PLAN', rx + 12, top + 10);
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(11).text(data.plan.nombre || 'Plan', rx + 12, top + 24, { width: colW - 24 });
  doc.font('Helvetica').fontSize(8.5).fillColor(C.sub)
    .text(`Valor total: ${money(data.plan.valorTotal)}   ·   Inscripción: ${money(data.plan.inscripcion)}`, rx + 12, top + 42, { width: colW - 24 })
    .text(`Cuotas: ${data.plan.cuotas}  x  ${money(data.plan.valorCuota)}`, rx + 12, top + 54, { width: colW - 24 })
    .text(`Corte de pago: ${data.diaPago ? 'día ' + data.diaPago + ' de cada mes' : '—'}`, rx + 12, top + 66, { width: colW - 24 });

  doc.y = top + 78 + 12;

  // Estudiantes (lista compacta)
  if (data.estudiantes.length) {
    doc.fillColor(C.brandDark).font('Helvetica-Bold').fontSize(9).text('ESTUDIANTES', MARGIN, doc.y);
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(8.5).fillColor(C.gray);
    for (const e of data.estudiantes) {
      const linea = `•  ${e.nombre}${e.documento ? ' · ' + e.documento : ''}${e.programa ? ' · ' + e.programa : ''}`;
      doc.text(linea, MARGIN + 4, doc.y, { width: CONTENT_W - 4 });
    }
    doc.moveDown(0.6);
  }
  doc.fillColor(C.ink);
}

// ─── Tarjetas de resumen ───────────────────────────────────────────────────
function renderResumen(doc: any, data: EstadoCuentaData) {
  const cards = [
    { label: 'Pagado',     val: money(data.resumen.pagado),    fg: C.green, bg: C.greenBg },
    { label: 'En mora',    val: money(data.resumen.mora),      fg: C.red,   bg: C.redBg },
    { label: 'Por vencer', val: money(data.resumen.porVencer), fg: C.amber, bg: C.amberBg },
    { label: 'Saldo',      val: money(data.resumen.saldo),     fg: C.brandDark, bg: C.soft },
    { label: 'Avance',     val: `${Math.round(data.resumen.avancePct)}%`, fg: C.brand, bg: C.grayBg },
  ];
  const gap = 8;
  const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const top = doc.y;
  cards.forEach((c, i) => {
    const x = MARGIN + i * (w + gap);
    doc.roundedRect(x, top, w, 46, 5).fill(c.bg);
    doc.fillColor(c.fg).font('Helvetica').fontSize(7.5).text(c.label.toUpperCase(), x + 8, top + 8, { width: w - 16 });
    doc.fillColor(c.fg).font('Helvetica-Bold').fontSize(12).text(c.val, x + 8, top + 22, { width: w - 16 });
  });
  doc.y = top + 46 + 16;
  doc.fillColor(C.ink);
}

// ─── Próximo / Último pago (solo modo mes) ─────────────────────────────────
function renderProximoUltimo(doc: any, data: EstadoCuentaData) {
  const colW = (CONTENT_W - 16) / 2;
  const top = doc.y;
  const box = (x: number, titulo: string, mov: EstadoCuentaMov | null, tint: string) => {
    doc.roundedRect(x, top, colW, 52, 6).fill(tint);
    doc.fillColor(C.brandDark).font('Helvetica-Bold').fontSize(8.5).text(titulo, x + 12, top + 9);
    if (mov) {
      doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10).text(`${mov.concepto} · ${money(mov.valor)}`, x + 12, top + 22, { width: colW - 24 });
      doc.font('Helvetica').fontSize(8.5).fillColor(C.sub)
        .text(mov.pago ? `Pagado el ${fmtDate(mov.pago)}` : `Vence el ${fmtDate(mov.vence)} · ${mov.estado}`, x + 12, top + 36, { width: colW - 24 });
    } else {
      doc.fillColor(C.sub).font('Helvetica').fontSize(9).text('—', x + 12, top + 24);
    }
  };
  box(MARGIN, 'PRÓXIMO PAGO', data.proximoPago, C.amberBg);
  box(MARGIN + colW + 16, 'ÚLTIMO PAGO', data.ultimoPago, C.greenBg);
  doc.y = top + 52 + 16;
  doc.fillColor(C.ink);
}

// ─── Tabla de movimientos (con paginación) ─────────────────────────────────
function tableHeader(doc: any): number {
  const top = doc.y;
  doc.rect(MARGIN, top, CONTENT_W, 20).fill(C.brandDark);
  let x = MARGIN;
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
  for (const c of COLS) {
    doc.text(c.label, x + 5, top + 6, { width: c.w - 10, align: c.align });
    x += c.w;
  }
  doc.fillColor(C.ink);
  return top + 20;
}

function renderMovimientos(doc: any, data: EstadoCuentaData) {
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.brandDark)
    .text(data.modo === 'mes' ? `Movimientos · ${data.mesLabel}` : 'Historial de movimientos', MARGIN, doc.y);
  doc.moveDown(0.4);
  doc.fillColor(C.ink);

  let y = tableHeader(doc);
  const bottomLimit = 780;
  const rowH = 18;

  if (!data.movimientos.length) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(C.sub)
      .text('No hay movimientos para el período seleccionado.', MARGIN + 6, y + 6);
    doc.y = y + 26;
    doc.fillColor(C.ink);
    return;
  }

  data.movimientos.forEach((m, idx) => {
    if (y + rowH > bottomLimit) {
      doc.addPage();
      doc.y = MARGIN;
      y = tableHeader(doc);
    }
    if (idx % 2 === 1) doc.rect(MARGIN, y, CONTENT_W, rowH).fill('#fafafa');

    let x = MARGIN;
    const cell = (txt: string, w: number, align: 'left' | 'center' | 'right', bold = false, color = C.ink) => {
      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
        .text(txt, x + 5, y + 5, { width: w - 10, align, lineBreak: false, ellipsis: true });
      x += w;
    };
    cell(m.n, COLS[0].w, 'center');
    cell(m.concepto, COLS[1].w, 'left');
    cell(fmtDate(m.vence), COLS[2].w, 'center');
    cell(fmtDate(m.pago), COLS[3].w, 'center');
    cell(money(m.valor), COLS[4].w, 'right', true);
    cell(m.canal || '—', COLS[5].w, 'left', false, C.sub);
    // Estado como chip
    const st = ESTADO_STYLE[m.estado] || ESTADO_STYLE.Pendiente;
    const chipW = COLS[6].w - 10;
    doc.roundedRect(x + 5, y + 3.5, chipW, 12, 3).fill(st.bg);
    doc.fillColor(st.fg).font('Helvetica-Bold').fontSize(6.5)
      .text(m.estado.toUpperCase(), x + 5, y + 6, { width: chipW, align: 'center', lineBreak: false });
    doc.fillColor(C.ink);

    y += rowH;
    doc.strokeColor(C.line).lineWidth(0.5).moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).stroke();
  });
  doc.y = y + 14;
  doc.fillColor(C.ink);
}

// ─── Firma (jefe de recaudos según país) + nota de contraseña ──────────────
function renderFirma(doc: any, data: EstadoCuentaData) {
  if (doc.y + 120 > 800) { doc.addPage(); doc.y = MARGIN; }
  const top = doc.y + 6;
  doc.strokeColor(C.line).lineWidth(1).moveTo(MARGIN, top).lineTo(MARGIN + CONTENT_W, top).stroke();

  const y = top + 24;
  // Firma
  doc.strokeColor(C.ink).lineWidth(0.8).moveTo(MARGIN, y + 24).lineTo(MARGIN + 200, y + 24).stroke();
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10).text(data.cartera.nombre || '—', MARGIN, y + 28);
  doc.font('Helvetica').fontSize(8.5).fillColor(C.sub)
    .text(data.cartera.cargo || 'Recaudos', MARGIN, y + 42)
    .text(data.cartera.email || '', MARGIN, y + 54);

  // Nota contraseña (der)
  const rx = MARGIN + CONTENT_W - 230;
  doc.roundedRect(rx, y - 4, 230, 62, 6).fill(C.soft);
  doc.fillColor(C.brandDark).font('Helvetica-Bold').fontSize(8.5).text('DOCUMENTO PROTEGIDO', rx + 12, y + 6, { width: 206 });
  doc.font('Helvetica').fontSize(8).fillColor(C.gray)
    .text('Este PDF está cifrado. La contraseña para abrirlo es el número de documento del titular.', rx + 12, y + 20, { width: 206 });
  doc.y = y + 70;
  doc.fillColor(C.ink);
}

// ─── Pie de página en todas las páginas ────────────────────────────────────
function renderFooters(doc: any, data: EstadoCuentaData) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // El pie va en y=818, por DEBAJO del margen inferior (alto − 40 = 801.89).
    // PDFKit, al escribir texto más allá de `maxY`, "continúa" en una página
    // nueva → generaba páginas en blanco. Anular el margen inferior de la página
    // (maxY = alto) evita esa continuación. `lineBreak:false` como defensa extra.
    doc.page.margins.bottom = 0;
    doc.strokeColor(C.line).lineWidth(0.5).moveTo(MARGIN, 812).lineTo(MARGIN + CONTENT_W, 812).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.sub)
      .text(
        `${data.empresa.razon} · Estado de cuenta generado el ${fmtDate(data.corte)}`,
        MARGIN, 818, { width: CONTENT_W - 60, align: 'left', lineBreak: false },
      );
    doc.text(`Página ${i - range.start + 1} de ${range.count}`, MARGIN + CONTENT_W - 60, 818, { width: 60, align: 'right', lineBreak: false });
  }
}
