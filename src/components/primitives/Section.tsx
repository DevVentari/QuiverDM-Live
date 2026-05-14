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
    title: 'font-[var(--q-font-display)] text-lg font-semibold tracking-[0.03em] text-[var(--q-text)]',
    rule: 'from-[var(--q-border-subtle)]',
  },
  feature: {
    label: 'text-[var(--q-text-faint)]',
    title: 'font-[var(--q-font-display)] text-xl font-semibold tracking-[0.04em] text-[var(--q-text)]',
    rule: 'from-[var(--q-border-feature)]',
  },
  ceremonial: {
    label: 'text-[var(--q-accent-primary-dim)]',
    title: 'font-[var(--q-font-display)] text-fluid-2xl text-[var(--q-text)] tracking-wide',
    rule: 'from-[var(--q-accent-primary-border)]',
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
                  'font-[var(--q-font-display)] text-[10px] font-medium tracking-[2.8px] uppercase whitespace-nowrap',
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
