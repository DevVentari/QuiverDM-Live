'use client';

interface WelcomeHeaderProps {
  userName: string;
  hasSessionToday: boolean;
  characterCount: number;
  campaignCount: number;
}

export function WelcomeHeader({
  userName,
  hasSessionToday,
  characterCount,
  campaignCount,
}: WelcomeHeaderProps) {
  const firstName = userName.split(' ')[0] || 'Adventurer';
  const subtitle = getSubtitle(hasSessionToday, characterCount, campaignCount);

  return (
    <div className="mb-8">
      <h2 className="font-display text-4xl text-text-primary mb-2">
        Welcome back, {firstName}
      </h2>
      <p className="font-body text-xl text-text-secondary">
        {subtitle}
      </p>
    </div>
  );
}

function getSubtitle(
  hasSessionToday: boolean,
  characterCount: number,
  campaignCount: number
): string {
  if (hasSessionToday) {
    return 'You have a session today!';
  }

  if (characterCount > 0 || campaignCount > 0) {
    const parts: string[] = [];

    if (characterCount > 0) {
      parts.push(`${characterCount} character${characterCount !== 1 ? 's' : ''}`);
    }

    if (campaignCount > 0) {
      parts.push(`${campaignCount} campaign${campaignCount !== 1 ? 's' : ''}`);
    }

    return parts.join(' across ');
  }

  return 'Ready to start your adventure?';
}

export function WelcomeHeaderSkeleton() {
  return (
    <div className="mb-8 animate-pulse">
      <div className="h-10 bg-cream-light rounded w-64 mb-2" />
      <div className="h-6 bg-cream-light rounded w-48" />
    </div>
  );
}
