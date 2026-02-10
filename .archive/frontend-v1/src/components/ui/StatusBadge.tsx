'use client';

import { cn } from '@/lib/utils';
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

type StatusType = 'pending' | 'processing' | 'completed' | 'failed' | 'warning';

interface StatusBadgeProps {
  /** Status to display */
  status: StatusType | string;
  /** Custom label (optional, defaults to status name) */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show icon */
  showIcon?: boolean;
  /** Additional class name */
  className?: string;
}

const statusConfig: Record<
  StatusType,
  { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  pending: {
    bg: 'bg-gray-800',
    text: 'text-gray-300',
    icon: Clock,
  },
  processing: {
    bg: 'bg-blue-900/50',
    text: 'text-blue-300',
    icon: Loader2,
  },
  completed: {
    bg: 'bg-green-900/50',
    text: 'text-green-300',
    icon: CheckCircle,
  },
  failed: {
    bg: 'bg-red-900/50',
    text: 'text-red-300',
    icon: XCircle,
  },
  warning: {
    bg: 'bg-yellow-900/50',
    text: 'text-yellow-300',
    icon: AlertCircle,
  },
};

const sizeConfig = {
  sm: {
    padding: 'px-1.5 py-0.5',
    text: 'text-xs',
    iconSize: 10,
    gap: 'gap-1',
  },
  md: {
    padding: 'px-2 py-1',
    text: 'text-sm',
    iconSize: 12,
    gap: 'gap-1.5',
  },
  lg: {
    padding: 'px-3 py-1.5',
    text: 'text-base',
    iconSize: 14,
    gap: 'gap-2',
  },
};

export function StatusBadge({
  status,
  label,
  size = 'md',
  showIcon = true,
  className,
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as StatusType;
  const config = statusConfig[normalizedStatus] || statusConfig.pending;
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);
  const isProcessing = normalizedStatus === 'processing';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        config.bg,
        config.text,
        sizeStyles.padding,
        sizeStyles.text,
        sizeStyles.gap,
        className
      )}
    >
      {showIcon && (
        <Icon
          size={sizeStyles.iconSize}
          className={cn(isProcessing && 'animate-spin')}
        />
      )}
      {displayLabel}
    </span>
  );
}
