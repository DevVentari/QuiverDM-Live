// Design tokens for QuiverDM - amber D&D aesthetic, dark-mode-first
// These mirror the CSS variables in globals.css and Tailwind config

export const colors = {
  primary: 'var(--primary)', // Amber oklch(0.70 0.16 55)
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  card: 'var(--card)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  border: 'var(--border)',
  destructive: 'var(--destructive)',
} as const;

export const fonts = {
  display: 'var(--font-cinzel)', // Cinzel - D&D/historical headings
  body: 'var(--font-bricolage)', // Bricolage Grotesque - expressive body
} as const;

export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '3rem', // 48px
} as const;

export const radius = {
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  full: '9999px',
} as const;
