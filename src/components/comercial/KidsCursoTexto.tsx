/**
 * Colores de los cursos Kids: JUNIOR en fucsia y YOUNGSTER en azul. Se usan en el
 * modal de beneficiario Kids (Crear Contrato y ficha) y en Comercial › Cursos Kids.
 */
export function cursoColorCls(tipo?: string | null): string {
  const t = String(tipo || '').toUpperCase()
  if (t === 'JUNIOR') return 'text-fuchsia-600'
  if (t === 'YOUNGSTER') return 'text-blue-600'
  return ''
}

/** Pinta las palabras JUNIOR / YOUNGSTER dentro de un texto (p. ej. "JUNIOR Salón 04"). */
export default function KidsCursoTexto({ texto, className = '' }: { texto?: string | null; className?: string }) {
  const partes = String(texto || '').split(/(JUNIOR|YOUNGSTER)/i)
  return (
    <span className={className}>
      {partes.map((p, i) => {
        const cls = cursoColorCls(p)
        return cls ? <span key={i} className={`font-bold ${cls}`}>{p}</span> : <span key={i}>{p}</span>
      })}
    </span>
  )
}
