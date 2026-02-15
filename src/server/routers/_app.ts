import { router } from '../trpc';
// import { whisperRouter } from './whisper'; // Disabled - using WhisperX instead
import { sessionTranscriptionRouter } from './session-transcription';
import { sessionRecordingsRouter } from './session-recordings';
import { transcriptRouter } from './transcript';
import { campaignsRouter } from './campaigns';
import { sessionsRouter } from './sessions';
import { npcsRouter} from './npcs';
import { playersRouter } from './players';
import { homebrewRouter } from './homebrew'; // Re-enabled for content queries
import { homebrewDndBeyondRouter } from './homebrew-dndbeyond'; // D&D Beyond integration
import { homebrewPdfRouter } from './homebrew-pdf'; // PDF to Markdown conversion
import { homebrewExtractionRouter } from './homebrew-extraction'; // Ollama-based extraction
// import { doclingRouter } from './docling'; // REMOVED - PDF parsing functionality removed
import { userSettingsRouter } from './user-settings';
import { membersRouter } from './members'; // Campaign membership management
import { charactersRouter } from './characters'; // Player-owned characters
import { charactersDndBeyondRouter } from './characters-dndbeyond'; // D&D Beyond character import
import { invitesRouter } from './invites'; // Closed beta invite codes
import { onboardingRouter } from './onboarding'; // User onboarding flow
import { feedbackRouter } from './feedback'; // Beta feedback collection
import { usageRouter } from './usage'; // Usage limits and quotas

export const appRouter = router({
  // whisper: whisperRouter, // Disabled - using WhisperX instead
  campaigns: campaignsRouter,
  sessions: sessionsRouter,
  npcs: npcsRouter,
  players: playersRouter,
  characters: charactersRouter, // Player-owned character management
  charactersDndBeyond: charactersDndBeyondRouter, // D&D Beyond character import
  sessionTranscription: sessionTranscriptionRouter,
  sessionRecordings: sessionRecordingsRouter,
  transcript: transcriptRouter,
  homebrew: homebrewRouter, // Manual homebrew content management
  homebrewDndBeyond: homebrewDndBeyondRouter, // D&D Beyond integration
  homebrewPdf: homebrewPdfRouter, // PDF management and Marker conversion
  homebrewExtraction: homebrewExtractionRouter, // Ollama-based extraction
  // docling: doclingRouter, // REMOVED - PDF parsing functionality removed
  userSettings: userSettingsRouter,
  members: membersRouter, // Campaign membership management
  invites: invitesRouter, // Closed beta invite codes
  onboarding: onboardingRouter, // User onboarding flow
  feedback: feedbackRouter, // Beta feedback collection
  usage: usageRouter, // Usage limits and quotas
});

export type AppRouter = typeof appRouter;
