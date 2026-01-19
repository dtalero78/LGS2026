/**
 * Definiciones de Permisos - LGS Admin Panel
 * Catálogo completo de permisos disponibles en el sistema
 */

import {
  Permission,
  PermissionDefinition,
  Module,
  PersonPermission,
  StudentPermission,
  AcademicoPermission,
  ServicioPermission,
  ComercialPermission,
  AprobacionPermission,
} from '@/types/permissions';

// ============================================================================
// CATÁLOGO DE PERMISOS
// ============================================================================

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // ========== PERSON MODULE ==========
  {
    code: PersonPermission.DESCARGAR_CONTRATO,
    module: Module.PERSON,
    name: 'Descargar Contrato',
    description: 'Permite descargar el contrato del usuario',
  },
  {
    code: PersonPermission.VER_DOCUMENTACION,
    module: Module.PERSON,
    name: 'Ver Documentación',
    description: 'Permite visualizar la documentación del usuario',
  },
  {
    code: PersonPermission.ADICION_DOCUMENTACION,
    module: Module.PERSON,
    name: 'Adición Documentación',
    description: 'Permite agregar nueva documentación',
  },
  {
    code: PersonPermission.ACTIVAR_DESACTIVAR,
    module: Module.PERSON,
    name: 'Activar/Desactivar',
    description: 'Permite activar o desactivar el perfil del usuario',
  },
  {
    code: PersonPermission.CAMBIO_CELULAR,
    module: Module.PERSON,
    name: 'Cambio Celular Titular',
    description: 'Permite cambiar el número de celular del titular',
  },
  {
    code: PersonPermission.CAMBIAR_ESTADO,
    module: Module.PERSON,
    name: 'Cambiar Estado Actual',
    description: 'Permite modificar el estado actual del usuario',
  },
  {
    code: PersonPermission.APROBAR,
    module: Module.PERSON,
    name: 'Aprobar',
    description: 'Permite aprobar procesos o solicitudes',
  },
  {
    code: PersonPermission.MODIFICAR,
    module: Module.PERSON,
    name: 'Modificar',
    description: 'Permite modificar información del usuario',
  },
  {
    code: PersonPermission.ELIMINAR,
    module: Module.PERSON,
    name: 'Eliminar',
    description: 'Permite eliminar el registro del usuario',
  },
  {
    code: PersonPermission.AGREGAR_BENEFICIARIO,
    module: Module.PERSON,
    name: 'Agregar Beneficiario',
    description: 'Permite añadir un beneficiario al contrato',
  },
  {
    code: PersonPermission.WHATSAPP,
    module: Module.PERSON,
    name: 'WhatsApp',
    description: 'Permite enviar mensaje o abrir chat de WhatsApp',
  },

  // ========== STUDENT MODULE ==========
  {
    code: StudentPermission.ENVIAR_MENSAJE,
    module: Module.STUDENT,
    name: 'Enviar Mensaje',
    description: 'Permite enviar mensaje al estudiante',
  },
  {
    code: StudentPermission.GUARDAR_PLANTILLA,
    module: Module.STUDENT,
    name: 'Guardar Plantilla',
    description: 'Permite guardar información como plantilla',
  },
  {
    code: StudentPermission.TABLA_FILTROS,
    module: Module.STUDENT,
    name: 'Filtros (Asistencia)',
    description: 'Permite filtrar la tabla de asistencia',
  },
  {
    code: StudentPermission.TABLA_DESCARGAR,
    module: Module.STUDENT,
    name: 'Descargar (Asistencia)',
    description: 'Permite descargar la tabla de asistencia',
  },
  {
    code: StudentPermission.COMO_VOY,
    module: Module.STUDENT,
    name: 'Cómo voy',
    description: 'Permite visualizar el diagnóstico académico del estudiante con estadísticas de asistencia, participación y progreso',
  },
  {
    code: StudentPermission.EVALUACION,
    module: Module.STUDENT,
    name: 'Evaluación',
    description: 'Permite acceder a la evaluación de la clase',
  },
  {
    code: StudentPermission.ANOTACION_ADVISOR,
    module: Module.STUDENT,
    name: 'Anotación Advisor',
    description: 'Permite anotar observaciones del advisor',
  },
  {
    code: StudentPermission.COMENTARIOS_ESTUDIANTE,
    module: Module.STUDENT,
    name: 'Comentarios Estudiante',
    description: 'Permite visualizar/agregar comentarios del estudiante',
  },
  {
    code: StudentPermission.ELIMINAR_EVENTO,
    module: Module.STUDENT,
    name: 'Eliminar Evento',
    description: 'Permite eliminar el evento de clase',
  },
  {
    code: StudentPermission.AGENDAR_CLASE,
    module: Module.STUDENT,
    name: 'Agendar Nueva Clase',
    description: 'Permite agendar una nueva clase para el estudiante',
  },
  {
    code: StudentPermission.MARCAR_STEP,
    module: Module.STUDENT,
    name: 'Gestión de Steps (Marcar)',
    description: 'Permite marcar un step como completado en la sección Gestión de Steps',
  },
  {
    code: StudentPermission.ASIGNAR_STEP,
    module: Module.STUDENT,
    name: 'Gestión de Steps (Asignar)',
    description: 'Permite asignar un nuevo step al estudiante en la sección Gestión de Steps',
  },
  {
    code: StudentPermission.CONSULTA,
    module: Module.STUDENT,
    name: 'Consulta Contrato',
    description: 'Permite consultar detalles del contrato',
  },
  {
    code: StudentPermission.ACTIVAR_HOLD,
    module: Module.STUDENT,
    name: 'Activar/Desactivar HOLD',
    description: 'Permite activar o desactivar el estado HOLD del estudiante',
  },
  {
    code: StudentPermission.EXTENDER_VIGENCIA,
    module: Module.STUDENT,
    name: 'Extender Vigencia',
    description: 'Permite extender la vigencia del contrato',
  },
  {
    code: StudentPermission.GENERAR_ESTADO,
    module: Module.STUDENT,
    name: 'Generar Estado Cuenta',
    description: 'Permite generar el estado de cuenta del estudiante',
  },
  {
    code: StudentPermission.REGISTRAR_PAGO,
    module: Module.STUDENT,
    name: 'Registrar Pago',
    description: 'Permite registrar un nuevo pago',
  },
  {
    code: StudentPermission.ENVIO_RECORDATORIO,
    module: Module.STUDENT,
    name: 'Envío Recordatorio',
    description: 'Permite enviar recordatorio de pago al estudiante',
  },

  // ========== ACADEMICO MODULE ==========
  {
    code: AcademicoPermission.CALENDARIO_VER,
    module: Module.ACADEMICO,
    name: 'Ver Calendario',
    description: 'Permite visualizar el calendario de sesiones',
  },
  {
    code: AcademicoPermission.LISTA_VER,
    module: Module.ACADEMICO,
    name: 'Ver Agenda',
    description: 'Permite visualizar la lista/agenda de sesiones',
  },
  {
    code: AcademicoPermission.FILTRO,
    module: Module.ACADEMICO,
    name: 'Filtro',
    description: 'Permite filtrar las sesiones en la agenda',
  },
  {
    code: AcademicoPermission.NUEVO_EVENTO,
    module: Module.ACADEMICO,
    name: 'Nuevo Evento',
    description: 'Permite crear un nuevo evento/sesión',
  },
  {
    code: AcademicoPermission.EXPORTAR_CSV,
    module: Module.ACADEMICO,
    name: 'Exportar CSV',
    description: 'Permite exportar la agenda a formato CSV',
  },
  {
    code: AcademicoPermission.EDITAR,
    module: Module.ACADEMICO,
    name: 'Editar',
    description: 'Permite editar un evento existente',
  },
  {
    code: AcademicoPermission.CREAR_EVENTO,
    module: Module.ACADEMICO,
    name: 'Crear Evento',
    description: 'Permite crear evento (acción global)',
  },
  {
    code: AcademicoPermission.IR_A_SESION,
    module: Module.ACADEMICO,
    name: 'Ir a la Sesión',
    description: 'Permite acceder a la página de gestión de una sesión específica (tomar asistencia, evaluar, agregar comentarios)',
  },
  {
    code: AcademicoPermission.VER,
    module: Module.ACADEMICO,
    name: 'Ver Agenda Académica',
    description: 'Permite visualizar la agenda académica',
  },
  {
    code: AcademicoPermission.AGENDAMIENTO,
    module: Module.ACADEMICO,
    name: 'Agendamiento',
    description: 'Permite gestionar el agendamiento académico',
  },
  {
    code: AcademicoPermission.ACADEMICA_EXPORTAR_CSV,
    module: Module.ACADEMICO,
    name: 'Exportar CSV (Académica)',
    description: 'Permite exportar agenda académica a CSV',
  },
  {
    code: AcademicoPermission.ESTADISTICAS,
    module: Module.ACADEMICO,
    name: 'Estadísticas',
    description: 'Permite visualizar estadísticas académicas',
  },
  {
    code: AcademicoPermission.EXPORTAR_STATS_CSV,
    module: Module.ACADEMICO,
    name: 'Exportar Estadísticas CSV',
    description: 'Permite exportar estadísticas a CSV',
  },
  {
    code: AcademicoPermission.LISTA_ADVISORS_VER,
    module: Module.ACADEMICO,
    name: 'Ver Lista Advisors',
    description: 'Permite visualizar la lista de advisors',
  },
  {
    code: AcademicoPermission.ADVISOR_VER_ENLACE,
    module: Module.ACADEMICO,
    name: 'Botón Panel Advisor',
    description: 'Permite visualizar el botón de acceso al Panel Advisor',
  },
  {
    code: AcademicoPermission.AGREGAR,
    module: Module.ACADEMICO,
    name: 'Agregar Advisor',
    description: 'Permite añadir un nuevo advisor al sistema',
  },
  {
    code: AcademicoPermission.ESTADISTICA,
    module: Module.ACADEMICO,
    name: 'Estadística Advisor',
    description: 'Permite visualizar estadísticas de advisors',
  },

  // ========== SERVICIO MODULE ==========
  {
    code: ServicioPermission.WELCOME_CARGAR_EVENTOS,
    module: Module.SERVICIO,
    name: 'Cargar Eventos (Welcome)',
    description: 'Permite cargar eventos de welcome session',
  },
  {
    code: ServicioPermission.WELCOME_EXPORTAR_CSV,
    module: Module.SERVICIO,
    name: 'Exportar CSV (Welcome)',
    description: 'Permite exportar welcome sessions a CSV',
  },
  {
    code: ServicioPermission.SESIONES_CARGAR_EVENTOS,
    module: Module.SERVICIO,
    name: 'Cargar Eventos (Sesiones)',
    description: 'Permite cargar eventos de sesiones',
  },
  {
    code: ServicioPermission.SESIONES_EXPORTAR_CSV,
    module: Module.SERVICIO,
    name: 'Exportar CSV (Sesiones)',
    description: 'Permite exportar lista de sesiones a CSV',
  },
  {
    code: ServicioPermission.USUARIOS_ACTUALIZAR,
    module: Module.SERVICIO,
    name: 'Actualizar',
    description: 'Permite actualizar la lista de usuarios sin perfil',
  },
  {
    code: ServicioPermission.USUARIOS_EXPORTAR_CSV,
    module: Module.SERVICIO,
    name: 'Exportar CSV (Usuarios)',
    description: 'Permite exportar usuarios sin perfil a CSV',
  },

  // ========== COMERCIAL MODULE ==========
  {
    code: ComercialPermission.MODIFICAR,
    module: Module.COMERCIAL,
    name: 'Modificar Contrato',
    description: 'Permite modificar un contrato',
  },
  {
    code: ComercialPermission.ENVIAR_PDF,
    module: Module.COMERCIAL,
    name: 'Enviar PDF',
    description: 'Permite enviar el contrato en formato PDF',
  },
  {
    code: ComercialPermission.DESCARGAR,
    module: Module.COMERCIAL,
    name: 'Descargar Contrato',
    description: 'Permite descargar el contrato generado',
  },
  {
    code: ComercialPermission.APROBACION_AUTONOMA,
    module: Module.COMERCIAL,
    name: 'Aprobación Autónoma',
    description: 'Permite aprobar el contrato de forma autónoma',
  },
  {
    code: ComercialPermission.VER_PROSPECTOS,
    module: Module.COMERCIAL,
    name: 'Ver Prospectos',
    description: 'Permite visualizar y gestionar prospectos',
  },

  // ========== APROBACION MODULE ==========
  {
    code: AprobacionPermission.ACTUALIZAR,
    module: Module.APROBACION,
    name: 'Actualizar',
    description: 'Permite actualizar la lista de contratos pendientes',
  },
  {
    code: AprobacionPermission.EXPORTAR_CSV,
    module: Module.APROBACION,
    name: 'Exportar CSV',
    description: 'Permite exportar contratos pendientes a CSV',
  },
  {
    code: AprobacionPermission.MODIFICAR,
    module: Module.APROBACION,
    name: 'Modificar Contrato',
    description: 'Permite modificar un contrato pendiente de aprobación',
  },
  {
    code: AprobacionPermission.ENVIAR_PDF,
    module: Module.APROBACION,
    name: 'Enviar PDF',
    description: 'Permite enviar el contrato en formato PDF',
  },
  {
    code: AprobacionPermission.DESCARGAR,
    module: Module.APROBACION,
    name: 'Descargar Contrato',
    description: 'Permite descargar el contrato pendiente',
  },
  {
    code: AprobacionPermission.APROBACION_AUTONOMA,
    module: Module.APROBACION,
    name: 'Aprobación Autónoma',
    description: 'Permite aprobar el contrato de forma autónoma',
  },
];

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Obtiene todos los permisos de un módulo específico
 */
export function getPermissionsByModule(module: Module): PermissionDefinition[] {
  return PERMISSIONS_CATALOG.filter((p) => p.module === module);
}

/**
 * Obtiene la definición de un permiso por su código
 */
export function getPermissionByCode(code: Permission): PermissionDefinition | undefined {
  return PERMISSIONS_CATALOG.find((p) => p.code === code);
}

/**
 * Obtiene todos los códigos de permisos disponibles
 */
export function getAllPermissionCodes(): Permission[] {
  return PERMISSIONS_CATALOG.map((p) => p.code);
}
