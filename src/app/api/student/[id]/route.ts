import { NextRequest, NextResponse } from 'next/server'
import { getStudentById } from '@/lib/wix'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id

    if (!studentId) {
      return NextResponse.json({
        success: false,
        error: 'Student ID is required'
      }, { status: 400 })
    }

    // Get student data from Wix
    const studentData = await getStudentById(studentId)

    if (!studentData.success || !studentData.student) {
      return NextResponse.json({
        success: false,
        error: 'Student not found',
        source: 'wix'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      student: studentData.student,
      classes: studentData.classes || [],
      source: 'wix'
    })

  } catch (error) {
    console.error('Error fetching student:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}