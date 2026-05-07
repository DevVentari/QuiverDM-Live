import { cn } from '@/lib/utils';
import { CanvasHeader, type CanvasHeaderStat } from './canvas-header';

interface SplitCanvasProps {
  // Canvas header
  overline: string;
  title: string;
  stats?: CanvasHeaderStat[];
  actions?: React.ReactNode;
  // Left pane — full content ownership by the page
  leftPane: React.ReactNode;
  // Canvas pane body
  children: React.ReactNode;
  className?: string;
}

export function SplitCanvas({
  overline,
  title,
  stats,
  actions,
  leftPane,
  children,
  className,
}: SplitCanvasProps) {
  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      <CanvasHeader overline={overline} title={title} stats={stats} actions={actions} />

      {/* Split body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane — 26% */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            width: '26%',
            flexShrink: 0,
            borderRight: '1px solid hsl(35 35% 11%)',
            background: 'hsl(240 12% 4.2%)',
          }}
        >
          {leftPane}
        </div>

        {/* Canvas pane — 74% */}
        <div
          className="flex flex-1 flex-col overflow-hidden"
          style={{ background: 'hsl(240 12% 5%)' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
