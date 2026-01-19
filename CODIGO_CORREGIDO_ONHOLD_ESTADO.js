// ============================================================================
// FUNCIÓN CORREGIDA: toggleUserStatus
// ============================================================================
// Archivo: backend/search.jsw
// Línea: ~1301
//
// CAMBIOS:
// - Agregar: updateData.estado = "On Hold" al activar OnHold
// - Agregar: updateData.estado = null al desactivar OnHold
// ============================================================================

export async function toggleUserStatus(userId, setInactive, fechaOnHold = null, fechaFinOnHold = null, motivo = null) {
    try {
        if (!userId) {
            return {
                success: false,
                error: 'ID de usuario requerido'
            };
        }

        const estadoNuevo = setInactive === true || setInactive === 'true';
        console.log(`=== Toggle estado de usuario: ${userId} a ${estadoNuevo ? 'INACTIVO' : 'ACTIVO'} ===`);

        // 1. Obtener los datos del usuario
        const usuario = await wixData.get("PEOPLE", userId);
        if (!usuario) {
            return {
                success: false,
                error: 'Usuario no encontrado en PEOPLE'
            };
        }

        console.log('Usuario:', usuario.primerNombre, usuario.primerApellido, '- Estado actual:', usuario.estadoInactivo);

        // 2. Preparar datos de actualización
        const updateData = {
            ...usuario,
            estadoInactivo: estadoNuevo
        };

        // Si se activa OnHold, guardar las fechas y actualizar historial
        if (estadoNuevo && fechaOnHold) {
            updateData.fechaOnHold = fechaOnHold;
            updateData.fechaFinOnHold = fechaFinOnHold;
            updateData.estado = "On Hold";  // ← LÍNEA AGREGADA
            console.log('Guardando fechas OnHold:', { fechaOnHold, fechaFinOnHold, motivo });

            // Crear entrada en el historial
            const nuevaEntradaOnHold = {
                fechaActivacion: new Date().toISOString(),
                fechaOnHold: fechaOnHold,
                fechaFinOnHold: fechaFinOnHold,
                motivo: motivo || 'Sin motivo especificado',
                activadoPor: 'Admin' // Puedes pasar el usuario que lo activó si está disponible
            };

            // Inicializar arrays si no existen
            if (!updateData.onHoldHistory) {
                updateData.onHoldHistory = [];
            }

            // Agregar nueva entrada al inicio del historial
            updateData.onHoldHistory = [nuevaEntradaOnHold, ...updateData.onHoldHistory];

            // Incrementar contador
            updateData.onHoldCount = (updateData.onHoldCount || 0) + 1;

            console.log('Historial OnHold actualizado:', updateData.onHoldHistory);
            console.log('Contador OnHold:', updateData.onHoldCount);
        } else if (!estadoNuevo) {
            // Si se desactiva OnHold, limpiar las fechas
            updateData.fechaOnHold = null;
            updateData.fechaFinOnHold = null;
            updateData.estado = null;  // ← LÍNEA AGREGADA
            console.log('Limpiando fechas OnHold');
        }

        // 3. Actualizar el estado en PEOPLE
        const usuarioActualizado = await wixData.update('PEOPLE', updateData);

        console.log(`Usuario marcado como ${estadoNuevo ? 'inactivo' : 'activo'} en PEOPLE: ${userId}`);

        // 3. Buscar y actualizar registros relacionados en ACADEMICA
        const registrosAcademicos = await wixData.query('ACADEMICA')
            .eq('usuarioId', userId)
            .limit(1000)
            .find();

        let registrosActualizados = 0;
        if (registrosAcademicos.items.length > 0) {
            console.log(`Encontrados ${registrosAcademicos.items.length} registros académicos asociados`);

            // Actualizar cada registro académico
            for (const registro of registrosAcademicos.items) {
                try {
                    const registroActualizado = await wixData.update('ACADEMICA', {
                        ...registro,
                        estadoInactivo: estadoNuevo
                    });
                    registrosActualizados++;
                    console.log(`Registro académico ${registro._id} actualizado`);
                } catch (error) {
                    console.error(`Error al actualizar registro académico ${registro._id}:`, error);
                }
            }
        }

        return {
            success: true,
            message: `Usuario ${estadoNuevo ? 'inactivado' : 'activado'} exitosamente`,
            updatedUser: {
                _id: userId,
                nombreCompleto: `${usuario.primerNombre} ${usuario.primerApellido}`,
                numeroId: usuario.numeroId,
                tipoUsuario: usuario.tipoUsuario,
                registrosAcademicosActualizados: registrosActualizados,
                estado: estadoNuevo && fechaOnHold ? "On Hold" : null  // Incluir estado en respuesta
            }
        };

    } catch (error) {
        console.error('Error al cambiar estado del usuario:', error);
        return {
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        };
    }
}

// ============================================================================
// RESUMEN DE CAMBIOS
// ============================================================================
//
// 1. Línea ~1334 (dentro del bloque if (estadoNuevo && fechaOnHold)):
//    AGREGAR: updateData.estado = "On Hold";
//
// 2. Línea ~1362 (dentro del bloque else if (!estadoNuevo)):
//    AGREGAR: updateData.estado = null;
//
// ============================================================================
// RESULTADO ESPERADO
// ============================================================================
//
// Al ACTIVAR OnHold:
// {
//   estadoInactivo: true,
//   estado: "On Hold",         // ← AHORA SE ACTUALIZA
//   fechaOnHold: "2025-07-01",
//   fechaFinOnHold: "2025-07-31",
//   onHoldCount: 1,
//   onHoldHistory: [...]
// }
//
// Al DESACTIVAR OnHold:
// {
//   estadoInactivo: false,
//   estado: null,              // ← AHORA SE LIMPIA
//   fechaOnHold: null,
//   fechaFinOnHold: null,
//   finalContrato: extendido,
//   vigencia: recalculado,
//   extensionCount: 1,
//   extensionHistory: [...]
// }
//
// ============================================================================
