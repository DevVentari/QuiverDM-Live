import { cn } from '@/lib/utils';

export interface CanvasHeaderStat {
  label: string;
  value: string | number;
  alert?: boolean;
}

interface CanvasHeaderProps {
  overline: string;
  title: string;
  stats?: CanvasHeaderStat[];
  actions?: React.ReactNode;
  className?: string;
}

export function CanvasHeader({ overline, title, stats, actions, className }: CanvasHeaderProps) {
  return (
    <div
      className={cn('relative flex-shrink-0 overflow-hidden border-b', className)}
      style={{
        borderColor: 'hsl(35 35% 13%)',
        background: 'linear-gradient(135deg, hsl(240 12% 9% / 0.98) 0%, hsl(240 12% 5.5% / 0.96) 100%)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 60% 80% at 0% 0%, hsl(35 80% 55% / 0.09), transparent 55%)',
            'radial-gradient(ellipse 30% 60% at 92% 10%, hsl(260 50% 45% / 0.06), transparent 40%)',
          ].join(', '),
        }}
      />

      <div className="relative flex items-center justify-between gap-4 px-5 py-3">
        {/* Left: overline + title */}
        <div className="min-w-0">
          <p
            className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.22em] font-display"
            style={{ color: 'hsl(35 80% 55% / 0.6)' }}
          >
            {overline}
          </p>
          <h1
            className="text-lg font-bold leading-none tracking-[0.04em] font-display truncate"
            style={{ color: 'hsl(35 30% 92%)' }}
          >
            {title}
          </h1>
        </div>

        {/* Right: stats + actions */}
        {(stats?.length || actions) && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {stats?.map((stat) => (
              <div
                key={stat.label}
                className="rounded border px-2.5 py-1.5 text-center min-w-[44px]"
                style={{
                  borderColor: stat.alert ? 'hsl(35 60% 45% / 0.35)' : 'hsl(255 10% 100% / 0.07)',
                  background: stat.alert ? 'hsl(35 60% 45% / 0.07)' : 'hsl(255 10% 100% / 0.025)',
                }}
              >
                <p
                  className="text-sm font-bold tabular-nums leading-none"
                  style={{ color: stat.alert ? 'hsl(35 70% 65%)' : 'hsl(35 30% 78%)' }}
                >
                  {stat.value}
                </p>
                <p
                  className="mt-0.5 text-[9px] uppercase tracking-[0.14em] leading-none"
                  style={{ color: 'hsl(35 40% 45% / 0.6)' }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
