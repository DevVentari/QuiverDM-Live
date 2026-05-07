import { cn } from '@/lib/utils';
import { CanvasHeader, type CanvasHeaderStat } from './canvas-header';

interface BentoCanvasProps {
  overline: string;
  title: string;
  stats?: CanvasHeaderStat[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function BentoCanvas({
  overline,
  title,
  stats,
  actions,
  children,
  className,
}: BentoCanvasProps) {
  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      <CanvasHeader overline={overline} title={title} stats={stats} actions={actions} />
      <div className="flex-1 overflow-y-auto p-5">
        {children}
      </div>
    </div>
  );
}
