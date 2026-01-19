// ============================================================================
// FUNCIÓN MODIFICADA: updateClassRecord con Promoción Automática
// ============================================================================
//
// CAMBIOS PRINCIPALES:
// 1. Guarda asistencia y participacion en BOOKING (no solo noAprobo)
// 2. Detecta automáticamente si un step fue completado
// 3. Promueve automáticamente al siguiente step cuando se complete
//
// UBICACIÓN: src/backend/FUNCIONES WIX/search.jsw
// LÍNEA: 4533
// ============================================================================

export async function updateClassRecord(data) {
    try {
        console.log('📝 Actualizando registro de clase:', {
            idEstudiante: data.idEstudiante,
            idEvento: data.idEvento
        });

        // ============================================================
        // 1. ACTUALIZAR REGISTRO EN CLASSES
        // ============================================================

        const existingQuery = await wixData.query('CLASSES')
            .eq('idEstudiante', data.idEstudiante)
            .eq('idEvento', data.idEvento)
            .find();

        let classRecord;

        if (existingQuery.items.length > 0) {
            // Actualizar registro existente
            const existing = existingQuery.items[0];
            const updateData = {
                ...existing,
                _updatedDate: new Date()
            };

            // Actualizar campos si vienen en data
            if (data.asistencia !== undefined && data.asistencia !== null) updateData.asistencia = data.asistencia;
            if (data.participacion !== undefined && data.participacion !== null) updateData.participacion = data.participacion;
            if (data.noAprobo !== undefined && data.noAprobo !== null) updateData.noAprobo = data.noAprobo;
            if (data.calificacion !== undefined && data.calificacion !== null && data.calificacion !== '') updateData.calificacion = data.calificacion;
            if (data.comentarios !== undefined && data.comentarios !== null && data.comentarios !== '') updateData.comentarios = data.comentarios;
            if (data.advisorAnotaciones !== undefined && data.advisorAnotaciones !== null && data.advisorAnotaciones !== '') updateData.advisorAnotaciones = data.advisorAnotaciones;
            if (data.actividadPropuesta !== undefined && data.actividadPropuesta !== null && data.actividadPropuesta !== '') updateData.actividadPropuesta = data.actividadPropuesta;

            classRecord = await wixData.update('CLASSES', updateData);
            console.log('✅ Registro CLASSES actualizado:', classRecord._id);
        } else {
            // Crear nuevo registro
            classRecord = await wixData.insert('CLASSES', {
                idEstudiante: data.idEstudiante,
                idEvento: data.idEvento,
                asistencia: data.asistencia || false,
                participacion: data.participacion || false,
                noAprobo: data.noAprobo || false,
                calificacion: data.calificacion || '',
                comentarios: data.comentarios || '',
                advisorAnotaciones: data.advisorAnotaciones || '',
                actividadPropuesta: data.actividadPropuesta || '',
                _createdDate: new Date()
            });
            console.log('✅ Nuevo registro creado en CLASSES:', classRecord._id);
        }

        // ============================================================
        // 2. ACTUALIZAR REGISTRO EN BOOKING (NUEVO: incluye asistencia y participacion)
        // ============================================================

        const bookingQuery = await wixData.query('BOOKING')
            .eq('idEstudiante', data.idEstudiante)
            .eq('idEvento', data.idEvento)
            .find();

        if (bookingQuery.items.length > 0) {
            const bookingRecord = bookingQuery.items[0];

            // ⭐ NUEVO: Actualizar también asistencia y participacion en BOOKING
            const bookingUpdateData = {
                ...bookingRecord,
                _updatedDate: new Date()
            };

            if (data.asistencia !== undefined && data.asistencia !== null) bookingUpdateData.asistencia = data.asistencia;
            if (data.participacion !== undefined && data.participacion !== null) bookingUpdateData.participacion = data.participacion;
            if (data.noAprobo !== undefined && data.noAprobo !== null) bookingUpdateData.noAprobo = data.noAprobo;

            await wixData.update('BOOKING', bookingUpdateData);
            console.log('✅ Registro BOOKING actualizado (asistencia, participacion, noAprobo):', bookingRecord._id);
        }

        // ============================================================
        // 3. ACTUALIZAR NIVEL Y STEP EN ACADEMICA (si viene en data)
        // ============================================================

        if ((data.nivel !== undefined && data.nivel !== null && data.nivel !== '') ||
            (data.step !== undefined && data.step !== null && data.step !== '')) {

            console.log('📝 Actualizando nivel/step en ACADEMICA para estudiante:', data.idEstudiante);

            const academicaQuery = await wixData.query('ACADEMICA')
                .eq('_id', data.idEstudiante)
                .find();

            if (academicaQuery.items.length > 0) {
                const academicaRecord = academicaQuery.items[0];
                const academicaUpdateData = {
                    ...academicaRecord,
                    _updatedDate: new Date()
                };

                if (data.nivel !== undefined && data.nivel !== null && data.nivel !== '') {
                    academicaUpdateData.nivel = data.nivel;
                }
                if (data.step !== undefined && data.step !== null && data.step !== '') {
                    academicaUpdateData.step = data.step;
                }

                await wixData.update('ACADEMICA', academicaUpdateData);
                console.log('✅ Registro ACADEMICA actualizado - nivel:', data.nivel, 'step:', data.step);
            }
        }

        // ============================================================
        // 4. ⭐ NUEVA LÓGICA: DETECTAR Y PROMOVER SI STEP COMPLETADO
        // ============================================================

        // Obtener información del estudiante y su nivel actual
        const studentQuery = await wixData.query('ACADEMICA')
            .eq('_id', data.idEstudiante)
            .find();

        if (studentQuery.items.length === 0) {
            console.log('⚠️ No se encontró estudiante en ACADEMICA');
            return {
                success: true,
                record: classRecord
            };
        }

        const student = studentQuery.items[0];
        const currentNivel = student.nivel;
        const currentStep = student.step;

        console.log(`🔍 Verificando si step completado - Estudiante: ${student.primerNombre} ${student.primerApellido}, Nivel: ${currentNivel}, Step: ${currentStep}`);

        // Verificar si el step actual fue completado con esta actualización
        const stepCompletado = await verificarStepCompletado(data.idEstudiante, currentNivel, currentStep);

        if (stepCompletado) {
            console.log(`🎉 ¡Step ${currentStep} completado! Iniciando promoción automática...`);

            // Obtener el siguiente step
            const siguienteStepInfo = await obtenerSiguienteStep(currentNivel, currentStep);

            if (siguienteStepInfo.success) {
                console.log(`➡️ Promoviendo a: ${siguienteStepInfo.nuevoNivel} - ${siguienteStepInfo.nuevoStep}`);

                // Promover al siguiente step
                const promocionResult = await promoverAStep(
                    student.numeroId,
                    siguienteStepInfo.nuevoNivel,
                    siguienteStepInfo.nuevoStep,
                    siguienteStepInfo.esParalelo
                );

                if (promocionResult.success) {
                    console.log(`✅ Promoción automática exitosa: ${currentStep} → ${siguienteStepInfo.nuevoStep}`);
                } else {
                    console.log(`⚠️ Error en promoción automática: ${promocionResult.error}`);
                }
            } else {
                console.log(`ℹ️ No hay siguiente step (${siguienteStepInfo.message})`);
            }
        } else {
            console.log(`📊 Step ${currentStep} aún no completado`);
        }

        return {
            success: true,
            record: classRecord,
            stepCompletado: stepCompletado,
            promocionRealizada: stepCompletado
        };

    } catch (error) {
        console.error('❌ Error actualizando registro de clase:', error);
        return {
            success: false,
            error: 'Error actualizando registro de clase',
            details: error.message
        };
    }
}

