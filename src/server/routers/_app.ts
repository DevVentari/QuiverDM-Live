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
import { homebrewImageRouter } from './homebrew-image';
import { whisperRouter } from './whisper';
import { encountersRouter } from './encounters';
import { encounterPlansRouter } from './encounter-plans';
import { extensionAuthRouter } from './extension-auth';
import { rulesRouter } from './rules';
import { webhooksRouter } from './webhooks';
import { searchRouter } from './search';
import { passwordResetRouter } from './password-reset';
import { foundryRouter } from './foundry';
import { obsidianRouter } from './obsidian';
import { apiUsageRouter } from './api-usage';
import { adminUsersRouter } from './admin-users';
import { adminApiUsageRouter } from './admin-api-usage';
import { adminOverviewRouter } from './admin-overview';
import { adminHealthRouter } from './admin-health';
import { brainRouter } from './brain';
import { playRouter } from './play';
import { ddbSyncRouter } from './ddb-sync';
import { sourcebookScenesRouter } from './sourcebook-scenes';
import { multiTrackUploadRouter } from './multi-track-upload';
import { speakerMappingRouter } from './speaker-mapping';
import { recapRouter } from './recap';
import { campaignContextRouter } from './campaign-context';
import { worldMapRouter } from './world-map';
import { worldRouter } from './world';
import { randomizerRouter } from './randomizer';
import { campaignMechanicsRouter } from './campaign-mechanics';
import { sourcebookReaderRouter } from './sourcebook-reader';

export const appRouter = router({
  campaigns: campaignsRouter,
  sessions: sessionsRouter,
  npcs: npcsRouter,
  players: playersRouter,
  characters: charactersRouter,
  charactersDndBeyond: charactersDndBeyondRouter,
  sessionTranscription: sessionTranscriptionRouter,
  sessionRecordings: sessionRecordingsRouter,
  multiTrackUpload: multiTrackUploadRouter,
  speakerMapping: speakerMappingRouter,
  recap: recapRouter,
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
  homebrewImage: homebrewImageRouter,
  whisper: whisperRouter,
  encounters: encountersRouter,
  encounterPlans: encounterPlansRouter,
  extensionAuth: extensionAuthRouter,
  rules: rulesRouter,
  webhooks: webhooksRouter,
  search: searchRouter,
  passwordReset: passwordResetRouter,
  foundry: foundryRouter,
  obsidian: obsidianRouter,
  apiUsage: apiUsageRouter,
  adminOverview: adminOverviewRouter,
  adminUsers: adminUsersRouter,
  adminApiUsage: adminApiUsageRouter,
  adminHealth: adminHealthRouter,
  brain: brainRouter,
  play: playRouter,
  ddbSync: ddbSyncRouter,
  sourcebookScenes: sourcebookScenesRouter,
  campaignContext: campaignContextRouter,
  worldMap: worldMapRouter,
  world: worldRouter,
  randomizer: randomizerRouter,
  mechanics: campaignMechanicsRouter,
  sourcebookReader: sourcebookReaderRouter,
});

export type AppRouter = typeof appRouter;
