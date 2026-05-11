import { cn } from '@/lib/utils'

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  label?: string
  title?: string
  description?: string
  action?: React.ReactNode
  tone?: 'utility' | 'feature' | 'ceremonial'
  children?: React.ReactNode
}

const toneClasses = {
  utility: {
    label: 'text-[var(--q-text-faint)]',
    title: 'text-lg font-semibold text-[var(--q-text)]',
    rule: 'from-[var(--q-border)]',
  },
  feature: {
    label: 'text-[var(--q-amber-dim)]',
    title: 'text-xl font-semibold text-[var(--q-text)]',
    rule: 'from-[var(--q-amber-dim)]',
  },
  ceremonial: {
    label: 'text-[var(--q-amber)]',
    title: 'font-[var(--q-font-display)] text-fluid-2xl text-[var(--q-text)] tracking-wide',
    rule: 'from-[var(--q-amber)]',
  },
} as const

export function Section({
  label,
  title,
  description,
  action,
  tone = 'feature',
  className,
  children,
  ...props
}: SectionProps) {
  const styles = toneClasses[tone]
  // Only render an h2 when the caller explicitly passes a `title`. The previous
  // `title ?? label` fallback produced a redundant double-header (overline + identical h2).
  const displayTitle = title

  return (
    <section className={cn('space-y-4', className)} {...props}>
      {(label || displayTitle || action) && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {label && (
              <span
                className={cn(
                  'text-[10px] font-medium tracking-[2.5px] uppercase whitespace-nowrap',
                  tone === 'ceremonial' ? 'font-[var(--q-font-display)]' : '',
                  styles.label,
                )}
              >
                {label}
              </span>
            )}
            <div className={cn('flex-1 h-px bg-gradient-to-r to-transparent', styles.rule)} />
            {action && <div className="shrink-0">{action}</div>}
          </div>
          {(displayTitle || description) && (
            <div className="space-y-1">
              {displayTitle && <h2 className={styles.title}>{displayTitle}</h2>}
              {description && (
                <p className="max-w-3xl text-sm text-[var(--q-text-dim)]">{description}</p>
              )}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
