// ============================================
// FUNCIÓN DE DIAGNÓSTICO SIMPLE: Solo consultar ACADEMICA
// ============================================
// Copia esta función al final de search.jsw en Wix

import wixData from 'wix-data';

export async function debugSimpleAcademica(studentId = "beb67ba3-aa5b-4c38-b370-bb7d3a3c6d50") {
    try {
        console.log('🔍 [DEBUG SIMPLE] Consultando ACADEMICA para:', studentId);

        const academica = await wixData.query('ACADEMICA')
            .eq('_id', studentId)
            .find();

        if (academica.items.length === 0) {
            console.log('❌ [DEBUG] No se encontró estudiante en ACADEMICA');
            return {
                success: false,
                error: 'Estudiante no encontrado en ACADEMICA',
                studentId: studentId
            };
        }

        const student = academica.items[0];

        console.log('✅ [DEBUG] Estudiante encontrado:');
        console.log(`   - ID: ${student._id}`);
        console.log(`   - Nombre: ${student.primerNombre} ${student.primerApellido}`);
        console.log(`   - Documento: ${student.numeroId}`);
        console.log(`   - Nivel: ${student.nivel}`);
        console.log(`   - Step: ${student.step}`);

        return {
            success: true,
            studentId: studentId,
            nivel: student.nivel,
            step: student.step,
            nombreCompleto: `${student.primerNombre} ${student.primerApellido}`,
            numeroId: student.numeroId,
            rawData: student
        };

    } catch (error) {
        console.error('❌ [DEBUG] Error:', error);
        return {
            success: false,
            error: error.message,
            errorStack: error.stack
        };
    }
}
