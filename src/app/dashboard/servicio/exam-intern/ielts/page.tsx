'use client'

import ExamInternPage from '@/components/exam-intern/ExamInternPage'
import { ServicioPermission } from '@/types/permissions'

export default function IeltsPage() {
  return (
    <ExamInternPage
      prueba="IELTS"
      displayName="IELTS"
      permVer={ServicioPermission.EXAM_INTERN_IELTS_VER}
      permExportar={ServicioPermission.EXAM_INTERN_IELTS_EXPORTAR}
      permAplicarConfirmacion={ServicioPermission.EXAM_INTERN_IELTS_APLICAR_CONFIRMACION}
    />
  )
}
