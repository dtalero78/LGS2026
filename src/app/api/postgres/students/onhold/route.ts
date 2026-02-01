import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/students/onhold
 *
 * Activate or deactivate OnHold status for a student
 *
 * When ACTIVATING OnHold:
 * - Sets estadoInactivo = true
 * - Sets fechaOnHold and fechaFinOnHold
 * - Increments onHoldCount
 * - Adds entry to onHoldHistory
 *
 * When DEACTIVATING OnHold:
 * - Sets estadoInactivo = false
 * - Clears fechaOnHold and fechaFinOnHold
 * - Calculates days paused
 * - Extends finalContrato by days paused
 * - Adds entry to extensionHistory (automatic)
 * - Increments extensionCount
 *
 * Body:
 * {
 *   studentId: string,           // _id of student in PEOPLE table
 *   setOnHold: boolean,          // true = activate, false = deactivate
 *   fechaOnHold?: string,        // Required if setOnHold = true
 *   fechaFinOnHold?: string,     // Required if setOnHold = true
 *   motivo?: string              // Reason for OnHold (optional)
 * }
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      );
    }

    if (body.setOnHold === undefined) {
      return NextResponse.json(
        { error: 'setOnHold is required' },
        { status: 400 }
      );
    }

    // Get current student data
    const studentResult = await query(
      `SELECT "_id", "estadoInactivo", "fechaOnHold", "fechaFinOnHold", "finalContrato",
              "onHoldCount", "onHoldHistory", "extensionCount", "extensionHistory", "vigencia"
       FROM "PEOPLE"
       WHERE "_id" = $1`,
      [body.studentId]
    );

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = studentResult.rows[0];

    // Parse JSONB fields
    let onHoldHistory = Array.isArray(student.onHoldHistory)
      ? student.onHoldHistory
      : JSON.parse(student.onHoldHistory || '[]');

    let extensionHistory = Array.isArray(student.extensionHistory)
      ? student.extensionHistory
      : JSON.parse(student.extensionHistory || '[]');

    if (body.setOnHold) {
      // ==================== ACTIVATE OnHold ====================

      // Validate required fields for activation
      if (!body.fechaOnHold || !body.fechaFinOnHold) {
        return NextResponse.json(
          { error: 'fechaOnHold and fechaFinOnHold are required when activating OnHold' },
          { status: 400 }
        );
      }

      // Add entry to onHoldHistory
      const newOnHoldEntry = {
        fechaActivacion: new Date().toISOString(),
        fechaOnHold: body.fechaOnHold,
        fechaFinOnHold: body.fechaFinOnHold,
        motivo: body.motivo || 'Sin motivo especificado',
        activadoPor: session.user?.name || session.user?.email || 'Unknown'
      };

      onHoldHistory.push(newOnHoldEntry);

      // Update student
      const result = await query(
        `UPDATE "PEOPLE"
         SET "estadoInactivo" = true,
             "fechaOnHold" = $1::timestamp with time zone,
             "fechaFinOnHold" = $2::timestamp with time zone,
             "onHoldCount" = COALESCE("onHoldCount", 0) + 1,
             "onHoldHistory" = $3::jsonb,
             "_updatedDate" = NOW()
         WHERE "_id" = $4
         RETURNING *`,
        [body.fechaOnHold, body.fechaFinOnHold, JSON.stringify(onHoldHistory), body.studentId]
      );

      return NextResponse.json({
        success: true,
        student: result.rows[0],
        message: 'OnHold activado exitosamente',
        onHoldEntry: newOnHoldEntry
      });

    } else {
      // ==================== DEACTIVATE OnHold ====================

      if (!student.fechaOnHold || !student.fechaFinOnHold) {
        return NextResponse.json(
          { error: 'Student is not currently on hold' },
          { status: 400 }
        );
      }

      // Calculate days paused
      const fechaOnHold = new Date(student.fechaOnHold);
      const fechaFinOnHold = new Date(student.fechaFinOnHold);
      const daysPaused = Math.ceil((fechaFinOnHold.getTime() - fechaOnHold.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate new finalContrato
      const currentFinalContrato = new Date(student.finalContrato);
      const newFinalContrato = new Date(currentFinalContrato);
      newFinalContrato.setDate(newFinalContrato.getDate() + daysPaused);

      // Add entry to extensionHistory (automatic extension)
      const newExtensionEntry = {
        numero: (student.extensionCount || 0) + 1,
        fechaEjecucion: new Date().toISOString(),
        vigenciaAnterior: currentFinalContrato.toISOString().split('T')[0],
        vigenciaNueva: newFinalContrato.toISOString().split('T')[0],
        diasExtendidos: daysPaused,
        motivo: `Extensión automática por OnHold (${daysPaused} días pausados desde ${fechaOnHold.toISOString().split('T')[0]} hasta ${fechaFinOnHold.toISOString().split('T')[0]})`
      };

      extensionHistory.push(newExtensionEntry);

      // Calculate new vigencia (days remaining)
      const today = new Date();
      const daysRemaining = Math.ceil((newFinalContrato.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Update student
      const result = await query(
        `UPDATE "PEOPLE"
         SET "estadoInactivo" = false,
             "fechaOnHold" = NULL,
             "fechaFinOnHold" = NULL,
             "finalContrato" = $1::timestamp with time zone,
             "vigencia" = $2,
             "extensionCount" = COALESCE("extensionCount", 0) + 1,
             "extensionHistory" = $3::jsonb,
             "_updatedDate" = NOW()
         WHERE "_id" = $4
         RETURNING *`,
        [
          newFinalContrato.toISOString(),
          daysRemaining.toString(),
          JSON.stringify(extensionHistory),
          body.studentId
        ]
      );

      return NextResponse.json({
        success: true,
        student: result.rows[0],
        message: 'OnHold desactivado y contrato extendido automáticamente',
        extension: {
          daysPaused,
          previousFinalContrato: currentFinalContrato.toISOString().split('T')[0],
          newFinalContrato: newFinalContrato.toISOString().split('T')[0],
          newVigencia: daysRemaining
        },
        extensionEntry: newExtensionEntry
      });
    }
  } catch (error: any) {
    console.error('❌ Error toggling OnHold:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
