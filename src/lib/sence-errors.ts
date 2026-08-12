/**
 * Mapa de códigos de error (GlosaError) del Anexo 2 del manual "Integración
 * Registro Asistencia SENCE" a mensajes legibles en español. Sin 'server-only':
 * se importa también desde el cliente para mostrar el toast de error.
 */
export const SENCE_ERROR_MESSAGES: Record<string, string> = {
  '200': 'Faltan datos obligatorios en la solicitud a SENCE.',
  '201': 'Faltan las URLs de retorno hacia la plataforma.',
  '202': 'La URL de retorno exitoso tiene formato incorrecto.',
  '203': 'La URL de retorno de error tiene formato incorrecto.',
  '204': 'El Código SENCE del curso no es válido.',
  '205': 'El Código de Curso no es válido.',
  '206': 'La línea de capacitación es incorrecta.',
  '207': 'El RUT del alumno tiene formato incorrecto.',
  '208': 'El alumno no está autorizado para realizar este curso ante SENCE.',
  '209': 'El RUT del OTEC tiene formato incorrecto.',
  '211': 'El Token no pertenece a este OTEC.',
  '212': 'El Token no está vigente.',
  '300': 'Error interno de SENCE no clasificado. Contacta a soporte.',
  '301': 'No se pudo registrar el inicio de sesión (línea de capacitación o código de curso incorrecto).',
  '302': 'No se pudo validar la información del OTEC ante SENCE.',
  '303': 'El Token no existe o su formato es incorrecto.',
  '304': 'No se pudieron verificar los datos enviados a SENCE.',
  '305': 'No se pudo registrar la información en SENCE.',
  '306': 'El Código de Curso no corresponde al Código SENCE indicado.',
  '307': 'El Código de Curso no tiene modalidad E-Learning.',
  '308': 'El Código de Curso no corresponde a este OTEC.',
  '309': 'La fecha de ejecución del curso no corresponde a la fecha actual.',
  '310': 'El curso está en estado Terminado o Anulado en SENCE.',
  '311': 'El RUT ingresado en Clave Única no corresponde al alumno esperado.',
  '312': 'No se pudo completar la autenticación con Clave Única.',
};

const DEFAULT_MESSAGE = 'No se pudo completar el inicio de sesión SENCE. Intenta nuevamente.';

export function getSenceErrorMessage(glosaError?: string | null): string {
  if (!glosaError) return DEFAULT_MESSAGE;
  return SENCE_ERROR_MESSAGES[glosaError] || DEFAULT_MESSAGE;
}
