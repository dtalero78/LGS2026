'use client'

/**
 * /admin/cargar-beneficiarios — Mantenimiento > Contratos > Cargar Beneficiarios.
 *
 * Carga masiva de beneficiarios a un contrato existente: se pide el número de
 * contrato, se pega una lista o se sube un CSV, se revisa en una tabla editable
 * (marcando los documentos que ya existen) y se crean los nuevos heredando los
 * datos del titular. Omite los numeroId que ya existen (idempotente).
 *
 * Permiso: MANTENIMIENTO.CONTRATOS.CARGAR_BENEFICIARIOS (SUPER_ADMIN/ADMIN bypass).
 */

import { useState } from 'react'
import { MagnifyingGlassIcon, TrashIcon, PlusIcon, ArrowUpTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { PermissionGuard } from '@/components/permissions'
import { MantenimientoPermission } from '@/types/permissions'

interface Titular {
  _id: string; primerNombre: string; primerApellido: string; numeroId: string;
  plataforma: string; contrato: string; tipoPersona?: string;
}
interface Row {
  primerApellido: string; segundoApellido: string;
  primerNombre: string; segundoNombre: string;
  numeroId: string; email: string; celular: string;
}

const emptyRow = (): Row => ({ primerApellido: '', segundoApellido: '', primerNombre: '', segundoNombre: '', numeroId: '', email: '', celular: '' })
const norm = (v: string) => (v || '').toUpperCase().replace(/[.\s-]/g, '')

// Aliases de encabezado → campo. Si la primera fila no es encabezado, se usa el
// orden del CSV: primerApellido, segundoApellido, primerNombre, segundoNombre, numeroId, email, celular.
const ALIASES: Record<string, keyof Row> = {
  primerapellido: 'primerApellido', apellido: 'primerApellido', 'primer apellido': 'primerApellido', apellido1: 'primerApellido',
  segundoapellido: 'segundoApellido', 'segundo apellido': 'segundoApellido', apellido2: 'segundoApellido',
  primernombre: 'primerNombre', nombre: 'primerNombre', 'primer nombre': 'primerNombre', nombre1: 'primerNombre', nombres: 'primerNombre',
  segundonombre: 'segundoNombre', 'segundo nombre': 'segundoNombre', nombre2: 'segundoNombre',
  numeroid: 'numeroId', documento: 'numeroId', id: 'numeroId', cedula: 'numeroId', 'cédula': 'numeroId', rut: 'numeroId', identificacion: 'numeroId', 'identificación': 'numeroId', 'numero id': 'numeroId',
  email: 'email', correo: 'email', 'e-mail': 'email', mail: 'email',
  celular: 'celular', telefono: 'celular', 'teléfono': 'celular', movil: 'celular', 'móvil': 'celular', cel: 'celular', phone: 'celular',
}
const ORDER: (keyof Row)[] = ['primerApellido', 'segundoApellido', 'primerNombre', 'segundoNombre', 'numeroId', 'email', 'celular']

function parseLista(text: string): Row[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',')
  const cells = (l: string) => l.split(sep).map(c => c.trim())

  // ¿La primera fila es encabezado? (si alguna celda matchea un alias)
  const first = cells(lines[0]).map(c => c.toLowerCase())
  const isHeader = first.some(c => ALIASES[c])
  let mapping: (keyof Row | null)[]
  let dataLines: string[]
  if (isHeader) {
    mapping = first.map(c => ALIASES[c] || null)
    dataLines = lines.slice(1)
  } else {
    mapping = ORDER
    dataLines = lines
  }

  return dataLines.map(l => {
    const c = cells(l)
    const r = emptyRow()
    mapping.forEach((field, i) => { if (field && c[i] != null) (r as any)[field] = c[i] })
    return r
  }).filter(r => r.numeroId || r.primerNombre || r.primerApellido)
}

