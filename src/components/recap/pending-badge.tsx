'use client';

interface PendingBadgeProps {
  count: number;
  className?: string;
}

export function PendingBadge({ count, className }: PendingBadgeProps) {
  if (count === 0) return null;
  return (
    <span
      className={className}
      style={{
        background: 'hsl(200 70% 55%)',
        color: 'white',
        fontFamily: 'var(--font-bricolage)',
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '9999px',
        lineHeight: 1,
        display: 'inline-block',
      }}
    >
      {count}
    </span>
  );
}
