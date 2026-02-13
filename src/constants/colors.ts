/**
 * DriversLog Farbpalette
 * Touring & Grand Tour Vibe: gedeckte Toene, edles Dunkelblau, Racing Green
 */
export const colors = {
  // Primaerfarben
  primary: {
    DEFAULT: '#1B3A4B',  // Deep Touring Blue
    light: '#2D5F7A',
    dark: '#0F2330',
  },
  // Akzentfarbe
  accent: {
    DEFAULT: '#2E5A3C',  // British Racing Green
    light: '#3D7A50',
    dark: '#1A3623',
  },
  // Warme Akzente (Leder / Holz)
  warm: {
    DEFAULT: '#8B6F47',  // Saddletan
    light: '#B8956A',
    dark: '#5C4A2F',
  },
  // Hintergruende
  background: {
    DEFAULT: '#F5F2ED',  // Warmweiss / Pergament
    card: '#FFFFFF',
    dark: '#1A1A1A',
  },
  // Text
  text: {
    DEFAULT: '#1A1A1A',
    secondary: '#6B7280',
    light: '#F5F2ED',
    muted: '#9CA3AF',
  },
  // Status
  success: '#2E7D4F',
  warning: '#C4841D',
  error: '#B91C1C',
} as const;
