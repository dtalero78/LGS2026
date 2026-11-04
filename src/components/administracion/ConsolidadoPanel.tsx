'use client'

/**
 * Gestión Advisors › Consolidado: lo que trae hoy la hoja CONSOLIDACION, en vivo.
 *  - Valores a pagar cargados a cada país (Chile · Colombia · Ecuador, Perú dentro de
 *    Ecuador) según la plataforma de los alumnos, por tipo de advisor.
 *  - Lo que paga cada grupo (Chile mensual · Colombia por quincena · Ecuador mensual).
 *  - Todo en USD, CLP y COP con el tipo de cambio del mes (editable con TARIFAS).
 * Mes en curso = parcial al momento de la consulta. PDF: Fase 4 (solo con todos
 * verificados). CSV con CONSOLIDADO_EXPORTAR.
 */

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowDownTrayIcon, PrinterIcon, PencilSquareIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { exportToExcel } from '@/lib/export-excel'
import {
  type AdvisorLiq, type Liquidacion, type Pais, PAISES, MONEDA, TIPO_LABEL,
  fmtH, fmtMoneda, enTresMonedas, etiquetaPeriodo,
} from './liquidacion-tipos'

type Filtro = 'Todos' | Pais
const FILAS = [
  { k: 'POR_HORAS', l: 'LGS · Advisors por horas' },
  { k: 'SEMIPLANTA', l: 'LGS · Semiplanta (coordinadores)' },
  { k: 'PLANTA', l: 'LGS · Planta' },
]

