'use client';

interface RecapStatsProps {
  totalHoursTranscribed: number;
  totalSessions: number;
  pendingReviews: number;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(0)}h`;
}

export function RecapStats({ totalHoursTranscribed, totalSessions, pendingReviews }: RecapStatsProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs"
      style={{
        background: 'hsl(35 15% 12% / 0.6)',
        border: '1px solid hsl(35 20% 20% / 0.4)',
        fontFamily: 'var(--font-bricolage)',
        color: 'hsl(35 5% 48%)',
      }}
    >
      <span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'hsl(35 20% 68%)' }}>
          {formatHours(totalHoursTranscribed)}
        </span>{' '}
        transcribed
      </span>
      <span style={{ color: 'hsl(35 10% 28%)' }}>·</span>
      <span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'hsl(35 20% 68%)' }}>
          {totalSessions}
        </span>{' '}
        sessions
      </span>
      {pendingReviews > 0 && (
        <>
          <span style={{ color: 'hsl(35 10% 28%)' }}>·</span>
          <span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'hsl(200 70% 60%)' }}>
              {pendingReviews}
            </span>{' '}
            pending review
          </span>
        </>
      )}
    </div>
  );
}
