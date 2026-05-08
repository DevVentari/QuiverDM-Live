import { cn } from '@/lib/utils'

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  label: string
  children?: React.ReactNode
}

export function Section({ label, className, children, ...props }: SectionProps) {
  return (
    <section className={cn('mt-8', className)} {...props}>
      <div className="flex items-center gap-3 mb-4">
        <span
          className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase whitespace-nowrap"
        >
          {label}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-[var(--q-amber-dim)] to-transparent" />
      </div>
      {children}
    </section>
  )
}
