// ============================================================================
// CÓDIGO MODIFICADO PARA ESS PARALELO
// Fecha: 31 de octubre de 2025
// Archivo: backend/FUNCIONES WIX/search.jsw
// ============================================================================

// IMPORTANTE: Antes de aplicar estos cambios, agregar los siguientes campos en Wix:
//
// NIVELES:
//   - esParalelo (Boolean, default: false)
//   - Marcar ESS con esParalelo: true
//
// ACADEMICA:
//   - nivelParalelo (Text, opcional)
//   - stepParalelo (Text, opcional)
//
// PEOPLE:
//   - nivelParalelo (Text, opcional)
//   - stepParalelo (Text, opcional)

// ============================================================================
// FUNCIÓN 1: updateStudentStep
// Ubicación original: search.jsw líneas 2097-2177
// ============================================================================

export async function updateStudentStep(stepData) {
    try {
        console.log('🎯 Actualizando step del estudiante:', stepData);

        const { numeroId, newStep } = stepData;
        const nuevoStep = `Step ${newStep}`;

        // 1. Buscar el nivel asociado al nuevoStep en NIVELES
        const nivelesResult = await wixData.query("NIVELES")
            .eq("step", nuevoStep)
            .limit(1000)
            .find();

        if (nivelesResult.items.length === 0) {
            return {
                success: false,
                error: `No se encontró un nivel asociado al step: ${nuevoStep}`
            };
        }

        const nivelData = nivelesResult.items[0];
        const nuevoNivel = nivelData.code;
        const esParalelo = nivelData.esParalelo || false; // ← NUEVO: Detectar si es nivel paralelo

        console.log(`✅ Nuevo nivel obtenido desde NIVELES: ${nuevoNivel}`);
        console.log(`📌 Es nivel paralelo: ${esParalelo}`);

        // 2. Actualizar en ACADEMICA
        const academicaResult = await wixData.query("ACADEMICA")
            .eq("numeroId", numeroId)
            .limit(1000)
            .find();

        if (academicaResult.items.length === 0) {
            return {
                success: false,
                error: "No se encontró el estudiante en ACADEMICA"
            };
        }

        const academicaItem = academicaResult.items[0];
        const stepAnterior = esParalelo ? (academicaItem.stepParalelo || 'Sin step paralelo') : academicaItem.step;
        const nivelAnterior = esParalelo ? (academicaItem.nivelParalelo || 'Sin nivel paralelo') : academicaItem.nivel;

        // ← NUEVA LÓGICA: Si es nivel paralelo, actualizar campos paralelos
        if (esParalelo) {
            academicaItem.nivelParalelo = nuevoNivel;
            academicaItem.stepParalelo = nuevoStep;
            console.log("✅ Actualizado nivel PARALELO en ACADEMICA:", nuevoNivel, nuevoStep);
            console.log(`   → Nivel principal se mantiene: ${academicaItem.nivel}`);
        } else {
            // Si NO es paralelo, actualizar campos principales (comportamiento original)
            academicaItem.step = nuevoStep;
            academicaItem.nivel = nuevoNivel;
            console.log("✅ Actualizado nivel PRINCIPAL en ACADEMICA:", nuevoNivel, nuevoStep);
        }

        await wixData.update("ACADEMICA", academicaItem);

        // 3. Actualizar en PEOPLE usando usuarioId = _id de ACADEMICA
        const userId = academicaItem.usuarioId;
        if (userId) {
            const peopleResult = await wixData.query("PEOPLE")
                .eq("_id", userId)
                .limit(1000)
                .find();

            if (peopleResult.items.length > 0) {
                const peopleItem = peopleResult.items[0];

                // ← NUEVA LÓGICA: Actualizar campos paralelos o principales en PEOPLE
                if (esParalelo) {
                    peopleItem.nivelParalelo = nuevoNivel;
                    peopleItem.stepParalelo = nuevoStep;
                    console.log("✅ Actualizado nivel PARALELO en PEOPLE:", nuevoNivel, nuevoStep);
                } else {
                    peopleItem.step = nuevoStep;
                    peopleItem.nivel = nuevoNivel;
                    console.log("✅ Actualizado nivel PRINCIPAL en PEOPLE:", nuevoNivel, nuevoStep);
                }

                await wixData.update("PEOPLE", peopleItem);
            }
        }

        return {
            success: true,
            message: esParalelo
                ? `Nivel paralelo ${nuevoNivel} actualizado exitosamente`
                : 'Step actualizado exitosamente',
            stepAnterior,
            nivelAnterior,
            nuevoStep,
            nuevoNivel,
            esParalelo, // ← NUEVO: Indicar si fue actualización paralela
            studentId: academicaItem._id
        };

    } catch (error) {
        console.error('❌ Error al actualizar step del estudiante:', error);
        return {
            success: false,
            error: 'Error al actualizar step del estudiante',
            details: error.message
        };
    }
}