// ============================================================================
// FUNCIONES AUXILIARES PARA PROMOCIÓN AUTOMÁTICA
// ============================================================================

/**
 * Verifica si un step específico está completado
 */
async function verificarStepCompletado(idEstudiante, nivel, step) {
    try {
        console.log(`🔍 Verificando completitud de step: ${step} en nivel: ${nivel}`);

        // Jump steps
        const JUMP_STEPS = [5, 10, 15, 20, 25, 30, 35, 40, 45];
        const stepNumber = parseInt(step.match(/\d+/)?.[0] || 0);
        const isJumpStep = JUMP_STEPS.includes(stepNumber);

        // Obtener todas las clases del estudiante en ese nivel y step
        const bookingQuery = await wixData.query('BOOKING')
            .eq('idEstudiante', idEstudiante)
            .eq('nivel', nivel)
            .eq('step', step)
            .find();

        const bookings = bookingQuery.items || [];

        // Obtener datos de asistencia desde CLASSES
        const classesQuery = await wixData.query('CLASSES')
            .eq('idEstudiante', idEstudiante)
            .find();

        const classesData = classesQuery.items || [];

        // Crear mapa de asistencia por idEvento
        const asistenciaByEvento = {};
        classesData.forEach(clase => {
            if (clase.idEvento) {
                asistenciaByEvento[clase.idEvento] = {
                    asistencia: clase.asistencia,
                    participacion: clase.participacion,
                    noAprobo: clase.noAprobo
                };
            }
        });

        // Analizar clases
        let sesionesExitosas = 0;
        let clubExitoso = false;
        let hayClases = false;
        let noAproboEnJump = false;

        bookings.forEach(booking => {
            hayClases = true;
            const asistenciaData = asistenciaByEvento[booking.idEvento];

            // Usar datos de BOOKING si existen, sino de CLASSES
            const asistencia = booking.asistencia || asistenciaData?.asistencia || false;
            const participacion = booking.participacion || asistenciaData?.participacion || false;
            const noAprobo = booking.noAprobo || asistenciaData?.noAprobo || false;

            if (booking.tipoEvento === 'CLUB') {
                // Es un club TRAINING del step
                if (asistencia || participacion) {
                    clubExitoso = true;
                }
            } else {
                // Es una sesión
                if (asistencia || participacion) {
                    sesionesExitosas++;
                }
            }

            // Para Jump Steps, verificar si noAprobo es true
            if (isJumpStep && noAprobo) {
                noAproboEnJump = true;
            }
        });

        // Determinar si está completado
        let completado = false;

        if (isJumpStep) {
            // Jump steps: necesitan al menos una clase Y noAprobo debe ser false
            completado = hayClases && !noAproboEnJump;
            console.log(`🔍 Jump Step ${step}: hayClases=${hayClases}, noAprobo=${noAproboEnJump}, completado=${completado}`);
        } else {
            // Steps normales: necesitan 2 sesiones + 1 club
            completado = sesionesExitosas >= 2 && clubExitoso;
            console.log(`🔍 Step normal ${step}: sesiones=${sesionesExitosas}/2, club=${clubExitoso}, completado=${completado}`);
        }

        return completado;

    } catch (error) {
        console.error('❌ Error verificando step completado:', error);
        return false;
    }
}

