import { cn } from '@/lib/utils';

interface StatTile {
  label: string;
  value: string | number;
  alert?: boolean;
}

interface PageLayoutProps {
  overline: string;
  title: string;
  subtitle?: string;
  stats?: StatTile[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageLayout({
  overline,
  title,
  subtitle,
  stats,
  actions,
  children,
}: PageLayoutProps) {
  return (
    <div className="w-full space-y-5">
      <section className="relative overflow-hidden rounded-[1.25rem] border border-amber-500/15 bg-[linear-gradient(135deg,hsl(240_10%_10%/.92),hsl(240_12%_7%/.98))] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(35_70%_40%/.18),transparent_42%),radial-gradient(circle_at_85%_12%,hsl(262_55%_45%/.12),transparent_30%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/78">
              {overline}
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-[0.035em] text-amber-50 sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-amber-100/65">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {stats && stats.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className={cn(
                      'rounded-2xl border px-4 py-3 min-w-[68px] text-center',
                      stat.alert
                        ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                        : 'border-white/10 bg-white/[0.03]'
                    )}
                  >
                    <p className={cn(
                      'font-display text-[10px] uppercase tracking-[0.22em]',
                      stat.alert ? 'text-emerald-200/60' : 'text-amber-100/45'
                    )}>
                      {stat.label}
                    </p>
                    <p className={cn(
                      'font-display mt-1 text-xl font-semibold tracking-[0.03em]',
                      stat.alert ? 'text-emerald-300' : 'text-amber-50'
                    )}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {actions && (
              <div className="flex items-center gap-2">{actions}</div>
            )}
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}
