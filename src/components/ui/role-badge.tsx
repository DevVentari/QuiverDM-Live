import { PlatformRole } from '@prisma/client';
import { PLATFORM_ROLE_LABELS } from '@/lib/platform';
import { cn } from '@/lib/utils';
import { Crown, Shield, Flame, Sword } from 'lucide-react';

const ROLE_STYLES: Record<PlatformRole, { className: string; icon: typeof Crown }> = {
  [PlatformRole.MYTHKEEPER]: {
    className: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400 shadow-yellow-500/20 shadow-sm',
    icon: Crown,
  },
  [PlatformRole.WARDEN]: {
    className: 'border-purple-500/50 bg-purple-500/10 text-purple-400 shadow-purple-500/20 shadow-sm',
    icon: Shield,
  },
  [PlatformRole.DUNGEON_MASTER]: {
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-400 shadow-amber-500/20 shadow-sm',
    icon: Flame,
  },
  [PlatformRole.ADVENTURER]: {
    className: 'border-slate-500/50 bg-slate-500/10 text-slate-400',
    icon: Sword,
  },
};

export function RoleBadge({ role, className }: { role: PlatformRole; className?: string }) {
  const style = ROLE_STYLES[role];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        style.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {PLATFORM_ROLE_LABELS[role]}
    </span>
  );
}
