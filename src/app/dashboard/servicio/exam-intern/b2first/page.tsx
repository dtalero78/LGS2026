'use client'

import ExamInternPage from '@/components/exam-intern/ExamInternPage'
import { ServicioPermission } from '@/types/permissions'

export default function B2FirstPage() {
  return (
    <ExamInternPage
      prueba="B2FIRST"
      displayName="B2 First"
      permVer={ServicioPermission.EXAM_INTERN_B2F_VER}
      permExportar={ServicioPermission.EXAM_INTERN_B2F_EXPORTAR}
      permAplicarConfirmacion={ServicioPermission.EXAM_INTERN_B2F_APLICAR_CONFIRMACION}
    />
  )
}
