'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'

interface Beneficiario {
  _id: string
  primerNombre: string
  segundoNombre?: string
  primerApellido: string
  segundoApellido?: string
  numeroId: string
  email: string
  celular?: string
  plataforma?: string
  fechaContrato: string
  contrato: string
  totalSesiones: number
}

export default function InformeBeneficiariosPage() {
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBuscar = async () => {
    if (!fechaInicio || !fechaFin) {
      setError('Por favor selecciona ambas fechas')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/informes/beneficiarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fechaInicio,
          fechaFin,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener el informe')
      }

      setBeneficiarios(data.beneficiarios || [])
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const exportarCSV = () => {
    if (beneficiarios.length === 0) {
      alert('No hay datos para exportar')
      return
    }

    // Crear CSV
    const headers = [
      'Nombre Completo',
      'Número ID',
      'Email',
      'Celular',
      'Plataforma',
      'Fecha Contrato',
      'Contrato',
      'Total Sesiones'
    ]

    const rows = beneficiarios.map(b => [
      `${b.primerNombre} ${b.segundoNombre || ''} ${b.primerApellido} ${b.segundoApellido || ''}`.trim(),
      b.numeroId,
      b.email,
      b.celular || '',
      b.plataforma || '',
      format(new Date(b.fechaContrato), 'dd/MM/yyyy', { locale: es }),
      b.contrato,
      b.totalSesiones.toString()
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `informe-beneficiarios-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-bold text-gray-900">Informe de Beneficiarios</h1>
        <p className="mt-2 text-sm text-gray-700">
          Consulta todos los beneficiarios creados en un rango de fechas específico
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fecha Inicio */}
          <div>
            <label htmlFor="fechaInicio" className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Inicio
            </label>
            <div className="relative">
              <input
                type="date"
                id="fechaInicio"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
              <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Fecha Fin */}
          <div>
            <label htmlFor="fechaFin" className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Fin
            </label>
            <div className="relative">
              <input
                type="date"
                id="fechaFin"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
              <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Botón Buscar */}
          <div className="flex items-end">
            <button
              onClick={handleBuscar}
              disabled={loading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* Resultados */}
      {beneficiarios.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header con contador y botón exportar */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                Resultados
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {beneficiarios.length} beneficiario{beneficiarios.length !== 1 ? 's' : ''} encontrado{beneficiarios.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={exportarCSV}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Exportar CSV
            </button>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre Completo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Número ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Celular
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plataforma
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Contrato
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contrato
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Sesiones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {beneficiarios.map((beneficiario) => (
                  <tr key={beneficiario._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {beneficiario.primerNombre} {beneficiario.segundoNombre || ''} {beneficiario.primerApellido} {beneficiario.segundoApellido || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {beneficiario.numeroId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {beneficiario.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {beneficiario.celular || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {beneficiario.plataforma || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(beneficiario.fechaContrato), 'dd/MM/yyyy', { locale: es })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {beneficiario.contrato}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-primary-600">
                      {beneficiario.totalSesiones}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estado inicial */}
      {!loading && beneficiarios.length === 0 && fechaInicio && fechaFin && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">No se encontraron beneficiarios en el rango de fechas seleccionado</p>
        </div>
      )}
    </div>
  )
}
