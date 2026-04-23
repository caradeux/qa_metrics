// Paleta oficial Inovabiz (extraída del logo SVG y CSS de inovabiz.com).

export const PALETTE = {
  greenPrimary: "25CF6C",
  greenLight: "94CE94",
  cyan: "04E5F3",
  blue: "08ACF4",
  navyDeep: "0F172A",
  navyUi: "1F2937",
  white: "FFFFFF",
  grayLight: "F9FAFB",
  textPrimary: "111827",
  textMuted: "6B7280",
  amber: "F59E0B",
  red: "EF4444",
  purple: "A855F7",
  // Fases (usadas en bandas de la curva "siempre ocupados")
  phaseAnalysis: "94C7E3",
  phaseDesign: "08ACF4",
  phaseExecution: "25CF6C",
  // Fases Activity (no-productivas)
  activityUserMeeting: "04E5F3",
  activityDevMeeting: "A855F7",
  activityInduction: "F59E0B",
  activityUnassigned: "6B7280",
  // Estados de dependencia externa (bandas nuevas)
  waitingClient: "C084FC",        // púrpura claro — "Esperando aprobación cliente"
  onDev: "FB7185",                // rojo apagado — "En manos de desarrollo"
  onHold: "94A3B8",               // gris medio — "Detenido"
  notStarted: "CBD5E1",           // gris claro — "No iniciado"
} as const;

export const FONT = {
  face: "Inter",
  fallback: "Segoe UI, Arial, sans-serif",
} as const;

// Dimensiones del slide (16:9). pptxgenjs usa pulgadas.
export const SLIDE = {
  widthIn: 13.333,
  heightIn: 7.5,
  marginIn: 0.5,
} as const;

// Tamaños tipográficos comunes
export const SIZE = {
  titleBig: 44,
  titleMed: 28,
  titleSmall: 20,
  body: 14,
  kpiBig: 48,
  kpiLabel: 12,
  tableHeader: 11,
  tableRow: 10,
  muted: 10,
} as const;

export const GRADIENTS = {
  greenHero: { from: "25CF6C", to: "94CE94", angle: 135 },
  cyanBlue: { from: "04E5F3", to: "08ACF4", angle: 135 },
} as const;
