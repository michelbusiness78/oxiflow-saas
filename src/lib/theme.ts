// OxiFlow Design System — constantes de design

export const colors = {
  // Couleurs principales
  navy: '#1B2A4A',       // Fond sidebar, éléments profonds
  primary: '#2563EB',    // Bleu vif — actions, liens actifs
  primaryHover: '#1D4ED8',

  // Sémantique
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  info: '#0EA5E9',
  infoLight: '#E0F2FE',

  // Neutres — surfaces
  white: '#FFFFFF',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // Texte
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
} as const;

export const typography = {
  fontSans: 'var(--font-inter)',
  fontMono: 'var(--font-geist-mono)',

  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
  },

  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  lineHeights: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
  },
} as const;

export const spacing = {
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

export const borderRadius = {
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)',
} as const;

export const layout = {
  sidebarWidth: '240px',
  headerHeight: '64px',
  mobileNavHeight: '64px',
  contentMaxWidth: '1280px',
  contentPadding: '1.5rem',
} as const;

// Modules de navigation OxiFlow
export const navModules = [
  { key: 'pilotage',     label: 'Pilotage',      href: '/pilotage',     icon: 'chart' },
  { key: 'commerce',     label: 'Commerce',      href: '/commerce',     icon: 'briefcase' },
  { key: 'technicien',   label: 'Technicien',    href: '/technicien',   icon: 'wrench' },
  { key: 'chef-projet',  label: 'Chef Projet',   href: '/chef-projet',  icon: 'clipboard' },
  { key: 'rh',           label: 'RH',            href: '/rh',           icon: 'users' },
] as const;

export type NavModuleKey = (typeof navModules)[number]['key'];
