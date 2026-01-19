'use client'

import { Student } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface StudentFinancialProps {
  student: Student
}

export default function StudentFinancial({ student }: StudentFinancialProps) {
  // Mock financial data - in real implementation, this would come from API
  const financialData = {
    contrato: student.contrato,
    tarifa: 350000,
    cuotas: 12,
    cuotasPagadas: 8,
    saldo: 1400000,
    fechaUltimoPago: '2024-08-15',
    estado: 'Al día',
    pagos: [
      { fecha: '2024-08-15', monto: 350000, concepto: 'Cuota mensual', estado: 'Pagado' },
      { fecha: '2024-07-15', monto: 350000, concepto: 'Cuota mensual', estado: 'Pagado' },
      { fecha: '2024-06-15', monto: 350000, concepto: 'Cuota mensual', estado: 'Pagado' },
      { fecha: '2024-05-15', monto: 350000, concepto: 'Cuota mensual', estado: 'Pagado' },
      { fecha: '2024-04-15', monto: 350000, concepto: 'Cuota mensual', estado: 'Pagado' },
    ]
  }

  const paymentProgress = (financialData.cuotasPagadas / financialData.cuotas) * 100

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">💰 Resumen Financiero</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="text-sm font-medium text-primary-600">Tarifa Mensual</div>
            <div className="text-2xl font-bold text-primary-900">
              {formatCurrency(financialData.tarifa)}
            </div>
          </div>
          <div className="bg-accent-50 border border-accent-200 rounded-lg p-4">
            <div className="text-sm font-medium text-accent-600">Cuotas Pagadas</div>
            <div className="text-2xl font-bold text-accent-900">
              {financialData.cuotasPagadas} / {financialData.cuotas}
            </div>
            <div className="mt-2">
              <div className="bg-accent-200 rounded-full h-2">
                <div
                  className="bg-accent-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${paymentProgress}%` }}
                ></div>
              </div>
              <div className="text-xs text-accent-600 mt-1">
                {paymentProgress.toFixed(1)}% completado
              </div>
            </div>
          </div>
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
            <div className="text-sm font-medium text-warning-600">Saldo Pendiente</div>
            <div className="text-2xl font-bold text-warning-900">
              {formatCurrency(financialData.saldo)}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Status */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">📊 Estado de Cuenta</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Estado de Pago</label>
              <span className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                financialData.estado === 'Al día' ? 'bg-accent-100 text-accent-800' : 'bg-danger-100 text-danger-800'
              }`}>
                {financialData.estado}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Último Pago</label>
              <p className="mt-1 text-sm text-gray-900">
                {formatDate(financialData.fechaUltimoPago)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Número de Contrato</label>
              <p className="mt-1 text-sm text-gray-900">{financialData.contrato}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Próximo Vencimiento</label>
              <p className="mt-1 text-sm text-gray-900">15 Septiembre 2024</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">📋 Historial de Pagos</h3>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Fecha</th>
                <th className="table-header-cell">Concepto</th>
                <th className="table-header-cell">Monto</th>
                <th className="table-header-cell">Estado</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {financialData.pagos.map((pago, index) => (
                <tr key={index}>
                  <td className="table-cell">{formatDate(pago.fecha)}</td>
                  <td className="table-cell">{pago.concepto}</td>
                  <td className="table-cell font-medium">{formatCurrency(pago.monto)}</td>
                  <td className="table-cell">
                    <span className={`badge ${
                      pago.estado === 'Pagado' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {pago.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-4">
        <button className="btn-primary">
          📄 Generar Estado de Cuenta
        </button>
        <button className="btn-secondary">
          💳 Registrar Pago
        </button>
        <button className="btn-secondary">
          📧 Enviar Recordatorio
        </button>
      </div>
    </div>
  )
}