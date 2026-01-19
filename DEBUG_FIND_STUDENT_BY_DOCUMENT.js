// ============================================
// FUNCIÓN DE DIAGNÓSTICO: Buscar estudiante por número de documento
// ============================================
// Copia esta función al final de search.jsw en Wix
// Luego llámala para encontrar el ID correcto en ACADEMICA

import wixData from 'wix-data';

export async function debugFindStudentByDocument(numeroId = "52444888") {
    try {
        console.log('🔍 [DEBUG] Buscando estudiante por documento:', numeroId);

        // Buscar en PEOPLE
        const peopleResult = await wixData.query('PEOPLE')
            .eq('numeroId', numeroId)
            .limit(10)
            .find();

        console.log(`👤 [DEBUG] Registros en PEOPLE: ${peopleResult.items.length}`);

        if (peopleResult.items.length > 0) {
            peopleResult.items.forEach((person, index) => {
                console.log(`${index + 1}. PEOPLE ID: ${person._id}`);
                console.log(`   - Nombre: ${person.primerNombre} ${person.primerApellido}`);
                console.log(`   - Tipo: ${person.tipoUsuario}`);
                console.log(`   - Contrato: ${person.contrato}`);
            });
        }

        // Buscar en ACADEMICA
        const academicaResult = await wixData.query('ACADEMICA')
            .eq('numeroId', numeroId)
            .limit(10)
            .find();

        console.log(`🎓 [DEBUG] Registros en ACADEMICA: ${academicaResult.items.length}`);

        if (academicaResult.items.length > 0) {
            academicaResult.items.forEach((student, index) => {
                console.log(`${index + 1}. ACADEMICA ID: ${student._id}`);
                console.log(`   - Nombre: ${student.primerNombre} ${student.primerApellido}`);
                console.log(`   - Nivel: ${student.nivel}`);
                console.log(`   - Step: ${student.step}`);
                console.log(`   - Usuario ID: ${student.usuarioId}`);
            });
        } else {
            console.log('⚠️ [DEBUG] NO se encontró el estudiante en ACADEMICA');
            console.log('   Esto significa que el estudiante NO está registrado académicamente');
        }

        // Buscar en BOOKING con el documento
        const bookingResult = await wixData.query('BOOKING')
            .eq('numeroId', numeroId)
            .limit(10)
            .find();

        console.log(`📚 [DEBUG] Registros en BOOKING: ${bookingResult.items.length}`);

        if (bookingResult.items.length > 0) {
            bookingResult.items.forEach((booking, index) => {
                console.log(`${index + 1}. BOOKING idEstudiante: ${booking.idEstudiante}`);
                console.log(`   - Nivel: ${booking.nivel}`);
                console.log(`   - Step: ${booking.step}`);
            });
        }

        return {
            success: true,
            numeroId: numeroId,
            peopleRecords: peopleResult.items.map(p => ({
                _id: p._id,
                nombre: `${p.primerNombre} ${p.primerApellido}`,
                tipoUsuario: p.tipoUsuario,
                contrato: p.contrato
            })),
            academicaRecords: academicaResult.items.map(a => ({
                _id: a._id,
                nombre: `${a.primerNombre} ${a.primerApellido}`,
                nivel: a.nivel,
                step: a.step,
                usuarioId: a.usuarioId
            })),
            bookingRecords: bookingResult.items.map(b => ({
                idEstudiante: b.idEstudiante,
                nivel: b.nivel,
                step: b.step
            })),
            idCorrectoDePeople: peopleResult.items[0]?._id || null,
            idCorrectoDeAcademica: academicaResult.items[0]?._id || null,
            message: 'Ver logs de Wix para detalles completos'
        };

    } catch (error) {
        console.error('❌ [DEBUG] Error en búsqueda:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
