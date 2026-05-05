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
      <div>
        <p className="label-overline mb-1">{overline}</p>
        <div className="section-rule" />
        <div className="flex items-end justify-between mt-3">
          <h1 className="font-display text-xl font-bold tracking-wide">{title}</h1>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
