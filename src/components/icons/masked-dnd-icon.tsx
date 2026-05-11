import type { CSSProperties } from 'react';
import type { DndIconName } from '@/components/ui/dnd-icon';
import { cn } from '@/lib/utils';

interface MaskedDndIconProps {
  // Accept the typed union (autocomplete) or any string path (`subdir/name`)
  // for files that exist on disk but aren't in DndIconName yet.
  name: DndIconName | (string & {});
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function MaskedDndIcon({ name, size = 16, className, style }: MaskedDndIconProps) {
  const url = `/icons/dnd/${name}.svg`;
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMask: `url(${url}) center / contain no-repeat`,
        mask: `url(${url}) center / contain no-repeat`,
        ...style,
      }}
    />
  );
}
