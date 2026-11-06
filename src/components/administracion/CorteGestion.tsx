'use client'

/**
 * Gestión de los cortes de un advisor (dentro del detalle de Gestión Advisors):
 * ajustes (± horas, múltiplos de 0,5, con motivo) · Horas OK (Académico) · factura
 * (ver, lectura IA, inconsistencias, subir en su nombre, devolver) · Verificar
 * (Administración) · Registrar pago (Administración Jefe) · Reabrir (solo SUPER_ADMIN).
 * Cada botón aparece solo con su permiso; el servidor vuelve a validar todo.
 */

import { useState } from 'react'
import toast from 'react-hot-toast'
import { CheckCircleIcon, DocumentArrowUpIcon, ArrowUturnLeftIcon, BanknotesIcon, LockOpenIcon, PlusIcon, ExclamationTriangleIcon, EyeIcon } from '@heroicons/react/24/outline'
import {
  type AdvisorLiq, type CorteInfo, ESTADO_CORTE, CORTE_LABEL, CONCEPTOS_AJUSTE, CONCEPTOS_FACTURA, fmtH, fmtMoneda,
} from './liquidacion-tipos'

export interface PermisosCorte {
  ajustar: boolean; horasOk: boolean; devolver: boolean; verificar: boolean; pagar: boolean; reabrir: boolean; verValores: boolean
}

