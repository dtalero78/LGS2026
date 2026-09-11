import 'server-only';
import fs from 'fs';
import path from 'path';
import type { AcademicSnapshot } from '@/services/proteccion-historial.service';

/**
 * infoacademic-pdf-html.ts — HTML del informe académico para archivar como
 * documento (Histórico Académico). Contiene lo que muestra InfoAcademic User:
 * encabezado + 5 KPIs + tabla de agendamientos. Se renderiza a PDF con API2PDF
 * (Chrome headless), igual que los contratos.
 */

let logoDataUri: string | null | undefined;
function getLogo(): string | null {
  if (logoDataUri !== undefined) return logoDataUri;
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'));
    logoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch { logoDataUri = null; }
  return logoDataUri;
}

const esc = (s: any) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const siNo = (v: boolean | null | undefined, yesColor = '#047857') =>
  v === true ? `<span style="color:${yesColor};font-weight:600">Sí</span>`
  : v === false ? `<span style="color:#b91c1c">No</span>`
  : '<span style="color:#9aa3af">—</span>';

export function buildInfoAcademicPdfHtml(snap: AcademicSnapshot, opts: { generadoPor?: string } = {}): string {
  const logo = getLogo();
  const { student, kpis, bookings } = snap;
  const hoy = new Date().toLocaleString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const kpiCards = [
    { l: 'Total agendamientos', v: kpis.total, c: '#111' },
    { l: 'Asistidas', v: kpis.asistidas, c: '#047857' },
    { l: 'No asistidas', v: kpis.noAsistidas, c: '#b91c1c' },
    { l: 'Canceladas', v: kpis.canceladas, c: '#b45309' },
    { l: 'Jumps aprobados', v: kpis.jumpsAprobados, c: '#6d28d9' },
  ].map(k => `
    <div class="kpi">
      <div class="kl">${esc(k.l)}</div>
      <div class="kv" style="color:${k.c}">${k.v}</div>
    </div>`).join('');

  const rows = bookings.length
    ? bookings.map(b => `
      <tr>
        <td>${esc(fmtFecha(b.fecha))}</td>
        <td>${esc(b.tipo || '—')}</td>
        <td>${esc(b.advisor || '—')}</td>
        <td>${esc(b.nivel || '—')}</td>
        <td>${esc(b.step || '—')}</td>
        <td class="c">${siNo(b.asistio)}</td>
        <td class="c">${siNo(b.participo)}</td>
        <td class="c">${siNo(b.cancelo, '#b45309')}</td>
        <td class="c">${b.noAprobo === true ? '<span style="color:#b91c1c;font-weight:600">Sí</span>' : '<span style="color:#9aa3af">—</span>'}</td>
      </tr>`).join('')
    : `<tr><td colspan="9" style="text-align:center;color:#9aa3af;padding:16px">Sin agendamientos registrados</td></tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Histórico Académico ${esc(student.contrato || '')}</title>
  <style>
    @page { margin: 14mm 12mm 14mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:9.5pt; color:#1a1a1a; margin:0; }
    .header { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #2563eb; padding-bottom:10px; margin-bottom:14px; }
    .header .logo { height:40px; }
    .header .t { text-align:right; }
    .header .t .h1 { font-size:14pt; font-weight:700; }
    .header .t .sub { font-size:8.5pt; color:#555; margin-top:2px; }
    .meta { background:#f5f7fa; border:1px solid #e5e9f0; border-radius:8px; padding:10px 14px; font-size:9pt; color:#333; margin-bottom:14px; line-height:1.6; }
    .meta b { color:#111; }
    .kpis { display:flex; gap:8px; margin-bottom:16px; }
    .kpi { flex:1; border:1px solid #e5e9f0; border-radius:8px; padding:9px 10px; text-align:left; }
    .kpi .kl { font-size:7pt; letter-spacing:.06em; text-transform:uppercase; color:#8a93a3; font-weight:700; }
    .kpi .kv { font-size:18pt; font-weight:700; margin-top:3px; }
    h2 { font-size:10.5pt; margin:0 0 8px; color:#111; }
    table { width:100%; border-collapse:collapse; font-size:8.5pt; }
    thead th { text-align:left; font-size:7pt; letter-spacing:.05em; text-transform:uppercase; color:#8a93a3; font-weight:700; border-bottom:1.5px solid #d5dae2; padding:6px 5px; }
    tbody td { padding:5px 5px; border-bottom:1px solid #eef1f5; }
    tbody tr:nth-child(even) { background:#fafbfc; }
    td.c { text-align:center; }
    .footer { margin-top:16px; padding-top:8px; border-top:1px solid #ddd; font-size:7.5pt; color:#8a93a3; text-align:center; }
    @media print { thead { display:table-header-group; } tr { break-inside:avoid; } }
  </style>
</head>
<body>
  <div class="header">
    ${logo ? `<img class="logo" src="${logo}" alt="LGS">` : '<div></div>'}
    <div class="t">
      <div class="h1">Histórico Académico</div>
      <div class="sub">Generado: ${esc(hoy)}${opts.generadoPor ? ` · Por: ${esc(opts.generadoPor)}` : ''}</div>
    </div>
  </div>

  <div class="meta">
    <b>${esc(student.nombre)}</b> &nbsp;·&nbsp; ID: ${esc(student.numeroId)} &nbsp;·&nbsp;
    Nivel: ${esc(student.nivel || '—')} ${esc(student.step || '')} &nbsp;·&nbsp;
    Plataforma: ${esc(student.plataforma || '—')} &nbsp;·&nbsp;
    Contrato: <b>${esc(student.contrato || '—')}</b>
  </div>

  <div class="kpis">${kpiCards}</div>

  <h2>Detalle de agendamientos <span style="font-weight:400;color:#8a93a3;font-size:8.5pt">· ${bookings.length} registro(s)</span></h2>
  <table>
    <thead>
      <tr>
        <th>Fecha</th><th>Tipo</th><th>Advisor</th><th>Nivel</th><th>Step</th>
        <th style="text-align:center">Asistió</th><th style="text-align:center">Participó</th>
        <th style="text-align:center">Canceló</th><th style="text-align:center">No aprobó</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">Let's Go Speak · Histórico académico archivado al re-matricular · Contrato ${esc(student.contrato || '')}</div>
</body>
</html>`;
}
