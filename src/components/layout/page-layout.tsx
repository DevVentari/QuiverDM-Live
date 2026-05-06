import { cn } from '@/lib/utils';

const MAX_WIDTH_CLASSES = {
  sm:   'max-w-xl',
  md:   'max-w-3xl',
  lg:   'max-w-5xl',
  xl:   'max-w-7xl',
  full: 'w-full',
} as const;

interface PageLayoutProps {
  overline: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  maxWidth?: keyof typeof MAX_WIDTH_CLASSES;
  children: React.ReactNode;
}

export function PageLayout({
  overline,
  title,
  subtitle,
  actions,
  maxWidth = 'md',
  children,
}: PageLayoutProps) {
  return (
    <div className={cn('space-y-5', MAX_WIDTH_CLASSES[maxWidth])}>
      <div className="rounded-[1.1rem] border border-border/60 bg-card/35 p-5 backdrop-blur">
        <p className="label-overline mb-1">{overline}</p>
        <div className="section-rule" />
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-wide sm:text-2xl">{title}</h1>
            {subtitle && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 sm:justify-end">{actions}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}
