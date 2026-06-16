/**
 * Pure reducer for live transcription turns. AssemblyAI's streaming API emits a
 * sequence of partial (isFinal=false) turns for the current utterance, then one
 * final turn. We keep the finalized turns plus a single "interim" turn that the
 * UI renders in-progress. Framework-free so it can be unit-tested in isolation.
 */

export interface LiveTurn {
  text: string;
  isFinal: boolean;
  speaker?: string | null;
  timestamp?: number;
}

export interface LiveTranscriptState {
  finals: LiveTurn[];
  interim: LiveTurn | null;
}

export const emptyTranscript: LiveTranscriptState = { finals: [], interim: null };

/** Fold one incoming turn into the transcript state. */
export function applyTurn(state: LiveTranscriptState, turn: LiveTurn): LiveTranscriptState {
  const text = (turn.text ?? '').trim();
  if (turn.isFinal) {
    // Ignore empty finals (AssemblyAI occasionally emits blank end-of-turn).
    if (!text) return { finals: state.finals, interim: null };
    return { finals: [...state.finals, { ...turn, text }], interim: null };
  }
  // A non-final turn replaces the current interim (or clears it when empty).
  return { finals: state.finals, interim: text ? { ...turn, text } : null };
}

/** The full ordered list of turns to render (finals followed by the interim). */
export function visibleTurns(state: LiveTranscriptState): LiveTurn[] {
  return state.interim ? [...state.finals, state.interim] : state.finals;
}
