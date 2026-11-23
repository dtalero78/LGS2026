/**
 * Completa los niveles vacíos de la escala comercial (client-safe, sin imports de servidor).
 *
 * Escala (de menor a mayor): Full Executive (`fe`) → Jefe de Grupo (`tm`) → Gerente (`ge`)
 * → Gerente de División (`gd`) → Sales Manager (`s1`).
 *
 * Regla: si entre el último nivel con nombre (Full Executive o Jefe de Grupo) y el gerente
 * quedan niveles vacíos, se llenan con el nombre del gerente (el ejecutivo reporta directo a
 * él). Lo que queda POR DEBAJO de un nivel con nombre no se toca (si la persona es Jefe de
 * Grupo, su Full Executive sigue vacío) ni lo que está POR ENCIMA del gerente.
 */
export function completarEscala<T extends { fe?: string | null; tm?: string | null; ge?: string | null }>(escala: T): T {
  const ge = String(escala.ge ?? '').trim()
  if (!ge) return escala
  const niveles: ('fe' | 'tm')[] = ['fe', 'tm']
  let base = -1
  niveles.forEach((k, i) => { if (String(escala[k] ?? '').trim()) base = i })
  if (base === 1) return escala
  const out = { ...escala }
  for (let i = base + 1; i < 2; i++) (out as any)[niveles[i]] = ge
  return out
}
