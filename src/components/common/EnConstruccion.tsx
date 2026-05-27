'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'

/**
 * Placeholder reutilizable para páginas/tableros aún sin contenido.
 * Usado por los stubs de Tableros por Área (Administración, Gerencia, etc.)
 * colocados bajo Informes en el sidebar.
 */
export default function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{titulo}</h1>
        <p className="text-sm text-gray-500 max-w-md">
          Esta sección está <strong>en construcción</strong>. Pronto encontrarás aquí
          la información correspondiente.
        </p>
      </div>
    </DashboardLayout>
  )
}