// ============================================================================
// FUNCIÓN 2: cargarStepsDelNivel
// Ubicación original: search.jsw líneas 2327-2580
// CAMBIO: Agregar flag esParalelo en la respuesta
// ============================================================================

export async function cargarStepsDelNivel(nivel, idAcademica) {
    try {
        console.log('🔍 Cargando steps del nivel:', nivel, 'para estudiante:', idAcademica);

        // 1. Todos los steps posibles de ese nivel
        const result = await wixData.query("NIVELES")
            .eq("code", nivel)
            .ascending("step")
            .limit(1000)
            .find();

        if (result.items.length === 0) {
            console.log('⚠️ No se encontraron steps para el nivel:', nivel);
            return {
                success: false,
                error: `No se encontraron steps para el nivel ${nivel}`
            };
        }

        console.log(`📋 Encontrados ${result.items.length} steps para nivel ${nivel}`);

        // ← NUEVO: Detectar si es nivel paralelo
        const esParalelo = result.items[0]?.esParalelo || false;
        console.log(`📌 Nivel ${nivel} es paralelo: ${esParalelo}`);

        // 2. Obtener información del estudiante
        const studentResult = await wixData.query("ACADEMICA")
            .eq("_id", idAcademica)
            .limit(1000)
            .find();

        if (studentResult.items.length === 0) {
            console.log('⚠️ No se encontró estudiante o numeroId en ACADEMICA');
            return {
                success: false,
                error: 'Estudiante no encontrado'
            };
        }

        const student = studentResult.items[0];
        const numeroId = student.numeroId;

        // 3. Obtener overrides para este estudiante y nivel
        const overridesResult = await wixData.query("STEP_OVERRIDES")
            .eq("idEnAcademica", idAcademica)
            .eq("nivel", nivel)
            .limit(1000)
            .find();

        const overrides = {};
        overridesResult.items.forEach(override => {
            overrides[override.step] = override.isCompleted;
        });

        console.log(`📊 Overrides encontrados: ${overridesResult.items.length}`, overrides);

        // 4. Obtener todas las clases del estudiante para calcular completitud automáticamente
        const bookingResult = await wixData.query('BOOKING')
            .eq('idEstudiante', idAcademica)
            .limit(1000)
            .find();

        const bookings = bookingResult.items || [];
        console.log(`📚 Total de bookings: ${bookings.length}`);

        // Obtener datos de asistencia desde CLASSES
        const classesResult = await wixData.query('CLASSES')
            .eq('idEstudiante', idAcademica)
            .limit(1000)
            .find();

        const classesData = classesResult.items || [];
        console.log(`📊 Total de clases con asistencia: ${classesData.length}`);

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

        // Combinar BOOKING con datos de asistencia de CLASSES
        const combinedClasses = bookings.map(booking => ({
            ...booking,
            asistencia: asistenciaByEvento[booking.idEvento]?.asistencia || false,
            participacion: asistenciaByEvento[booking.idEvento]?.participacion || false,
            noAprobo: booking.noAprobo || asistenciaByEvento[booking.idEvento]?.noAprobo || false
        }));

        // Filtrar solo las clases del nivel actual
        const clasesNivelActual = combinedClasses.filter(c => c.nivel === nivel && c.step !== 'WELCOME');

        // Jump steps (requieren solo que noAprobo sea false)
        const JUMP_STEPS = [5, 10, 15, 20, 25, 30, 35, 40, 45];

        // Construir mapa de asistencia por step
        const asistenciaMap = new Map();
        result.items.forEach(item => {
            asistenciaMap.set(item.step, {
                trueCount: 0,
                falseCount: 0,
                club: false,
                noAprobo: false,
                hasClasses: false  // Rastrear si existen clases para este step
            });
        });

        // Procesar cada clase y actualizar asistenciaMap
        clasesNivelActual.forEach(clase => {
            let stepBase = clase.step;

            // Normalizar step para clubs TRAINING
            if (clase.tipoEvento === 'CLUB' && clase.step && clase.step.includes('TRAINING')) {
                const match = clase.step.match(/Step\s+(\d+)/i);
                if (match) {
                    stepBase = `Step ${match[1]}`;
                }
            }

            if (asistenciaMap.has(stepBase)) {
                const stepInfo = asistenciaMap.get(stepBase);

                // Marcar que este step tiene clases registradas
                stepInfo.hasClasses = true;

                // Contar sesiones exitosas (SESSION y COMPLEMENTARIA)
                if (clase.tipoEvento !== 'CLUB') {
                    if (clase.asistencia === true || clase.participacion === true) {
                        stepInfo.trueCount++;
                    } else {
                        stepInfo.falseCount++;
                    }
                }

                // Detectar TRAINING club exitoso
                if (clase.tipoEvento === 'CLUB') {
                    const esTrainingClub = clase.step && clase.step.includes('TRAINING');
                    const trainingExitoso = clase.asistencia === true || clase.participacion === true;

                    if (esTrainingClub && trainingExitoso) {
                        stepInfo.club = true;
                    }
                }

                // Rastrear noAprobo para Jump Steps
                if (clase.noAprobo === true) {
                    stepInfo.noAprobo = true;
                }
            }
        });

        // 5. Construir la información de cada step con cálculo automático
        const steps = result.items.map(item => {
            const stepInfo = asistenciaMap.get(item.step);
            const hasOverride = overrides[item.step] !== undefined;

            // Detectar si es Jump step
            const stepNumber = parseInt(item.step.match(/\d+/)?.[0] || 0);
            const isJumpStep = JUMP_STEPS.includes(stepNumber);

            // Detectar si es ESS Step 0 (English Speaking Sessions - nivel especial)
            const isESSStep0 = nivel === 'ESS' && item.step === 'Step 0';

            let completado = false;

            // Si hay override manual, usarlo (tiene prioridad)
            if (hasOverride) {
                completado = overrides[item.step];
                console.log(`🔍 Step ${item.step}: OVERRIDE MANUAL = ${completado}`);
            } else if (isESSStep0) {
                // ESS Step 0: Se aprueba automáticamente después de 5 semanas desde _createdDate
                const fechaCreacion = student._createdDate;
                const fechaActual = new Date();
                const diasTranscurridos = Math.floor((fechaActual.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
                const DIAS_REQUERIDOS_ESS = 35; // 5 semanas

                completado = diasTranscurridos >= DIAS_REQUERIDOS_ESS;
                console.log(`🔍 Step ${item.step} (ESS): Fecha creación=${fechaCreacion.toISOString()}, días transcurridos=${diasTranscurridos}/${DIAS_REQUERIDOS_ESS}, completado=${completado}`);
            } else {
                // Calcular automáticamente según el tipo de step
                if (isJumpStep) {
                    // Jump steps: deben tener al menos una clase registrada Y noAprobo debe ser false
                    completado = stepInfo.hasClasses && !stepInfo.noAprobo;
                    console.log(`🔍 Step ${item.step} (JUMP): hasClasses=${stepInfo.hasClasses}, noAprobo=${stepInfo.noAprobo}, completado=${completado}`);
                } else {
                    // Steps normales: necesitan 2 sesiones + club
                    completado = stepInfo.trueCount >= 2 && stepInfo.club;
                    console.log(`🔍 Step ${item.step}: sesiones=${stepInfo.trueCount}/2, club=${stepInfo.club}, completado=${completado}`);
                }
            }

            return {
                _id: item._id,
                step: item.step,
                nivel: item.code,
                checkCompletado: completado
            };
        });

        console.log(`✅ Steps procesados: ${steps.length}`);

        return {
            success: true,
            steps: steps,
            nivel: nivel,
            esParalelo: esParalelo, // ← NUEVO: Indicar si es nivel paralelo
            totalSteps: steps.length
        };

    } catch (error) {
        console.error('❌ Error cargando steps del nivel:', error);
        return {
            success: false,
            error: 'Error cargando steps del nivel',
            details: error.message
        };
    }
}

// ============================================================================
// FUNCIÓN 3: getStudentProgress
// Ubicación original: search.jsw líneas 4896-5198
// CAMBIO: Excluir ESS del diagnóstico "¿Cómo voy?"
// ============================================================================

export async function getStudentProgress(studentId) {
  try {
    console.log('📊 Generando diagnóstico académico DETALLADO para estudiante:', studentId);

    if (!studentId) {
      return {
        success: false,
        error: 'ID de estudiante requerido'
      };
    }

    // 1. Obtener datos básicos del estudiante desde ACADEMICA
    const studentResult = await wixData.query('ACADEMICA')
      .eq('_id', studentId)
      .find();

    if (!studentResult.items || studentResult.items.length === 0) {
      return {
        success: false,
        error: 'No se encontró el estudiante'
      };
    }

    const student = studentResult.items[0];

    // 2. Obtener todas las inscripciones del estudiante desde BOOKING
    const bookingResult = await wixData.query('BOOKING')
      .eq('idEstudiante', studentId)
      .find();

    const bookings = bookingResult.items || [];

    // 3. Obtener datos de asistencia desde CLASSES para cruzar con BOOKING
    const classesResult = await wixData.query('CLASSES')
      .eq('idEstudiante', studentId)
      .find();

    const classesData = classesResult.items || [];

    // 4. Crear mapa de asistencia por idEvento para hacer el JOIN
    const asistenciaByEvento = {};
    classesData.forEach(clase => {
      if (clase.idEvento) {
        asistenciaByEvento[clase.idEvento] = {
          asistencia: clase.asistencia,
          participacion: clase.participacion,
          evaluacion: clase.evaluacion,
          anotacionAdvisor: clase.anotacionAdvisor,
          comentarios: clase.comentarios,
          noAprobo: clase.noAprobo
        };
      }
    });

    // 5. Combinar BOOKING con datos de asistencia de CLASSES
    const classes = bookings.map(booking => ({
      ...booking,
      asistencia: asistenciaByEvento[booking.idEvento]?.asistencia || false,
      participacion: asistenciaByEvento[booking.idEvento]?.participacion || false,
      evaluacion: asistenciaByEvento[booking.idEvento]?.evaluacion || null,
      anotacionAdvisor: asistenciaByEvento[booking.idEvento]?.anotacionAdvisor || null,
      comentarios: asistenciaByEvento[booking.idEvento]?.comentarios || null,
      noAprobo: booking.noAprobo || asistenciaByEvento[booking.idEvento]?.noAprobo || false
    }));

    console.log(`✅ Estudiante: ${student.primerNombre} ${student.primerApellido}`);
    console.log(`📚 Total de bookings: ${bookings.length}`);
    console.log(`📊 Total de clases con asistencia: ${classesData.length}`);

    // ← NUEVA LÓGICA: Usar nivel PRINCIPAL para el diagnóstico, ignorar ESS
    const nivelPrincipal = student.nivel;
    console.log(`📘 Nivel PRINCIPAL para diagnóstico: ${nivelPrincipal}`);

    // Si el estudiante tiene nivel paralelo, informarlo
    if (student.nivelParalelo) {
      console.log(`📗 Nivel PARALELO (no incluido en diagnóstico): ${student.nivelParalelo}`);
    }

    // 6. Obtener steps del nivel PRINCIPAL (no paralelo)
    const nivelesResult = await wixData.query('NIVELES')
      .eq('code', nivelPrincipal)
      .ascending('step')
      .find();

    const steps = nivelesResult.items.map(item => item.step);
    console.log(`🎯 Steps del nivel ${nivelPrincipal}:`, steps);

    // 7. Obtener step overrides del estudiante
    const overridesResult = await wixData.query('STEP_OVERRIDES')
      .eq('idEnAcademica', studentId)
      .find();

    const stepsOverride = new Set(overridesResult.items.map(item => item.step));
    console.log(`📝 Step overrides encontrados:`, Array.from(stepsOverride));

    // 8. Construir mapa de asistencia por step
    const JUMP_STEPS = [5, 10, 15, 20, 25, 30, 35, 40, 45];
    const asistenciaMap = new Map();

    steps.forEach(step => {
      asistenciaMap.set(step, {
        trueCount: 0,
        falseCount: 0,
        complementaria: false,
        club: false,
        advisor: 'Sin asignar',
        noAprobo: false
      });
    });

    // ← NUEVA LÓGICA: Filtrar clases del nivel PRINCIPAL, EXCLUIR ESS y WELCOME
    const clasesNivelActual = classes.filter(c =>
      c.nivel === nivelPrincipal &&
      c.step !== 'WELCOME' &&
      c.nivel !== 'ESS'  // ← NUEVO: Excluir ESS explícitamente
    );

    console.log(`📊 Clases filtradas para diagnóstico (nivel ${nivelPrincipal}, sin ESS): ${clasesNivelActual.length}`);

    // Cargar nombres de advisors
    const uniqueAdvisorIds = [...new Set(clasesNivelActual.map(c => c.advisor).filter(Boolean))];
    const advisorNamesMap = {};

    if (uniqueAdvisorIds.length > 0) {
      const advisorResults = await wixData.query('ADVISORS')
        .hasSome('_id', uniqueAdvisorIds)
        .find();

      advisorResults.items.forEach(advisor => {
        advisorNamesMap[advisor._id] = `${advisor.primerNombre} ${advisor.primerApellido}`;
      });
    }

    // Procesar cada clase y actualizar asistenciaMap
    clasesNivelActual.forEach(clase => {
      let stepBase = clase.step;

      // Normalizar step para clubs TRAINING
      if (clase.tipoEvento === 'CLUB' && clase.step && clase.step.includes('TRAINING')) {
        const match = clase.step.match(/Step\s+(\d+)/i);
        if (match) {
          stepBase = `Step ${match[1]}`;
        }
      }

      if (asistenciaMap.has(stepBase)) {
        const stepInfo = asistenciaMap.get(stepBase);

        // Contar sesiones exitosas (SESSION y COMPLEMENTARIA)
        if (clase.tipoEvento !== 'CLUB') {
          if (clase.asistencia === true || clase.asistencia === 'Sí' ||
              clase.participacion === true || clase.participacion === 'Sí') {
            stepInfo.trueCount++;
          } else {
            stepInfo.falseCount++;
          }
        }

        // Marcar si tiene COMPLEMENTARIA
        if (clase.tipoEvento === 'COMPLEMENTARIA') {
          stepInfo.complementaria = true;
        }

        // Detectar TRAINING club exitoso
        if (clase.tipoEvento === 'CLUB') {
          const esTrainingClub = clase.step && clase.step.includes('TRAINING');
          const trainingExitoso = clase.asistencia === true || clase.asistencia === 'Sí' ||
                                  clase.participacion === true || clase.participacion === 'Sí';

          if (esTrainingClub && trainingExitoso) {
            stepInfo.club = true;
          }
        }

        // Rastrear noAprobo para Jump Steps
        if (clase.noAprobo === true) {
          stepInfo.noAprobo = true;
        }

        // Guardar advisor del step
        if (clase.advisor && advisorNamesMap[clase.advisor]) {
          stepInfo.advisor = advisorNamesMap[clase.advisor];
        }
      }
    });

    // 10. Generar diagnóstico detallado por step (solo nivel principal)
    const diagnosticoPorStep = generarDiagnosticoDetallado(
      steps,
      asistenciaMap,
      studentId,
      nivelPrincipal, // ← Usar nivel principal
      stepsOverride,
      student.primerNombre,
      student.primerApellido,
      student.numeroId
    );

    // 11. Calcular estadísticas generales (incluye TODAS las clases, incluyendo ESS para tracking)
    const totalClases = classes.length;
    const clasesAsistidas = classes.filter(c => c.asistencia === true || c.asistencia === 'Sí').length;
    const clasesConParticipacion = classes.filter(c => c.participacion === true || c.participacion === 'Sí').length;

    const porcentajeAsistencia = totalClases > 0 ? Math.round((clasesAsistidas / totalClases) * 100) : 0;
    const porcentajeParticipacion = totalClases > 0 ? Math.round((clasesConParticipacion / totalClases) * 100) : 0;

    // Calcular steps completados (solo del nivel principal)
    let stepsCompletados = 0;
    steps.forEach(step => {
      const stepInfo = asistenciaMap.get(step);
      const hasOverride = stepsOverride.has(step);
      const stepNumber = parseInt(step.match(/\d+/)?.[0] || 0);
      const isJumpStep = JUMP_STEPS.includes(stepNumber);

      if (hasOverride || esStepCompletadoFunc(stepInfo, isJumpStep)) {
        stepsCompletados++;
      }
    });

    const porcentajeAvance = steps.length > 0 ? ((stepsCompletados / steps.length) * 100).toFixed(2) : 0;

    // Distribución por tipo de evento (todas las clases)
    const tiposEvento = {};
    classes.forEach(c => {
      const tipo = c.tipoEvento || 'Sin tipo';
      tiposEvento[tipo] = (tiposEvento[tipo] || 0) + 1;
    });

    // 12. Formatear todas las clases para la tabla (incluye ESS para tracking)
    const todasLasClases = classes.map(c => ({
      fecha: c.fechaEvento ? new Date(c.fechaEvento).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Sin fecha',
      tipo: c.tipoEvento || 'Sin tipo',
      nivel: c.nivel || '-',
      step: c.step || '-',
      asistio: c.asistencia === true || c.asistencia === 'Sí',
      participo: c.participacion === true || c.participacion === 'Sí',
      noAprobo: c.noAprobo === true,
      advisor: c.advisor ? (advisorNamesMap[c.advisor] || 'No encontrado') : 'Sin advisor',
      linkZoom: c.linkZoom || null
    }));

    // 13. Datos del estudiante (mostrar nivel principal y paralelo si existe)
    const estudiante = {
      nombre: `${student.primerNombre || ''} ${student.primerApellido || ''}`.trim(),
      nivel: nivelPrincipal, // ← Nivel principal
      step: student.step || 'Sin step',
      nivelParalelo: student.nivelParalelo || null, // ← NUEVO
      stepParalelo: student.stepParalelo || null    // ← NUEVO
    };

    // 14. Generar HTML completo del diagnóstico
    const diagnosticoHTML = generarHTMLDiagnosticoCompleto({
      estudiante,
      estadisticas: {
        totalClases,
        clasesAsistidas,
        clasesConParticipacion,
        porcentajeAsistencia,
        porcentajeParticipacion,
        stepsCompletados,
        porcentajeAvance,
        tiposEvento
      },
      diagnosticoPorStep,
      todasLasClases
    });

    console.log('✅ Diagnóstico DETALLADO generado exitosamente (ESS excluido del diagnóstico principal)');

    return {
      success: true,
      data: {
        diagnosticoHTML,
        estadisticas: {
          totalClases,
          clasesAsistidas,
          clasesConParticipacion,
          porcentajeAsistencia,
          porcentajeParticipacion,
          stepsCompletados,
          porcentajeAvance,
          tiposEvento
        },
        todasLasClases, // Incluye ESS para tracking
        estudiante
      }
    };

  } catch (error) {
    console.error('❌ Error generando diagnóstico académico:', error);
    return {
      success: false,
      error: 'Error generando diagnóstico académico',
      details: error.message
    };
  }
}

// Función auxiliar (no modificada, incluida para referencia)
function esStepCompletadoFunc(stepInfo, isJumpStep = false) {
  if (!stepInfo) return false;

  if (isJumpStep) {
    return stepInfo.hasClasses && !stepInfo.noAprobo;
  } else {
    return stepInfo.trueCount >= 2 && stepInfo.club;
  }
}

// ============================================================================
// FIN DEL CÓDIGO MODIFICADO
// ============================================================================
