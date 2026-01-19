'use client'

import { Person, FinancialData } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PersonFinancialProps {
  person: Person
  financialData?: FinancialData
}

export default function PersonFinancial({ person, financialData }: PersonFinancialProps) {

  // Use real financial data or fallback to mock data
  let financial: any
  let paymentProgress: number

  if (financialData) {
    // Transform Wix financial data - only use available real fields
    const data = financialData as any

    // Helper function to parse Colombian currency format: "90.000,00" -> 90000
    const parseCurrency = (value: string | number) => {
      if (!value) return 0
      // If it's already a number, return it
      if (typeof value === 'number') return value
      // Remove dots (thousands separator) and replace comma (decimal separator) with dot
      const cleaned = value.replace(/\./g, '').replace(',', '.')
      return parseFloat(cleaned) || 0
    }

    const cuotaInicialParsed = parseCurrency(data.pagoInscripcion)

    financial = {
      contrato: data.contrato || person.contrato,
      tarifa: parseCurrency(data.valorCuota),
      cuotas: parseInt(data.numeroCuotas) || 0,
      saldo: parseCurrency(data.saldo),
      fechaUltimoPago: data.fechaPago || '',
      totalPlan: parseCurrency(data.totalPlan),
      cuotaInicial: cuotaInicialParsed,
      formaPago: data.medioPago || data.formaPago || 'No especificado',
      plan: data.plan || 'Plan estándar',
      inscripcionPagada: data.inscripcionPagada || 'No',
      confirmaJudith: data.confirmaJudith || 'No',
      confirmaPrixus: data.confirmaPrixus || 'No',
      // Calculate progress based on amount paid vs total
      montoTotal: parseCurrency(data.totalPlan),
      montoPendiente: parseCurrency(data.saldo),
      // Calculate remaining installments: saldo / valorCuota
      cuotasRestantes: data.valorCuota ? Math.ceil(parseCurrency(data.saldo) / parseCurrency(data.valorCuota)) : 0
    }

    // Calculate payment progress based on amounts, not cuotas
    const montoPagado = financial.montoTotal - financial.montoPendiente
    paymentProgress = financial.montoTotal > 0 ? (montoPagado / financial.montoTotal) * 100 : 0
  } else {
    // Mock financial data if not provided
    financial = {
      contrato: person.contrato,
      tarifa: 350000,
      cuotas: 12,
      cuotasPagadas: 8,
      saldo: 1400000,
      fechaUltimoPago: '2024-08-15',
      estado: 'Al día'
    }

    paymentProgress = (financial.cuotasPagadas / financial.cuotas) * 100
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">💳 Resumen Financiero del Titular</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="text-sm font-medium text-primary-600">Valor Plan</div>
            <div className="text-2xl font-bold text-primary-900">
              {financialData ? formatCurrency(financial.totalPlan) : 'No disponible'}
            </div>
          </div>
          <div className="bg-accent-50 border border-accent-200 rounded-lg p-4">
            <div className="text-sm font-medium text-accent-600">Cuota Inicial</div>
            <div className="text-2xl font-bold text-accent-900">
              {financialData ? formatCurrency(financial.cuotaInicial) : 'No disponible'}
            </div>
          </div>
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
            <div className="text-sm font-medium text-warning-600">Saldo</div>
            <div className="text-2xl font-bold text-warning-900">
              {financialData ? formatCurrency(financial.saldo) : 'No disponible'}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-600">Cuotas Restantes</div>
            <div className="text-2xl font-bold text-blue-900">
              {financialData ? financial.cuotasRestantes : 'No disponible'}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">💰 Información de Pagos</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Método de Pago</label>
              <p className="mt-1 text-sm text-gray-900">
                {financialData ? financial.formaPago : 'No disponible'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Plan Contratado</label>
              <p className="mt-1 text-sm text-gray-900">
                {financialData ? financial.plan : 'No disponible'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total del Plan</label>
              <p className="mt-1 text-sm text-gray-900">
                {financialData ? formatCurrency(financial.totalPlan) : 'No disponible'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Inscripción Pagada</label>
              <p className="mt-1 text-sm text-gray-900">
                {financialData ? (financialData as any).inscripcionPagada || 'No especificado' : 'No disponible'}
              </p>
            </div>
          </div>

          {/* Financial Confirmations Section - Only show if financial data exists */}
          {financialData && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Estado de Confirmaciones</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Confirmación Judith:</span>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    financial.confirmaJudith === 'Sí' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {financial.confirmaJudith || 'No'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Confirmación Prixus:</span>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    financial.confirmaPrixus === 'Sí' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {financial.confirmaPrixus || 'No'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}