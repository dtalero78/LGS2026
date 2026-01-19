// ============================================
// FUNCIÓN DE DIAGNÓSTICO: Consultar BOOKING del estudiante
// ============================================
// Copia esta función al final de search.jsw en Wix
// Luego llámala desde el frontend o desde la consola de Wix

import wixData from 'wix-data';

export async function debugStudentBooking(studentId = "beb67ba3-aa5b-4c38-b370-bb7d3a3c6d50") {
    try {
        console.log('🔍 [DEBUG] Consultando TODOS los bookings para estudiante:', studentId);

        // Obtener TODOS los bookings del estudiante
        const allBookings = await wixData.query('BOOKING')
            .eq('idEstudiante', studentId)
            .limit(1000)
            .find();

        console.log(`📊 [DEBUG] Total de bookings encontrados: ${allBookings.items.length}`);

        // Filtrar específicamente Step 15 de BN3
        const step15Bookings = allBookings.items.filter(b =>
            b.step === 'Step 15' && b.nivel === 'BN3'
        );

        console.log(`🎯 [DEBUG] Bookings de BN3 Step 15: ${step15Bookings.length}`);

        // Mostrar TODOS los bookings con sus campos (usando campo correcto: asistio)
        const bookingSummary = allBookings.items.map(b => ({
            _id: b._id,
            nivel: b.nivel,
            step: b.step,
            tipoEvento: b.tipoEvento,
            asistio: b.asistio,  // ← Campo correcto en BOOKING
            participacion: b.participacion,
            noAprobo: b.noAprobo,
            idEvento: b.idEvento,
            fechaEvento: b.fechaEvento
        }));

        console.log('📋 [DEBUG] Resumen de todos los bookings:');
        bookingSummary.forEach((b, index) => {
            console.log(`${index + 1}. ${b.nivel} ${b.step} - Tipo: ${b.tipoEvento} - Asistio: ${b.asistio} - NoAprobo: ${b.noAprobo}`);
        });

        // Obtener CLASSES para el estudiante
        const allClasses = await wixData.query('CLASSES')
            .eq('idEstudiante', studentId)
            .limit(1000)
            .find();

        console.log(`📚 [DEBUG] Total de CLASSES encontrados: ${allClasses.items.length}`);

        // Buscar específicamente el evento Step 15
        const step15Classes = allClasses.items.filter(c =>
            c.idEvento === '3a3418e6-0536-4ec9-a1ca-5a9e59722330'
        );

        console.log(`🎯 [DEBUG] CLASSES para Step 15 (evento 3a3418e6...): ${step15Classes.length}`);

        if (step15Classes.length > 0) {
            console.log('📝 [DEBUG] Datos de CLASSES Step 15:');
            step15Classes.forEach(c => {
                console.log(`   - asistencia: ${c.asistencia}`);
                console.log(`   - participacion: ${c.participacion}`);
                console.log(`   - noAprobo: ${c.noAprobo}`);
            });
        }

        // Obtener datos de ACADEMICA
        const academica = await wixData.query('ACADEMICA')
            .eq('_id', studentId)
            .find();

        if (academica.items.length > 0) {
            const student = academica.items[0];
            console.log('🎓 [DEBUG] Datos de ACADEMICA:');
            console.log(`   - Nivel actual: ${student.nivel}`);
            console.log(`   - Step actual: ${student.step}`);
            console.log(`   - Nombre: ${student.primerNombre} ${student.primerApellido}`);
        }

        return {
            success: true,
            totalBookings: allBookings.items.length,
            step15Bookings: step15Bookings.length,
            totalClasses: allClasses.items.length,
            step15Classes: step15Classes.length,
            bookingSummary: bookingSummary,
            academicaData: academica.items[0] || null,
            message: 'Ver logs de Wix para detalles completos'
        };

    } catch (error) {
        console.error('❌ [DEBUG] Error en diagnóstico:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
