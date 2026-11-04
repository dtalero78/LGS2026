'use client'

/**
 * Administración › Gestión Advisors.
 * Liquidación de horas de advisors LGS y guías KIDS (reemplaza la hoja "Horas Advisors").
 *  - Consolidado y Detalle Advisors: Fase 2 (cálculo) — aún no disponibles.
 *  - Advisors: ficha de pago (tipo, categoría, programa, grupo, fijos).
 *  - Tarifas: por país / programa / tipo / categoría / concepto, con vigencia.
 * Spec: docs/specs/gestion-advisors.md
 */

import { useState } from 'react'
import { ChartPieIcon, TableCellsIcon, UserGroupIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { AdministracionPermission } from '@/types/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import TarifasPanel from '@/components/administracion/TarifasPanel'
import AdvisorsPagoPanel from '@/components/administracion/AdvisorsPagoPanel'

type Tab = 'consolidado' | 'detalle' | 'advisors' | 'tarifas'

function Proximamente({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50/50 p-10 text-center">
      <div className="text-base font-semibold text-sky-900">{titulo}</div>
      <p className="mt-1 text-sm text-sky-800/80 max-w-xl mx-auto">{texto}</p>
    </div>
  )
}

export default function GestionAdvisorsPage() {
  const { hasPermission } = usePermissions()
  const puedeTarifas = hasPermission(AdministracionPermission.TARIFAS)
  const verTarifas = puedeTarifas || hasPermission(AdministracionPermission.VER_COMPENSACION)
  const puedeFicha = hasPermission(AdministracionPermission.FICHA_PAGO)
  const [tab, setTab] = useState<Tab>('consolidado')

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión Advisors</h1>
            <p className="text-sm text-gray-500">Liquidación de horas de advisors LGS y guías Kids: horas por semana y mes, ajustes, facturas, verificación y pago.</p>
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
            <Proximamente titulo="Consolidado — en construcción"
              texto="Valores a pagar por país (Chile, Colombia, Ecuador) en USD, CLP y COP, con impresión en PDF y CSV. Primero se carga la configuración: tarifas y ficha de pago de cada advisor." />
          )}
          {tab === 'detalle' && (
            <Proximamente titulo="Detalle Advisors — en construcción"
              texto="Horas por semana y total mensual por tipo de evento, con subtotales por plataforma, ajustes y estado de cada advisor." />
          )}
          {tab === 'advisors' && <AdvisorsPagoPanel puedeEditar={puedeFicha} />}
          {tab === 'tarifas' && verTarifas && <TarifasPanel puedeEditar={puedeTarifas} />}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
