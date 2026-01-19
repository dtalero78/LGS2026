'use client'

// Página principal del dashboard de servicio
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ServicioPermission } from '@/types/permissions'
import {
  CalendarDays,
  Users,
  UserX,
  ChevronRight
} from 'lucide-react'

interface ServiceOption {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  href: string
  count?: number
}

export default function ServicioPage() {
  const router = useRouter()
  const [loadingCounts, setLoadingCounts] = useState(false)

  const serviceOptions: ServiceOption[] = [
    {
      id: 'welcome-session',
      title: 'Welcome Sessions',
      description: 'Gestión de sesiones de bienvenida para nuevos beneficiarios',
      icon: <CalendarDays className="w-8 h-8 text-blue-600" />,
      href: '/dashboard/servicio/welcome-session'
    },
    {
      id: 'sin-registro',
      title: 'Usuarios sin perfil creado',
      description: 'Beneficiarios que no tienen registro académico asignado',
      icon: <UserX className="w-8 h-8 text-orange-600" />,
      href: '/dashboard/servicio/sin-registro'
    }
  ]

  const handleCardClick = (href: string) => {
    router.push(href)
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={ServicioPermission.WELCOME_CARGAR_EVENTOS}>
        <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Servicio</h1>
          <p className="text-gray-600 mt-2">
            Gestión y administración de servicios para beneficiarios
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => handleCardClick(option.href)}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-6 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-shrink-0">
                  {option.icon}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {option.title}
              </h3>

              <p className="text-gray-600 text-sm mb-4">
                {option.description}
              </p>

              {option.count !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-blue-600">
                    {option.count}
                  </span>
                  <span className="text-sm text-gray-500">registros</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Sección de estadísticas rápidas */}
        <div className="mt-8 bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Estadísticas del Servicio
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-lg font-semibold text-blue-600">
                Total Beneficiarios
              </p>
              <p className="text-sm text-gray-600">
                Todos los beneficiarios registrados
              </p>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CalendarDays className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-lg font-semibold text-green-600">
                Sessions Activas
              </p>
              <p className="text-sm text-gray-600">
                Welcome sessions programadas
              </p>
            </div>

            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <UserX className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-lg font-semibold text-orange-600">
                Sin Registro
              </p>
              <p className="text-sm text-gray-600">
                Beneficiarios sin registro académico
              </p>
            </div>
          </div>
        </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}