function Celda({ horas, usd, clp, cop, verValores, fuerte }: { horas: number; usd: number | null; clp: number | null; cop: number | null; verValores: boolean; fuerte?: boolean }) {
  return (
    <td className={`px-3 py-2 text-right align-top ${fuerte ? 'bg-sky-50' : ''}`}>
      <div className={`tabular-nums ${fuerte ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{fmtH(horas)} h</div>
      {verValores && (
        <div className="mt-0.5 space-y-0.5 text-[11px] tabular-nums leading-tight">
          <div className="text-sky-900 font-semibold">{fmtMoneda(usd, 'USD')}</div>
          <div className="text-gray-500">{fmtMoneda(clp, 'CLP')} CLP</div>
          <div className="text-gray-500">{fmtMoneda(cop, 'COP')} COP</div>
        </div>
      )}
    </td>
  )
}

export default function ConsolidadoPanel({ liq, loading, puedeExportar, puedeImprimir, puedeTipoCambio, onTipoCambio }: {
  liq: Liquidacion | null; loading: boolean; puedeExportar: boolean; puedeImprimir: boolean; puedeTipoCambio: boolean; onTipoCambio: () => void
}) {
  const [filtro, setFiltro] = useState<Filtro>('Todos')
  const [editTc, setEditTc] = useState(false)
  const [tc, setTc] = useState({ fecha: '', COP: '', CLP: '' })
  const [guardando, setGuardando] = useState(false)

  const verValores = !!liq?.verValores
  const cols: Pais[] = filtro === 'Todos' ? PAISES : [filtro]

  // Matriz: tipo de advisor × país al que se carga. Valores en USD (moneda común) y horas.
  const matriz = useMemo(() => {
    const m: Record<string, Record<Pais, { horas: number; usd: number; sinTc: boolean }>> = {}
    for (const f of FILAS) m[f.k] = { Chile: { horas: 0, usd: 0, sinTc: false }, Colombia: { horas: 0, usd: 0, sinTc: false }, Ecuador: { horas: 0, usd: 0, sinTc: false } }
    if (!liq) return m
    for (const a of liq.advisors) {
      const fila = m[a.tipoContratacion] || m.POR_HORAS
      for (const p of PAISES) {
        fila[p].horas += a.reparto[p]
        if (a.valor) {
          const usd = enTresMonedas(a.valor.reparto[p], a.valor.moneda, liq.tipoCambio).USD
          if (usd === null) fila[p].sinTc = fila[p].sinTc || a.valor.reparto[p] > 0
          else fila[p].usd += usd
        }
      }
    }
    return m
  }, [liq])

  const usdA = (usd: number) => ({
    usd, clp: liq?.tipoCambio.CLP ? usd * liq.tipoCambio.CLP : null, cop: liq?.tipoCambio.COP ? usd * liq.tipoCambio.COP : null,
  })

  // Lo que paga cada grupo (en su moneda) — Colombia separado por quincena.
  const grupos = useMemo(() => {
    if (!liq) return []
    const out: { k: string; pais: Pais; etiqueta: string; advisors: AdvisorLiq[]; horas: number; local: number }[] = []
    for (const p of PAISES) {
      const lista = liq.advisors.filter(a => a.pais === p)
      if (p === 'Colombia') {
        const tot = (q: 'q1' | 'q2') => lista.reduce((s, a) => s + (a.valor && a.total > 0 ? a.valor.total * (a.quincenas[q] / a.total) : 0), 0)
        out.push({ k: 'CO1', pais: p, etiqueta: 'Colombia · 1ra quincena (paga el 20)', advisors: lista, horas: lista.reduce((s, a) => s + a.quincenas.q1, 0), local: tot('q1') })
        out.push({ k: 'CO2', pais: p, etiqueta: 'Colombia · 2da quincena (paga el 5)', advisors: lista, horas: lista.reduce((s, a) => s + a.quincenas.q2, 0), local: tot('q2') })
      } else {
        out.push({ k: p, pais: p, etiqueta: `${p} · mensual (paga el 5)`, advisors: lista, horas: lista.reduce((s, a) => s + a.total, 0), local: lista.reduce((s, a) => s + (a.valor?.total || 0), 0) })
      }
    }
    return out.filter(g => filtro === 'Todos' || g.pais === filtro)
  }, [liq, filtro])

  const totalCol = (p: Pais) => FILAS.reduce((s, f) => ({ horas: s.horas + matriz[f.k][p].horas, usd: s.usd + matriz[f.k][p].usd }), { horas: 0, usd: 0 })
  const totalGeneral = cols.reduce((s, p) => { const t = totalCol(p); return { horas: s.horas + t.horas, usd: s.usd + t.usd } }, { horas: 0, usd: 0 })
  const faltaTc = verValores && liq && (!liq.tipoCambio.COP || !liq.tipoCambio.CLP)
  const faltanTarifas = liq?.advisors.filter(a => a.valor?.faltanTarifas.length) || []
  const sinFijo = liq?.advisors.filter(a => a.tipoContratacion !== 'POR_HORAS' && a.valor && !a.valor.fijo) || []

  const guardarTc = async () => {
    setGuardando(true)
    try {
      const res = await fetch('/api/postgres/administracion/tipo-cambio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: tc.fecha, COP: tc.COP ? Number(tc.COP) : undefined, CLP: tc.CLP ? Number(tc.CLP) : undefined }),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      toast.success('Tipo de cambio guardado'); setEditTc(false); onTipoCambio()
    } catch (e: any) { toast.error(e?.message || 'No se pudo guardar') } finally { setGuardando(false) }
  }

  const exportar = () => {
    if (!liq) return
    const filas = [
      ...FILAS.flatMap(f => cols.map(p => ({ seccion: 'Valores a pagar por país', concepto: f.l, pais: p, horas: matriz[f.k][p].horas, usd: matriz[f.k][p].usd }))),
      ...grupos.map(g => ({ seccion: 'Pago por grupo', concepto: g.etiqueta, pais: g.pais, horas: g.horas, usd: enTresMonedas(g.local, MONEDA[g.pais], liq.tipoCambio).USD ?? 0 })),
    ]
    exportToExcel(filas, [
      { header: 'Sección', accessor: r => r.seccion },
      { header: 'Concepto', accessor: r => r.concepto },
      { header: 'País', accessor: r => r.pais },
      { header: 'Horas', accessor: r => Math.round(r.horas * 100) / 100 },
      ...(verValores ? [
        { header: 'USD', accessor: (r: any) => Math.round(r.usd * 100) / 100 },
        { header: 'CLP', accessor: (r: any) => (liq.tipoCambio.CLP ? Math.round(r.usd * liq.tipoCambio.CLP) : '') },
        { header: 'COP', accessor: (r: any) => (liq.tipoCambio.COP ? Math.round(r.usd * liq.tipoCambio.COP) : '') },
      ] : []),
    ], `consolidado-advisors-${liq.periodo}`)
  }

  if (loading && !liq) return <p className="p-10 text-center text-sm text-gray-400 italic">Calculando consolidado…</p>
  if (!liq) return null

  return (
    <div className="space-y-5">
      {/* Filtro de plataforma + acciones */}
      <div className="flex flex-wrap items-center gap-2">
        {(['Todos', ...PAISES] as Filtro[]).map(f => (
          <button key={f} type="button" onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border ${filtro === f ? 'bg-sky-700 border-sky-700 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {f}
          </button>
        ))}
        {liq.parcial && <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">Mes en curso · parcial al {new Date().toLocaleDateString('es-CO')}</span>}
        <div className="ml-auto flex gap-2">
          {puedeExportar && (
            <button type="button" onClick={exportar} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-white border border-sky-300 rounded-md hover:bg-sky-50">
              <ArrowDownTrayIcon className="h-4 w-4" /> CSV
            </button>
          )}
          {puedeImprimir && (
            <button type="button" disabled title="Se habilita cuando todos los advisors del mes estén VERIFICADOS (flujo de verificación, Fase 4)"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-sky-700 rounded-md opacity-40 cursor-not-allowed">
              <PrinterIcon className="h-4 w-4" /> Imprimir PDF
            </button>
          )}
        </div>
      </div>

      {/* KPIs + tipo de cambio */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-sky-800 to-sky-600 p-4 text-white shadow-sm">
          <div className="text-xs uppercase tracking-wide opacity-80">Total a pagar · {etiquetaPeriodo(liq.periodo)}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{verValores ? fmtMoneda(totalGeneral.usd, 'USD') : `${fmtH(totalGeneral.horas)} h`}</div>
          {verValores && <div className="mt-1 text-[11px] opacity-90 tabular-nums">{fmtMoneda(usdA(totalGeneral.usd).clp, 'CLP')} CLP · {fmtMoneda(usdA(totalGeneral.usd).cop, 'COP')} COP</div>}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Horas liquidables</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{fmtH(totalGeneral.horas)}</div>
          <div className="text-[11px] text-gray-500">{liq.advisors.filter(a => filtro === 'Todos' || a.pais === filtro).length} advisors con actividad</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Sin asistentes</div>
          <div className="mt-1 text-2xl font-bold text-orange-600 tabular-nums">{liq.advisors.reduce((s, a) => s + a.sinAsistentes, 0)}</div>
          <div className="text-[11px] text-gray-500">eventos (½ h para por horas)</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-gray-500">Tipo de cambio (1 USD)</div>
            {puedeTipoCambio && (
              <button type="button" onClick={() => { setTc({ fecha: new Date().toISOString().slice(0, 10), COP: String(liq.tipoCambio.COP || ''), CLP: String(liq.tipoCambio.CLP || '') }); setEditTc(v => !v) }}
                className="p-1 text-gray-400 hover:text-sky-700" title="Registrar tipo de cambio"><PencilSquareIcon className="h-4 w-4" /></button>
            )}
          </div>
          <div className="mt-1 text-sm tabular-nums text-gray-900">COP <b>{liq.tipoCambio.COP ? liq.tipoCambio.COP.toLocaleString('es-CO') : '—'}</b> · CLP <b>{liq.tipoCambio.CLP ? liq.tipoCambio.CLP.toLocaleString('es-CO') : '—'}</b></div>
          <div className="text-[11px] text-gray-500">{liq.tipoCambio.fecha ? `al ${liq.tipoCambio.fecha}` : 'sin registrar'}</div>
        </div>
      </div>

      {editTc && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-600">Fecha<input type="date" value={tc.fecha} onChange={e => setTc(s => ({ ...s, fecha: e.target.value }))} className="block mt-0.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-gray-600">COP por 1 USD<input type="number" step="any" value={tc.COP} onChange={e => setTc(s => ({ ...s, COP: e.target.value }))} className="block mt-0.5 w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-gray-600">CLP por 1 USD<input type="number" step="any" value={tc.CLP} onChange={e => setTc(s => ({ ...s, CLP: e.target.value }))} className="block mt-0.5 w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></label>
          <button type="button" onClick={guardarTc} disabled={guardando || !tc.fecha} className="px-4 py-1.5 text-sm font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800 disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button>
          <p className="text-[11px] text-gray-500 basis-full">Se usa el último valor registrado hasta el fin del mes. Al cerrar el corte (Fase 4) queda congelado.</p>
        </div>
      )}

      {(faltaTc || faltanTarifas.length > 0 || sinFijo.length > 0) && verValores && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 space-y-0.5">
          <div className="flex items-center gap-1 font-semibold"><ExclamationTriangleIcon className="h-4 w-4" /> Revisar antes de pagar</div>
          {faltaTc && <div>• Falta registrar el tipo de cambio {!liq.tipoCambio.COP && 'COP'} {!liq.tipoCambio.CLP && 'CLP'}: sin él no se convierten los valores a USD.</div>}
          {faltanTarifas.length > 0 && <div>• Sin tarifa para: {faltanTarifas.map(a => `${a.nombre} (${a.valor!.faltanTarifas.join(', ')})`).join('; ')}.</div>}
          {sinFijo.length > 0 && <div>• Semiplanta/planta sin valor fijo mensual: {sinFijo.map(a => a.nombre).join(', ')} (pestaña Advisors).</div>}
        </div>
      )}

      {/* Matriz: valores cargados a cada país */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b bg-gray-50">
          <div className="text-sm font-semibold text-gray-900">Valores a pagar por país</div>
          <div className="text-[11px] text-gray-500">Cada hora se carga al país de los alumnos que asistieron (si nadie asistió, al de los inscritos; si no hubo inscritos, al del advisor). Perú suma a Ecuador.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 border-b">
                <th className="px-4 py-2 text-left">Concepto</th>
                {cols.map(p => <th key={p} className="px-3 py-2 text-right">{p}{p === 'Ecuador' && <span className="normal-case font-normal"> (incl. Perú)</span>}</th>)}
                {cols.length > 1 && <th className="px-3 py-2 text-right bg-sky-50 text-sky-900">Total</th>}
              </tr>
            </thead>
            <tbody>
              {FILAS.map(f => {
                const tot = cols.reduce((s, p) => ({ horas: s.horas + matriz[f.k][p].horas, usd: s.usd + matriz[f.k][p].usd }), { horas: 0, usd: 0 })
                return (
                  <tr key={f.k} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">{f.l}</td>
                    {cols.map(p => { const c = matriz[f.k][p]; const v = usdA(c.usd); return <Celda key={p} horas={c.horas} usd={v.usd} clp={v.clp} cop={v.cop} verValores={verValores} /> })}
                    {cols.length > 1 && (() => { const v = usdA(tot.usd); return <Celda horas={tot.horas} usd={v.usd} clp={v.clp} cop={v.cop} verValores={verValores} fuerte /> })()}
                  </tr>
                )
              })}
              <tr className="border-b border-gray-100 text-gray-400 italic">
                <td className="px-4 py-2">KIDS · Guías</td>
                <td colSpan={cols.length + (cols.length > 1 ? 1 : 0)} className="px-3 py-2 text-right text-xs">se integra en la Fase 3 (horas desde KIDS2026)</td>
              </tr>
              <tr className="bg-sky-800 text-white">
                <td className="px-4 py-2 font-bold">TOTAL</td>
                {cols.map(p => { const t = totalCol(p); const v = usdA(t.usd); return (
                  <td key={p} className="px-3 py-2 text-right tabular-nums">
                    <div className="font-bold">{fmtH(t.horas)} h</div>
                    {verValores && <div className="text-[11px] leading-tight"><div className="font-semibold">{fmtMoneda(v.usd, 'USD')}</div><div className="opacity-80">{fmtMoneda(v.clp, 'CLP')} CLP</div><div className="opacity-80">{fmtMoneda(v.cop, 'COP')} COP</div></div>}
                  </td>) })}
                {cols.length > 1 && (() => { const v = usdA(totalGeneral.usd); return (
                  <td className="px-3 py-2 text-right tabular-nums bg-sky-900">
                    <div className="font-bold">{fmtH(totalGeneral.horas)} h</div>
                    {verValores && <div className="text-[11px] leading-tight"><div className="font-semibold">{fmtMoneda(v.usd, 'USD')}</div><div className="opacity-80">{fmtMoneda(v.clp, 'CLP')} CLP</div><div className="opacity-80">{fmtMoneda(v.cop, 'COP')} COP</div></div>}
                  </td>) })()}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Lo que paga cada grupo */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b bg-gray-50">
          <div className="text-sm font-semibold text-gray-900">Pagos por grupo</div>
          <div className="text-[11px] text-gray-500">Lo que se paga a los advisors de cada país en su moneda y corte. El estado de verificación y el bloqueo SIN FACTURA llegan con el flujo de facturas (Fase 4).</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-500 border-b">
              <th className="px-4 py-2 text-left">Grupo</th><th className="px-3 text-right">Advisors</th><th className="px-3 text-right">Horas</th>
              {verValores && <><th className="px-3 text-right">Moneda local</th><th className="px-3 text-right">USD</th></>}
              <th className="px-3 text-right">Por tipo</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(g => (
              <tr key={g.k} className="border-b border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-800">{g.etiqueta}</td>
                <td className="px-3 text-right tabular-nums">{g.advisors.length}</td>
                <td className="px-3 text-right tabular-nums font-semibold">{fmtH(g.horas)}</td>
                {verValores && <>
                  <td className="px-3 text-right tabular-nums">{fmtMoneda(g.local, MONEDA[g.pais])} {MONEDA[g.pais]}</td>
                  <td className="px-3 text-right tabular-nums font-semibold text-sky-900">{fmtMoneda(enTresMonedas(g.local, MONEDA[g.pais], liq.tipoCambio).USD, 'USD')}</td>
                </>}
                <td className="px-3 text-right text-[11px] text-gray-500 whitespace-nowrap">
                  {(['POR_HORAS', 'SEMIPLANTA', 'PLANTA'] as const).map(t => { const n = g.advisors.filter(a => a.tipoContratacion === t).length; return n ? `${TIPO_LABEL[t]} ${n}` : null }).filter(Boolean).join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
