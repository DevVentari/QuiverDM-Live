export type SessionPhase = 'prep' | 'ran' | 'processing' | 'summary' | 'recap' | 'complete';

export interface SessionForPhase {
  status: string;
  aiSummaryStatus: string;
  aiSummary: string | null;
  recordingCount: number;
  hasApprovedRecap: boolean;
}

export function deriveSessionPhase(session: SessionForPhase): SessionPhase {
  if (session.status === 'planning') return 'prep';
  if (session.status === 'in_progress' || session.status === 'active') return 'ran';
  if (session.recordingCount === 0) return 'processing';
  const summaryDone = (session.aiSummaryStatus === 'done' || session.aiSummaryStatus === 'error') && session.aiSummary !== null;
  if (!summaryDone) return 'summary';
  if (!session.hasApprovedRecap) return 'recap';
  return 'complete';
}

export const PHASE_LABELS: Record<SessionPhase, string> = {
  prep: 'Prep',
  ran: 'Ran',
  processing: 'Processing',
  summary: 'Summary',
  recap: 'Recap',
  complete: 'Complete',
};

export const PHASE_ORDER: SessionPhase[] = ['prep', 'ran', 'processing', 'summary', 'recap'];
