/**
 * Estados de aprobación de una matrícula — regla única (client-safe), acordada 2026-11-26.
 *
 * Lo que se GUARDA en PEOPLE.aprobacion (lo elige Aprobación en la ficha):
 *   - 'Aprobado'
 *   - 'Pendiente' (o vacío) → no se muestra así: el sistema CALCULA
 *        · «Listo para aprobación»  = firmado (OTP o «SÍ, ACEPTO» por correo), con
 *          documentos, con recibo de inscripción y con el contrato en Drive.
 *        · «Requisitos incompletos» = le falta alguno de esos cuatro.
 *     En el selector se ofrece como «Pendiente aprobación» (p. ej. para revertir un
 *     aprobado reciente).
 *   - 'Pendiente Comercial' → algo no está bien pero lo puede corregir Comercial; NO
 *     anula (no inactiva, no libera cupos Kids, no se depura) y se puede volver a aprobar.
 *   - 'Rechazado' → no cumple con los requisitos (anula).
 *   - 'Retractado' → usó la cláusula de 10 días de retracto (anula).
 *   - 'Contrato nulo' → lo marca Aprobación con permiso propio
 *     (PERSON.INFO.MARCAR_CONTRATO_NULO) y confirmación: el contrato podrá borrarse con
 *     sus registros (Limpieza de Anulados).
 *   - 'Devuelto' → estado ANTIGUO: ya no se ofrece; los existentes conservan su
 *     comportamiento (anulado) hasta que se decida qué hacer con ellos.
 */

export const PENDIENTE_COMERCIAL = 'Pendiente Comercial';
export const LISTO_APROBACION = 'Listo para aprobación';
export const REQUISITOS_INCOMPLETOS = 'Requisitos incompletos';

/** Opciones del selector "Estado del Titular" (valor guardado → etiqueta). */
export const OPCIONES_ESTADO: { valor: string; etiqueta: string; icono: string }[] = [
  { valor: 'Aprobado', etiqueta: 'Aprobado', icono: '✅' },
  { valor: 'Pendiente', etiqueta: 'Pendiente aprobación', icono: '⏳' },
  { valor: PENDIENTE_COMERCIAL, etiqueta: PENDIENTE_COMERCIAL, icono: '🔄' },
  { valor: 'Rechazado', etiqueta: 'Rechazado', icono: '❌' },
  { valor: 'Retractado', etiqueta: 'Retractado', icono: '↩️' },
  { valor: 'Contrato nulo', etiqueta: 'Contrato nulo', icono: '⚪' },
];

export type Requisito = 'FIRMA' | 'DOCUMENTOS' | 'RECIBO' | 'DRIVE';
export const REQUISITO_LABEL: Record<Requisito, string> = {
  FIRMA: 'Sin firmar',
  DOCUMENTOS: 'Sin documentos',
  RECIBO: 'Sin recibo',
  DRIVE: 'Sin PDF en Drive',
};

/** true si el estado guardado es "sin estado" (vacío o Pendiente). */
export const esSinEstado = (aprobacion: unknown) =>
  ['', 'pendiente'].includes(String(aprobacion ?? '').trim().toLowerCase());

/** Lo que le falta al contrato para quedar «Listo para aprobación». Recibe el titular (PEOPLE). */
export function requisitosFaltantes(t: any): Requisito[] {
  const docs = Array.isArray(t?.documentacion)
    ? t.documentacion.length > 0
    : typeof t?.documentacion === 'string' ? t.documentacion.trim().length > 2 : !!t?.conDocs;
  return [
    ...(String(t?.hashConsentimiento ?? '').trim() || t?.firmado === true ? [] : ['FIRMA' as const]),
    ...(docs ? [] : ['DOCUMENTOS' as const]),
    ...(t?.reciboInscripcion || t?.conRecibo === true ? [] : ['RECIBO' as const]),
    ...(String(t?.driveFileId ?? '').trim() || t?.conDrive === true ? [] : ['DRIVE' as const]),
  ];
}

/** Estado que se MUESTRA: el guardado o, sin estado, el calculado por requisitos. */
export function estadoVisible(aprobacion: unknown, faltantes: Requisito[]): string {
  if (!esSinEstado(aprobacion)) return String(aprobacion).trim();
  return faltantes.length ? REQUISITOS_INCOMPLETOS : LISTO_APROBACION;
}

/** Estados que anulan el contrato (inactivan, liberan Kids, se depuran). Pendiente Comercial NO. */
export const ESTADOS_ANULACION = ['Contrato nulo', 'Devuelto', 'Rechazado'];