function CargarBeneficiariosInner() {
  const [contrato, setContrato] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [titular, setTitular] = useState<Titular | null>(null)
  const [existentes, setExistentes] = useState<Set<string>>(new Set())
  const [benefActuales, setBenefActuales] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [pegado, setPegado] = useState('')
  const [creando, setCreando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  const buscar = async () => {
    const c = contrato.trim()
    if (!c) { toast.error('Escribe el número de contrato'); return }
    setBuscando(true); setTitular(null); setResultado(null)
    try {
      const res = await fetch(`/api/admin/cargar-beneficiarios?contrato=${encodeURIComponent(c)}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se encontró el contrato')
      setTitular(d.titular)
      setExistentes(new Set<string>(d.numeroIdsExistentes || []))
      setBenefActuales(d.beneficiariosActuales || 0)
      toast.success('Contrato encontrado')
    } catch (e: any) {
      toast.error(e.message || 'Error al buscar')
      setTitular(null)
    } finally { setBuscando(false) }
  }

  const procesarPegado = () => {
    const parsed = parseLista(pegado)
    if (!parsed.length) { toast.error('No se detectaron filas válidas'); return }
    setRows(prev => [...prev, ...parsed])
    setPegado('')
    toast.success(`${parsed.length} fila(s) agregada(s)`)
  }

  const subirCSV = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseLista(String(reader.result || ''))
      if (!parsed.length) { toast.error('El CSV no tiene filas válidas'); return }
      setRows(prev => [...prev, ...parsed])
      toast.success(`${parsed.length} fila(s) del CSV`)
    }
    reader.readAsText(file, 'utf-8')
  }

  const setCell = (i: number, field: keyof Row, value: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }
  const quitar = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const esDuplicado = (r: Row) => existentes.has(norm(r.numeroId))
  const nuevos = rows.filter(r => norm(r.numeroId) && !esDuplicado(r))
  const dups = rows.filter(r => norm(r.numeroId) && esDuplicado(r))

  const crear = async () => {
    if (!titular) return
    if (!nuevos.length) { toast.error('No hay beneficiarios nuevos para crear'); return }
    setCreando(true); setResultado(null)
    try {
      const res = await fetch('/api/admin/cargar-beneficiarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato: titular.contrato, beneficiarios: rows }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Error al crear')
      setResultado(d)
      toast.success(`${d.insertados} creado(s), ${d.omitidos} omitido(s)`)
      // Refresca el estado de existentes para reflejar los recién creados.
      await buscar()
      setRows([])
    } catch (e: any) {
      toast.error(e.message || 'Error al crear')
    } finally { setCreando(false) }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cargar Beneficiarios</h1>
        <p className="text-gray-600 mt-1">Carga masiva de beneficiarios a un contrato existente. Pega una lista o sube un CSV; se omiten los documentos que ya están registrados.</p>
      </div>

      {/* Paso 1: buscar contrato */}
      <div className="bg-white shadow rounded-lg p-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Número de contrato</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={contrato}
            onChange={e => setContrato(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') buscar() }}
            placeholder="01-15979-26"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          />
          <button onClick={buscar} disabled={buscando}
            className="inline-flex items-center px-4 py-2 rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50">
            <MagnifyingGlassIcon className="h-5 w-5 mr-2" />{buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {titular && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-primary-50 border border-primary-100 px-4 py-3">
            <div className="font-bold text-gray-900">{titular.primerNombre} {titular.primerApellido}</div>
            <div className="text-sm text-gray-600">Contrato: <b>{titular.contrato}</b></div>
            <div className="text-sm text-gray-600">Plataforma: <b>{titular.plataforma}</b></div>
            {titular.tipoPersona && <div className="text-sm text-gray-600">Tipo: <b>{titular.tipoPersona}</b></div>}
            <div className="text-sm text-gray-600">Beneficiarios actuales: <b>{benefActuales}</b></div>
          </div>
        )}
      </div>

      {/* Paso 2: cargar lista */}
      {titular && (
        <div className="bg-white shadow rounded-lg p-5 space-y-4">
          <div className="text-sm text-gray-600">
            Columnas esperadas (con o sin encabezado): <b>Primer apellido · Segundo apellido · Primer nombre · Segundo nombre · N° identificación · Email · Celular</b>. Separadores admitidos: coma, punto y coma o tab.
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pegar lista</label>
              <textarea
                value={pegado}
                onChange={e => setPegado(e.target.value)}
                rows={5}
                placeholder="Zepeda;Perez;Yuri;Osvaldo;12441480-6;yuri@correo.cl;+56989009278"
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
              <button onClick={procesarPegado} className="mt-2 inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100">
                Procesar pegado
              </button>
            </div>
            <div className="flex flex-col justify-start gap-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Subir CSV</label>
              <label className="inline-flex items-center px-3 py-2 text-sm rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer w-fit">
                <ArrowUpTrayIcon className="h-4 w-4 mr-2" /> Elegir archivo CSV
                <input type="file" accept=".csv,text/csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirCSV(f); e.currentTarget.value = '' }} />
              </label>
              <button onClick={() => setRows(prev => [...prev, emptyRow()])} className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 w-fit">
                <PlusIcon className="h-4 w-4 mr-1" /> Agregar fila
              </button>
            </div>
          </div>

          {/* Tabla editable */}
          {rows.length > 0 && (
            <>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Primer apellido</th>
                      <th className="px-2 py-2 text-left">Segundo apellido</th>
                      <th className="px-2 py-2 text-left">Primer nombre</th>
                      <th className="px-2 py-2 text-left">Segundo nombre</th>
                      <th className="px-2 py-2 text-left">N° ID</th>
                      <th className="px-2 py-2 text-left">Email</th>
                      <th className="px-2 py-2 text-left">Celular</th>
                      <th className="px-2 py-2 text-left">Estado</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const dup = esDuplicado(r)
                      return (
                        <tr key={i} className={dup ? 'bg-gray-50' : ''}>
                          {ORDER.map(field => (
                            <td key={field} className="px-1 py-1">
                              <input
                                value={(r as any)[field]}
                                onChange={e => setCell(i, field, e.target.value)}
                                className="w-full min-w-[90px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1 whitespace-nowrap">
                            {!norm(r.numeroId) ? <span className="text-xs text-gray-400">sin ID</span>
                              : dup ? <span className="text-xs font-semibold text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">ya existe</span>
                              : <span className="text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">nuevo</span>}
                          </td>
                          <td className="px-2 py-1">
                            <button onClick={() => quitar(i)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  <b>{rows.length}</b> filas · <b className="text-green-700">{nuevos.length}</b> nuevos · <b>{dups.length}</b> ya existen (se omiten)
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setRows([])} className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50">Limpiar</button>
                  <button onClick={crear} disabled={creando || !nuevos.length}
                    className="inline-flex items-center px-5 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {creando ? 'Creando...' : `Crear ${nuevos.length} beneficiario(s)`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="bg-white shadow rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">Resultado</h2>
          </div>
          <div className="flex flex-wrap gap-6 text-sm mb-3">
            <span><b className="text-green-700 text-lg">{resultado.insertados}</b> insertados</span>
            <span><b className="text-gray-600 text-lg">{resultado.omitidos}</b> omitidos (ya existían)</span>
            {resultado.fallidos > 0 && <span><b className="text-red-600 text-lg">{resultado.fallidos}</b> con error</span>}
          </div>
          {Array.isArray(resultado.detalle) && resultado.detalle.some((d: any) => d.estado === 'error') && (
            <ul className="text-xs text-red-600 list-disc pl-5">
              {resultado.detalle.filter((d: any) => d.estado === 'error').map((d: any, i: number) => (
                <li key={i}>{d.nombre} ({d.numeroId}): {d.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function CargarBeneficiariosPage() {
  return (
    <PermissionGuard permission={MantenimientoPermission.CARGAR_BENEFICIARIOS} showDefaultMessage>
      <CargarBeneficiariosInner />
    </PermissionGuard>
  )
}
