import { router } from '../trpc';
import { sessionTranscriptionRouter } from './session-transcription';
import { sessionRecordingsRouter } from './session-recordings';
import { transcriptRouter } from './transcript';
import { campaignsRouter } from './campaigns';
import { sessionsRouter } from './sessions';
import { npcsRouter } from './npcs';
import { playersRouter } from './players';
import { homebrewRouter } from './homebrew';
import { homebrewDndBeyondRouter } from './homebrew-dndbeyond';
import { homebrewPdfRouter } from './homebrew-pdf';
import { homebrewExtractionRouter } from './homebrew-extraction';
import { userSettingsRouter } from './user-settings';
import { membersRouter } from './members';
import { charactersRouter } from './characters';
import { charactersDndBeyondRouter } from './characters-dndbeyond';
import { invitesRouter } from './invites';
import { onboardingRouter } from './onboarding';
import { feedbackRouter } from './feedback';
import { usageRouter } from './usage';
import { billingRouter } from './billing';

export const appRouter = router({
  campaigns: campaignsRouter,
  sessions: sessionsRouter,
  npcs: npcsRouter,
  players: playersRouter,
  characters: charactersRouter,
  charactersDndBeyond: charactersDndBeyondRouter,
  sessionTranscription: sessionTranscriptionRouter,
  sessionRecordings: sessionRecordingsRouter,
  transcript: transcriptRouter,
  homebrew: homebrewRouter,
  homebrewDndBeyond: homebrewDndBeyondRouter,
  homebrewPdf: homebrewPdfRouter,
  homebrewExtraction: homebrewExtractionRouter,
  userSettings: userSettingsRouter,
  members: membersRouter,
  invites: invitesRouter,
  onboarding: onboardingRouter,
  feedback: feedbackRouter,
  usage: usageRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
