import type { AdvisorReportType } from '@/app/api/postgres/reports/programacion/advisors/route'

export interface AdvisorReportConfig {
  title:              string
  subtitle:           string
  kpiLabel:           string          // "Total Sesiones" / "Total Jumps" / etc.
  rankingLabelAdv:    string          // column header without advisor: "Advisor"
  rankingLabelSec:    string          // column header with advisor: "Nivel" / "Tipo de Club"
  chartLabelSec:      string          // "por Nivel" / "por Tipo de Club"
  showNivelFilter:    boolean         // false for clubes (use tipoClub) and welcome
  showTipoClubFilter: boolean         // true only for clubes
  accentColor:        string
}

export const ADVISOR_REPORT_CONFIGS: Record<AdvisorReportType, AdvisorReportConfig> = {
  sesiones: {
    title:              'Informe de Sesiones por Advisor',
    subtitle:           'Sesiones programadas (excluye Jumps, Clubs y Welcome)',
    kpiLabel:           'Total Sesiones',
    rankingLabelAdv:    'Advisor',
    rankingLabelSec:    'Nivel',
    chartLabelSec:      'por Nivel',
    showNivelFilter:    true,
    showTipoClubFilter: false,
    accentColor:        '#3b82f6',
  },
  jumps: {
    title:              'Informe de Jumps por Advisor',
    subtitle:           'Jump Steps (múltiplos de 5: Step 5, 10, 15…)',
    kpiLabel:           'Total Jumps',
    rankingLabelAdv:    'Advisor',
    rankingLabelSec:    'Nivel',
    chartLabelSec:      'por Nivel',
    showNivelFilter:    true,
    showTipoClubFilter: false,
    accentColor:        '#ef4444',
  },
  training: {
    title:              'Informe de Training por Advisor',
    subtitle:           'Eventos CLUB tipo TRAINING (TRAINING - Step X)',
    kpiLabel:           'Total Training',
    rankingLabelAdv:    'Advisor',
    rankingLabelSec:    'Nivel',
    chartLabelSec:      'por Nivel',
    showNivelFilter:    true,
    showTipoClubFilter: false,
    accentColor:        '#f97316',
  },
  clubes: {
    title:              'Informe de Clubes por Advisor',
    subtitle:           'Eventos CLUB excluyendo Training (Listening, Grammar, Karaoke…)',
    kpiLabel:           'Total Clubes',
    rankingLabelAdv:    'Advisor',
    rankingLabelSec:    'Tipo de Club',
    chartLabelSec:      'por Tipo de Club',
    showNivelFilter:    false,
    showTipoClubFilter: true,
    accentColor:        '#22c55e',
  },
  welcome: {
    title:              'Informe de Welcome por Advisor',
    subtitle:           'Sesiones de bienvenida (nivel WELCOME)',
    kpiLabel:           'Total Welcome',
    rankingLabelAdv:    'Advisor',
    rankingLabelSec:    'Advisor',   // welcome sessions only have one level
    chartLabelSec:      'por Advisor',
    showNivelFilter:    false,
    showTipoClubFilter: false,
    accentColor:        '#a855f7',
  },
}