async function accion(body: Record<string, any>) {
  const res = await fetch('/api/postgres/administracion/cortes/accion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
  return j
}

function UnCorte({ a, c, periodo, semanas, p, onCambio }: { a: AdvisorLiq; c: CorteInfo; periodo: string; semanas: { n: number; inicio: string; fin: string }[]; p: PermisosCorte; onCambio: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [formAj, setFormAj] = useState<null | { alcance: 'TOTAL' | 'SEMANA'; semanaInicio: string; concepto: string; horas: string; motivo: string }>(null)
  const [devolver, setDevolver] = useState<string | null>(null)
  const [pago, setPago] = useState<null | { fecha: string; referencia: string }>(null)
  const [reabrir, setReabrir] = useState<string | null>(null)
  const cerrado = c.estado === 'VERIFICADO' || c.estado === 'PAGADO'
  const base = { advisorId: c.advisorId, programa: c.programa, periodo, corte: c.corte }
  const semanasCorte = semanas.filter(s => c.corte === 'MES' || (c.corte === 'Q1' ? s.inicio <= `${periodo}-15` : s.fin >= `${periodo}-16`))

  const correr = async (body: Record<string, any>, ok: string, after?: () => void) => {
    setOcupado(true)
    try { await accion({ ...base, ...body }); toast.success(ok); after?.(); onCambio() }
    catch (e: any) { toast.error(e?.message || 'No se pudo completar') }
    finally { setOcupado(false) }
  }

  // Concepto de la próxima factura subida en su nombre (un corte admite varias).
  const [conceptoNuevo, setConceptoNuevo] = useState('NORMAL')
  const quitar = async (id: string) => {
    if (!window.confirm('¿Quitar esta factura del corte?')) return
    setOcupado(true)
    try {
      const res = await fetch(`/api/postgres/administracion/cortes/factura?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      toast.success('Factura quitada'); onCambio()
    } catch (e: any) { toast.error(e?.message || 'No se pudo quitar') } finally { setOcupado(false) }
  }

  const subir = async (file: File) => {
    setOcupado(true)
    try {
      const fd = new FormData()
      fd.set('file', file); Object.entries(base).forEach(([k, v]) => fd.set(k, String(v)))
      fd.set('concepto', conceptoNuevo); fd.set('modo', 'agregar')
      const res = await fetch('/api/postgres/administracion/cortes/factura', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      toast.success('Factura subida y leída'); onCambio()
    } catch (e: any) { toast.error(e?.message || 'No se pudo subir') } finally { setOcupado(false) }
  }

  const motivoVerif = !c.horasOk ? 'Falta Horas OK de Académico'
    : c.requiereFactura && c.estado !== 'FACTURA_RECIBIDA' ? 'Falta la factura (o fue devuelta)'
    : c.valor === null && p.verValores ? 'Sin valor calculado (revise tarifas)' : null


  return (
    <div className={`rounded-lg border ${cerrado ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 bg-white'} p-4 space-y-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-gray-900">{CORTE_LABEL[c.corte]}</span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ESTADO_CORTE[c.estado].cls}`}>{ESTADO_CORTE[c.estado].l}</span>
        <span className="text-sm tabular-nums text-gray-700"><b>{fmtH(c.horas)}</b> h</span>
        {p.verValores && c.valor !== null && <span className="text-sm tabular-nums font-semibold text-sky-900">{fmtMoneda(c.valor, c.moneda)} {c.moneda}</span>}
        {c.requiereFactura && !cerrado && <span className="text-[11px] text-gray-500">factura hasta el {c.plazoReenvio && c.plazoReenvio > c.plazo ? c.plazoReenvio : c.plazo}</span>}
        {cerrado && <span className="text-[11px] text-emerald-800">verificó {c.verificadoPor}{c.pagadoEn ? ` · pagado ${c.pagadoEn.slice(0, 10)} (${c.referenciaPago})` : ''}</span>}
      </div>

      {c.cambioTrasVerificar && (
        <div className="flex items-start gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-900">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          Las horas de la plataforma cambiaron después de verificar (congelado: {fmtH(Number(c.snapshot?.horas))} h). Se paga lo congelado; si hay que corregir, SUPER_ADMIN reabre el corte.
        </div>
      )}

      {/* Horas OK */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className={`inline-flex items-center gap-1 font-semibold ${c.horasOk ? 'text-emerald-700' : 'text-gray-500'}`}>
          <CheckCircleIcon className="h-4 w-4" /> {c.horasOk ? `Horas OK (${c.horasOkPor})` : 'Horas sin revisar por Académico'}
        </span>
        {p.horasOk && !cerrado && (
          <button type="button" disabled={ocupado} onClick={() => correr({ accion: 'HORAS_OK', ok: !c.horasOk }, c.horasOk ? 'Revisión retirada' : 'Horas marcadas OK')}
            className="px-2.5 py-1 rounded-md border border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50 font-semibold disabled:opacity-50">
            {c.horasOk ? 'Quitar Horas OK' : 'Marcar Horas OK'}
          </button>
        )}
      </div>

      {/* Ajustes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">Ajustes ({c.ajustes.length})</span>
          {p.ajustar && !cerrado && !formAj && (
            <button type="button" onClick={() => setFormAj({ alcance: 'TOTAL', semanaInicio: semanasCorte[0]?.inicio || '', concepto: 'NORMAL', horas: '', motivo: '' })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"><PlusIcon className="h-3.5 w-3.5" /> Ajuste</button>
          )}
        </div>
        {c.ajustes.map(x => (
          <div key={x._id} className="flex flex-wrap gap-x-3 text-xs text-gray-700 border-l-2 border-sky-300 pl-2">
            <b className={x.horas > 0 ? 'text-emerald-700' : 'text-red-700'}>{x.horas > 0 ? '+' : ''}{x.horas} h</b>
            <span>{CONCEPTOS_AJUSTE.find(k => k.v === x.concepto)?.l || x.concepto}</span>
            <span className="text-gray-500">{x.alcance === 'SEMANA' ? `semana del ${x.semanaInicio?.slice(8)}` : 'total del corte'}</span>
            <span className="italic">“{x.motivo}”</span>
            <span className="text-gray-400">{x.usuarioNombre || x.usuarioEmail} · {x.fecha.slice(0, 10)}</span>
          </div>
        ))}
        {formAj && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-md bg-sky-50 border border-sky-200 p-3">
            <select value={formAj.alcance} onChange={e => setFormAj(f => ({ ...f!, alcance: e.target.value as any }))} className="rounded border border-gray-300 px-2 py-1 text-xs">
              <option value="TOTAL">Total del corte</option><option value="SEMANA">Una semana</option>
            </select>
            {formAj.alcance === 'SEMANA' ? (
              <select value={formAj.semanaInicio} onChange={e => setFormAj(f => ({ ...f!, semanaInicio: e.target.value }))} className="rounded border border-gray-300 px-2 py-1 text-xs">
                {semanasCorte.map(s => <option key={s.n} value={s.inicio}>Sem {s.n} ({s.inicio.slice(8)}–{s.fin.slice(8)})</option>)}
              </select>
            ) : <span />}
            <select value={formAj.concepto} onChange={e => setFormAj(f => ({ ...f!, concepto: e.target.value }))} className="rounded border border-gray-300 px-2 py-1 text-xs">
              {CONCEPTOS_AJUSTE.filter(k => k.v !== 'EXTRA_AUTORIZADA' || a.tipoContratacion === 'SEMIPLANTA').map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
            <input type="number" step={0.5} value={formAj.horas} onChange={e => setFormAj(f => ({ ...f!, horas: e.target.value }))} placeholder="± horas (0,5)" className="rounded border border-gray-300 px-2 py-1 text-xs" />
            <input value={formAj.motivo} onChange={e => setFormAj(f => ({ ...f!, motivo: e.target.value }))} placeholder="Motivo (mín. 10)" className="col-span-2 md:col-span-1 rounded border border-gray-300 px-2 py-1 text-xs" />
            <div className="col-span-2 md:col-span-5 flex justify-end gap-2">
              <button type="button" onClick={() => setFormAj(null)} className="px-2.5 py-1 text-xs text-gray-600 hover:underline">Cancelar</button>
              <button type="button" disabled={ocupado || !formAj.horas || formAj.motivo.trim().length < 10}
                onClick={() => correr({ accion: 'AJUSTE', ...formAj, horas: Number(formAj.horas) }, 'Ajuste registrado', () => setFormAj(null))}
                className="px-3 py-1 text-xs font-semibold text-white bg-sky-700 rounded-md disabled:opacity-50">Guardar ajuste</button>
            </div>
          </div>
        )}
      </div>

      {/* Factura */}
      {c.requiereFactura ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-gray-700">Factura{c.facturas.length > 1 ? `s (${c.facturas.length})` : ''} / boleta</span>
            {!c.facturas.length && <span className="text-gray-400">sin subir</span>}
            {c.factura?.estado === 'DEVUELTA' && <span className="text-amber-700">devuelta: “{c.factura.comentarioDevolucion}”</span>}
            {/* Guías Kids: la factura se sube en KIDS y llega sola aquí (lib/kids-facturas-guias). */}
            {c.programa === 'KIDS' && !cerrado && <span className="ml-auto text-[11px] text-fuchsia-700">La sube la guía en KIDS · Mis horas y facturas</span>}
            {(p.devolver || p.verificar) && !cerrado && c.programa !== 'KIDS' && (
              <span className="ml-auto inline-flex items-center gap-2">
                <select value={conceptoNuevo} onChange={e => setConceptoNuevo(e.target.value)} aria-label="Concepto" className="rounded border border-gray-300 px-1.5 py-0.5 text-xs">
                  {CONCEPTOS_FACTURA.map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                </select>
                <label className="inline-flex items-center gap-1 cursor-pointer text-sky-700 hover:underline">
                  <DocumentArrowUpIcon className="h-4 w-4" /> {c.facturas.some(f => f.estado === 'RECIBIDA') ? 'Agregar en su nombre' : 'Subir en su nombre'}
                  <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={ocupado}
                    onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = '' }} />
                </label>
              </span>
            )}
          </div>
          {c.factura && (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs space-y-1.5">
              {c.facturas.map(f => {
                const ext = f.extraido
                return (
                  <div key={f._id} className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {f.concepto && <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800">{CONCEPTOS_FACTURA.find(x => x.v === f.concepto)?.l || f.concepto}</span>}
                      <a href={`/api/postgres/administracion/factura/${f._id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                        <EyeIcon className="h-3.5 w-3.5" /> {f.nombre || 'ver archivo'}
                      </a>
                      <span className="text-gray-400">subida {f.subidoEn.slice(0, 10)} por {f.subidoPor}</span>
                      {(p.devolver || p.verificar) && !cerrado && c.programa !== 'KIDS' && f.estado === 'RECIBIDA' && (
                        <button type="button" disabled={ocupado} onClick={() => quitar(f._id)} className="ml-auto text-red-600 hover:underline">Quitar</button>
                      )}
                    </div>
                    {ext ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-gray-700 pl-1">
                        <span>{ext.tipoDocumento || 'Documento'} {ext.numero ? `N° ${ext.numero}` : ''}</span>
                        <span>fecha {ext.fecha || '—'}</span>
                        <span>emisor {ext.emisor || '—'} ({ext.documentoEmisor || 'sin doc.'})</span>
                        <span>horas {ext.horas ?? '—'}</span>
                        {p.verValores && <span>bruto {ext.bruto !== null && ext.bruto !== undefined ? Number(ext.bruto).toLocaleString('es-CO') : '—'}{ext.retencion ? ` · ret. ${Number(ext.retencion).toLocaleString('es-CO')}` : ''}</span>}
                      </div>
                    ) : <div className="text-gray-500 pl-1">No se pudo leer con IA.</div>}
                  </div>
                )
              })}
              {c.facturas.length > 1 && (
                <div className="flex flex-wrap gap-x-4 border-t border-gray-200 pt-1 font-semibold text-gray-800">
                  <span>Total {c.facturas.length} facturas:</span>
                  <span>horas {fmtH(c.facturas.reduce((t, f) => t + (Number(f.extraido?.horas) || 0), 0))} (plataforma {fmtH(c.horas)})</span>
                  {p.verValores && <span>bruto {c.facturas.reduce((t, f) => t + (Number(f.extraido?.bruto) || 0), 0).toLocaleString('es-CO')}{c.valor !== null ? ` (esperado ${c.valor.toLocaleString('es-CO')})` : ''}</span>}
                </div>
              )}
              {c.factura.inconsistencias.length > 0 ? (
                <ul className="text-red-700 list-disc pl-4">{c.factura.inconsistencias.map((i, k) => <li key={k}>{i}</li>)}</ul>
              ) : <div className="text-emerald-700 font-semibold">Cuadra con la plataforma.</div>}
            </div>
          )}
          {p.devolver && c.estado === 'FACTURA_RECIBIDA' && (devolver === null ? (
            <button type="button" onClick={() => setDevolver('')} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline">
              <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Devolver al advisor
            </button>
          ) : (
            <div className="flex gap-2">
              <input value={devolver} onChange={e => setDevolver(e.target.value)} placeholder="Qué debe corregir (lo verá el advisor)" className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs" />
              <button type="button" onClick={() => setDevolver(null)} className="text-xs text-gray-600">Cancelar</button>
              <button type="button" disabled={ocupado || devolver.trim().length < 10} onClick={() => correr({ accion: 'DEVOLVER', comentario: devolver }, 'Factura devuelta', () => setDevolver(null))}
                className="px-3 py-1 text-xs font-semibold text-white bg-amber-600 rounded-md disabled:opacity-50">Devolver</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-500">{a.tipoContratacion === 'PLANTA' ? 'Planta: no factura (solo reporte de horas).' : 'Sin horas en este corte: no requiere factura.'}</div>
      )}

      {/* Verificar · Pagar · Reabrir */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
        {p.verificar && !cerrado && c.estado !== 'SIN_HORAS' && (
          <button type="button" disabled={ocupado || !!motivoVerif} title={motivoVerif || 'Congela horas, tarifa y tipo de cambio'}
            onClick={() => correr({ accion: 'VERIFICAR' }, 'Corte verificado: listo para pago')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-40">
            <CheckCircleIcon className="h-4 w-4" /> Verificar (listo para pago)
          </button>
        )}
        {p.verificar && !cerrado && motivoVerif && c.estado !== 'SIN_HORAS' && <span className="text-[11px] text-gray-500">{motivoVerif}</span>}
        {p.pagar && c.estado === 'VERIFICADO' && (pago === null ? (
          <button type="button" onClick={() => setPago({ fecha: new Date().toISOString().slice(0, 10), referencia: '' })}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800">
            <BanknotesIcon className="h-4 w-4" /> Registrar pago
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={pago.fecha} onChange={e => setPago(x => ({ ...x!, fecha: e.target.value }))} className="rounded border border-gray-300 px-2 py-1 text-xs" />
            <input value={pago.referencia} onChange={e => setPago(x => ({ ...x!, referencia: e.target.value }))} placeholder="Referencia / comprobante" className="rounded border border-gray-300 px-2 py-1 text-xs w-48" />
            <button type="button" onClick={() => setPago(null)} className="text-xs text-gray-600">Cancelar</button>
            <button type="button" disabled={ocupado || pago.referencia.trim().length < 3} onClick={() => correr({ accion: 'PAGAR', ...pago }, 'Pago registrado', () => setPago(null))}
              className="px-3 py-1 text-xs font-semibold text-white bg-sky-700 rounded-md disabled:opacity-50">Confirmar pago</button>
          </div>
        ))}
        {p.reabrir && cerrado && (reabrir === null ? (
          <button type="button" onClick={() => setReabrir('')} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline">
            <LockOpenIcon className="h-3.5 w-3.5" /> Reabrir (SUPER_ADMIN)
          </button>
        ) : (
          <div className="ml-auto flex gap-2">
            <input value={reabrir} onChange={e => setReabrir(e.target.value)} placeholder="Motivo (mín. 10)" className="rounded border border-gray-300 px-2 py-1 text-xs w-56" />
            <button type="button" onClick={() => setReabrir(null)} className="text-xs text-gray-600">Cancelar</button>
            <button type="button" disabled={ocupado || reabrir.trim().length < 10} onClick={() => correr({ accion: 'REABRIR', motivo: reabrir }, 'Corte reabierto', () => setReabrir(null))}
              className="px-3 py-1 text-xs font-semibold text-white bg-red-600 rounded-md disabled:opacity-50">Reabrir</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CorteGestion({ a, cortes, periodo, semanas, permisos, onCambio }: {
  a: AdvisorLiq; cortes: CorteInfo[]; periodo: string; semanas: { n: number; inicio: string; fin: string }[]; permisos: PermisosCorte; onCambio: () => void
}) {
  if (!cortes.length) return <p className="p-6 text-center text-sm text-gray-500">Sin cortes para este advisor en el mes.</p>
  return (
    <div className="space-y-3 p-4">
      {cortes.map(c => <UnCorte key={c.corte} a={a} c={c} periodo={periodo} semanas={semanas} p={permisos} onCambio={onCambio} />)}
    </div>
  )
}
