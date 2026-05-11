import { cn } from '@/lib/utils'

interface CanvasProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'base' | 'world' | 'prep' | 'recap' | 'summon'
  grain?: boolean
  vignette?: boolean
  glow?: boolean
  children?: React.ReactNode
}

const variantGlows = {
  base: null,
  world:
    'radial-gradient(circle at 18% 18%, var(--q-glow-signature), transparent 34%), radial-gradient(circle at 78% 72%, var(--q-glow-amber), transparent 24%)',
  prep:
    'radial-gradient(circle at 20% 12%, var(--q-glow-amber), transparent 28%), radial-gradient(circle at 84% 82%, var(--q-glow-mystic), transparent 30%)',
  recap:
    'radial-gradient(circle at 50% 0%, var(--q-glow-hero), transparent 42%), radial-gradient(circle at 50% 100%, var(--q-glow-mystic), transparent 38%)',
  summon:
    'radial-gradient(circle at 50% 0%, var(--q-glow-hero), transparent 38%), radial-gradient(circle at 50% 100%, var(--q-glow-signature), transparent 46%)',
} as const

export function Canvas({
  variant = 'base',
  grain = true,
  vignette = true,
  glow = true,
  className,
  children,
  ...props
}: CanvasProps) {
  return (
    <div
      className={cn(
        'relative min-h-screen overflow-hidden',
        vignette && 'q-signature-vignette',
        className,
      )}
      {...props}
    >
      {glow && variantGlows[variant] && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: variantGlows[variant] }}
        />
      )}
      {grain && <div aria-hidden className="pointer-events-none absolute inset-0 q-panel-grain" />}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
