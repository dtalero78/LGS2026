'use client'

import ExamInternPage from '@/components/exam-intern/ExamInternPage'
import { ServicioPermission } from '@/types/permissions'

export default function ToeflPage() {
  return (
    <ExamInternPage
      prueba="TOEFL"
      displayName="TOEFL"
      permVer={ServicioPermission.EXAM_INTERN_TOEFL_VER}
      permExportar={ServicioPermission.EXAM_INTERN_TOEFL_EXPORTAR}
      permAplicarConfirmacion={ServicioPermission.EXAM_INTERN_TOEFL_APLICAR_CONFIRMACION}
    />
  )
}
