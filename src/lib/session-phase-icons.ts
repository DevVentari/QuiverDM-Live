import { BookOpen, Play, Mic, MessageSquare, FileText, Star } from 'lucide-react';
import type { SessionPhase } from '@/lib/session-lifecycle';
import type { LucideIcon } from 'lucide-react';

export const PHASE_ICONS: Record<SessionPhase, LucideIcon> = {
  prep:       BookOpen,
  ran:        Play,
  processing: Mic,
  summary:    MessageSquare,
  recap:      FileText,
  complete:   Star,
};