/**
 * Obtiene el siguiente step en secuencia
 */
async function obtenerSiguienteStep(nivelActual, stepActual) {
    try {
        // Obtener todos los steps del nivel actual ordenados
        const nivelesQuery = await wixData.query('NIVELES')
            .eq('code', nivelActual)
            .ascending('step')
            .limit(1000)
            .find();

        const steps = nivelesQuery.items;

        if (steps.length === 0) {
            return {
                success: false,
                message: 'No se encontraron steps para el nivel actual'
            };
        }

        // Buscar índice del step actual
        const currentIndex = steps.findIndex(item => item.step === stepActual);

        if (currentIndex === -1) {
            return {
                success: false,
                message: 'Step actual no encontrado en NIVELES'
            };
        }

        // Verificar si hay un siguiente step en el mismo nivel
        if (currentIndex < steps.length - 1) {
            // Hay siguiente step en el mismo nivel
            const siguienteStep = steps[currentIndex + 1];
            return {
                success: true,
                nuevoNivel: nivelActual,
                nuevoStep: siguienteStep.step,
                esParalelo: siguienteStep.esParalelo || false
            };
        } else {
            // Es el último step del nivel - buscar siguiente nivel
            const siguienteNivel = await obtenerSiguienteNivel(nivelActual);

            if (siguienteNivel.success) {
                return {
                    success: true,
                    nuevoNivel: siguienteNivel.codigo,
                    nuevoStep: siguienteNivel.primerStep,
                    esParalelo: siguienteNivel.esParalelo || false
                };
            } else {
                return {
                    success: false,
                    message: 'Completó el último step del nivel y no hay siguiente nivel'
                };
            }
        }

    } catch (error) {
        console.error('❌ Error obteniendo siguiente step:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Obtiene el siguiente nivel en secuencia
 */
async function obtenerSiguienteNivel(nivelActual) {
    try {
        // Orden de niveles (puede ajustarse según tu estructura)
        const ordenNiveles = [
            'WELCOME',
            'BN1', 'BN2', 'BN3',
            'IN1', 'IN2', 'IN3',
            'IU1', 'IU2', 'IU3',
            'AU1', 'AU2', 'AU3'
        ];

        const currentIndex = ordenNiveles.indexOf(nivelActual);

        if (currentIndex === -1) {
            return {
                success: false,
                message: 'Nivel actual no encontrado en secuencia'
            };
        }

        if (currentIndex >= ordenNiveles.length - 1) {
            return {
                success: false,
                message: 'Ya está en el último nivel'
            };
        }

        const siguienteNivelCode = ordenNiveles[currentIndex + 1];

        // Obtener primer step del siguiente nivel
        const nivelesQuery = await wixData.query('NIVELES')
            .eq('code', siguienteNivelCode)
            .ascending('step')
            .limit(1)
            .find();

        if (nivelesQuery.items.length === 0) {
            return {
                success: false,
                message: 'No se encontró el siguiente nivel'
            };
        }

        const primerStepDelNivel = nivelesQuery.items[0];

        return {
            success: true,
            codigo: siguienteNivelCode,
            primerStep: primerStepDelNivel.step,
            esParalelo: primerStepDelNivel.esParalelo || false
        };

    } catch (error) {
        console.error('❌ Error obteniendo siguiente nivel:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Promueve al estudiante a un nuevo step
 */
async function promoverAStep(numeroId, nuevoNivel, nuevoStep, esParalelo = false) {
    try {
        console.log(`🎯 Promoción automática: numeroId=${numeroId}, nivel=${nuevoNivel}, step=${nuevoStep}, esParalelo=${esParalelo}`);

        // Actualizar ACADEMICA
        const academicaQuery = await wixData.query('ACADEMICA')
            .eq('numeroId', numeroId)
            .limit(1000)
            .find();

        if (academicaQuery.items.length === 0) {
            return {
                success: false,
                error: 'Estudiante no encontrado en ACADEMICA'
            };
        }

        const academicaRecord = academicaQuery.items[0];

        if (esParalelo) {
            academicaRecord.nivelParalelo = nuevoNivel;
            academicaRecord.stepParalelo = nuevoStep;
        } else {
            academicaRecord.nivel = nuevoNivel;
            academicaRecord.step = nuevoStep;
        }

        // Actualizar essentialDate
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        academicaRecord.essentialDate = `${year}-${month}-${day}`;

        await wixData.update('ACADEMICA', academicaRecord);
        console.log('✅ ACADEMICA actualizado');

        // Actualizar PEOPLE
        const userId = academicaRecord.usuarioId;
        if (userId) {
            const peopleQuery = await wixData.query('PEOPLE')
                .eq('_id', userId)
                .limit(1000)
                .find();

            if (peopleQuery.items.length > 0) {
                const peopleRecord = peopleQuery.items[0];

                if (esParalelo) {
                    peopleRecord.nivelParalelo = nuevoNivel;
                    peopleRecord.stepParalelo = nuevoStep;
                } else {
                    peopleRecord.nivel = nuevoNivel;
                    peopleRecord.step = nuevoStep;
                }

                await wixData.update('PEOPLE', peopleRecord);
                console.log('✅ PEOPLE actualizado');
            }
        }

        return {
            success: true,
            nuevoNivel,
            nuevoStep
        };

    } catch (error) {
        console.error('❌ Error promoviendo estudiante:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
