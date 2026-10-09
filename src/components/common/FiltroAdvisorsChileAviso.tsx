/**
 * Aviso del filtro temporal de capacitación (src/lib/filtro-advisors-chile.ts):
 * se muestra cuando la API devuelve `filtroAdvisorsChile: true`.
 */
export default function FiltroAdvisorsChileAviso({ activo }: { activo?: boolean }) {
  if (!activo) return null
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
      Mostrando clases con advisors de Chile
    </div>
  )
}
