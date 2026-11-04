'use client'

/**
 * Administración › Gestión Advisors.
 * Liquidación de horas de advisors LGS y guías KIDS (reemplaza la hoja "Horas Advisors").
 *  - Consolidado: valores a pagar por país (USD / CLP / COP) y pagos por grupo.
 *  - Detalle Advisors: horas por semana y mes por tipo de evento, subtotales por plataforma.
 *  - Advisors: ficha de pago (tipo, categoría, programa, grupo, fijos).
 *  - Tarifas: por país / programa / tipo / categoría / concepto, con vigencia.
 * Consolidado y Detalle comparten el mes elegido (una sola consulta).
 * Spec: docs/specs/gestion-advisors.md
 */

import { useCallback, useEffect, useState } from 'react'
import { ChartPieIcon, TableCellsIcon, UserGroupIcon, CurrencyDollarIcon, ChevronLeftIcon, ChevronRightIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { AdministracionPermission } from '@/types/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { api, handleApiError } from '@/hooks/use-api'
import TarifasPanel from '@/components/administracion/TarifasPanel'
import AdvisorsPagoPanel from '@/components/administracion/AdvisorsPagoPanel'
import DetalleAdvisorsPanel from '@/components/administracion/DetalleAdvisorsPanel'
import ConsolidadoPanel from '@/components/administracion/ConsolidadoPanel'
import { type Liquidacion, type CorteInfo, etiquetaPeriodo, corrPeriodo } from '@/components/administracion/liquidacion-tipos'
import { useSession } from 'next-auth/react'

type Tab = 'consolidado' | 'detalle' | 'advisors' | 'tarifas'

export default function GestionAdvisorsPage() {
  const { hasPermission } = usePermissions()
  const puedeTarifas = hasPermission(AdministracionPermission.TARIFAS)
  const verTarifas = puedeTarifas || hasPermission(AdministracionPermission.VER_COMPENSACION)
  const puedeFicha = hasPermission(AdministracionPermission.FICHA_PAGO)
  const puedeExportar = hasPermission(AdministracionPermission.CONSOLIDADO_EXPORTAR)
  const puedeImprimir = hasPermission(AdministracionPermission.CONSOLIDADO_IMPRIMIR)
  const [tab, setTab] = useState<Tab>('consolidado')
  const { data: session } = useSession()
  const permisos = {
    ajustar: hasPermission(AdministracionPermission.AJUSTAR), horasOk: hasPermission(AdministracionPermission.HORAS_OK),
    devolver: hasPermission(AdministracionPermission.FACTURA_DEVOLVER), verificar: hasPermission(AdministracionPermission.VERIFICAR),
    pagar: hasPermission(AdministracionPermission.REGISTRAR_PAGO), reabrir: (session?.user as any)?.role === 'SUPER_ADMIN',
    verValores: hasPermission(AdministracionPermission.VER_COMPENSACION),
  }
  const [cortes, setCortes] = useState<CorteInfo[]>([])
  const [bloqueoGrupo, setBloqueoGrupo] = useState(true)

  const mesActual = new Date().toISOString().slice(0, 7)
  const [periodo, setPeriodo] = useState(mesActual)
  const [liq, setLiq] = useState<Liquidacion | null>(null)
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [l, c] = await Promise.all([
        api.get<Liquidacion>(`/api/postgres/administracion/liquidacion?periodo=${periodo}`),
        api.get<{ cortes: CorteInfo[]; bloqueoGrupo: boolean }>(`/api/postgres/administracion/cortes?periodo=${periodo}`),
      ])
      setLiq(l); setCortes(c.cortes || []); setBloqueoGrupo(c.bloqueoGrupo !== false)
    } catch (e) {
      handleApiError(e, 'No se pudo calcular la liquidación')
    } finally {
      setLoading(false)
    }
  }, [periodo])
  const usaLiq = tab === 'consolidado' || tab === 'detalle'
  useEffect(() => { if (usaLiq && liq?.periodo !== periodo) cargar() }, [usaLiq, periodo, liq?.periodo, cargar])

  const tabs: [Tab, string, any][] = [
    ['consolidado', 'Consolidado', ChartPieIcon],
    ['detalle', 'Detalle Advisors', TableCellsIcon],
    ['advisors', 'Advisors', UserGroupIcon],
    ...(verTarifas ? [['tarifas', 'Tarifas', CurrencyDollarIcon] as [Tab, string, any]] : []),
  ]

  return (
    <DashboardLayout>
      <PermissionGuard permission={AdministracionPermission.GESTION_ADVISORS_VER} showDefaultMessage>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión Advisors</h1>
              <p className="text-sm text-gray-500">Liquidación de horas de advisors LGS y guías Kids: horas por semana y mes, ajustes, facturas, verificación y pago.</p>
            </div>
            {usaLiq && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPeriodo(p => corrPeriodo(p, -1))} className="p-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50"><ChevronLeftIcon className="h-4 w-4" /></button>
                <input type="month" value={periodo} max={mesActual} onChange={e => e.target.value && setPeriodo(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm" aria-label="Mes" />
                <button type="button" onClick={() => setPeriodo(p => corrPeriodo(p, 1))} disabled={periodo >= mesActual} className="p-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"><ChevronRightIcon className="h-4 w-4" /></button>
                <button type="button" onClick={cargar} disabled={loading} title="Recalcular" className="ml-1 p-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40">
                  <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <span className="ml-2 text-sm font-semibold text-gray-700">{etiquetaPeriodo(periodo)}</span>
              </div>
            )}
          </div>
          <div className="flex items-end gap-2 border-b border-gray-200">
            {tabs.map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-sky-700 text-sky-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          {tab === 'consolidado' && (
            <ConsolidadoPanel liq={liq?.periodo === periodo ? liq : null} cortes={cortes} bloqueoGrupo={bloqueoGrupo} loading={loading} puedeExportar={puedeExportar}
              puedeImprimir={puedeImprimir} puedeTipoCambio={puedeTarifas} onTipoCambio={cargar} />
          )}
          {tab === 'detalle' && <DetalleAdvisorsPanel liq={liq?.periodo === periodo ? liq : null} cortes={cortes} loading={loading} puedeExportar={puedeExportar} permisos={permisos} onCambio={cargar} />}
          {tab === 'advisors' && <AdvisorsPagoPanel puedeEditar={puedeFicha} />}
          {tab === 'tarifas' && verTarifas && <TarifasPanel puedeEditar={puedeTarifas} />}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
