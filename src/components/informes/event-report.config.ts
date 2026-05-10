import type { ReportConfig, ReportType } from './event-report.types'

export const TYPE_COLORS: Record<string, string> = {
  SESSION:  '#3b82f6',   // blue
  JUMP:     '#ef4444',   // red
  TRAINING: '#f97316',   // orange
  CLUB:     '#22c55e',   // green
  WELCOME:  '#a855f7',   // purple
}

export const REPORT_CONFIGS: Record<ReportType, ReportConfig> = {
  'sessions-jumps': {
    title:    'Calendario Sesiones – Jumps',
    subtitle: 'Eventos SESSION y JUMP del calendario académico',
    tiposPermitidos: ['SESSION', 'JUMP'],
    kpiLabels: [
      { key: 'SESSION', label: 'Total Sessions' },
      { key: 'JUMP',    label: 'Total Jumps' },
    ],
    showTipoClubFilter: false,
    colors: { SESSION: '#3b82f6', JUMP: '#ef4444' },
  },
  'training-clubs': {
    title:    'Calendario Training – Clubs',
    subtitle: 'Eventos TRAINING y CLUB del calendario académico',
    tiposPermitidos: ['TRAINING', 'CLUB'],
    kpiLabels: [
      { key: 'TRAINING', label: 'Total Training' },
      { key: 'CLUB',     label: 'Total Clubs' },
    ],
    showTipoClubFilter: true,
    colors: { TRAINING: '#f97316', CLUB: '#22c55e' },
  },
  'welcome': {
    title:    'Calendario – Welcome',
    subtitle: 'Eventos WELCOME del calendario académico',
    tiposPermitidos: ['WELCOME'],
    kpiLabels: [
      { key: 'WELCOME', label: 'Total Welcome' },
    ],
    showTipoClubFilter: false,
    colors: { WELCOME: '#a855f7' },
  },
}
