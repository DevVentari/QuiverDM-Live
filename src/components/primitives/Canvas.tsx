import { cn } from '@/lib/utils'

interface CanvasProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

export function Canvas({ className, children, ...props }: CanvasProps) {
  return (
    <div
      className={cn('relative bg-[var(--q-bg)] min-h-screen overflow-hidden', className)}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse at 15% 0%, var(--q-glow-amber), transparent 50%)',
            'radial-gradient(ellipse at 85% 100%, var(--q-glow-mystic), transparent 50%)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
