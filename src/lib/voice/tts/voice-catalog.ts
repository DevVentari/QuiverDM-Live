import type { NpcVoiceTraits, TtsVoice } from './types';

interface CatalogVoice extends TtsVoice {
  gender: 'male' | 'female' | 'neutral';
  tone: 'deep' | 'warm' | 'bright' | 'gruff' | 'soft';
}

export const STOCK_VOICES: CatalogVoice[] = [
  { voiceId: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (deep, male)',    gender: 'male',    tone: 'deep' },
  { voiceId: 'VR6AewLTigWG4xSOukaG', label: 'Arnold (gruff, male)', gender: 'male',    tone: 'gruff' },
  { voiceId: 'ErXwobaYiN019PkySvjV', label: 'Antoni (warm, male)',  gender: 'male',    tone: 'warm' },
  { voiceId: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh (bright, male)',  gender: 'male',    tone: 'bright' },
  { voiceId: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella (soft, female)', gender: 'female',  tone: 'soft' },
  { voiceId: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli (bright, female)',gender: 'female',  tone: 'bright' },
  { voiceId: 'ThT5KcBeYPX3keUQqHPh', label: 'Dorothy (warm, female)',gender:'female',  tone: 'warm' },
  { voiceId: 'oWAxZDx7w5VEj9dCyTzz', label: 'Grace (deep, female)', gender: 'female',  tone: 'deep' },
  { voiceId: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel (neutral)',     gender: 'neutral', tone: 'warm' },
];

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

function normalizeGender(g?: string): 'male' | 'female' | 'neutral' {
  const v = (g ?? '').toLowerCase();
  if (v.startsWith('m')) return 'male';
  if (v.startsWith('f') || v.startsWith('w')) return 'female';
  return 'neutral';
}

function preferredTone(traits: NpcVoiceTraits): CatalogVoice['tone'] {
  const blob = `${traits.role ?? ''} ${traits.personality ?? ''} ${traits.race ?? ''}`.toLowerCase();
  if (/villain|threat|tyrant|warlord|orc|demon|undead/.test(blob)) return 'gruff';
  if (/king|lord|noble|wizard|elder|ancient/.test(blob)) return 'deep';
  if (/merchant|child|fey|sprite|bard/.test(blob)) return 'bright';
  if (/healer|priest|mother|caretaker/.test(blob)) return 'soft';
  return 'warm';
}

export function assignVoice(traits: NpcVoiceTraits): string {
  const gender = normalizeGender(traits.gender);
  const tone = preferredTone(traits);

  const exact = STOCK_VOICES.find((v) => v.gender === gender && v.tone === tone);
  if (exact) return exact.voiceId;

  const byGender = STOCK_VOICES.filter((v) => v.gender === gender);
  if (byGender.length > 0) return byGender[0].voiceId;

  return DEFAULT_VOICE_ID;
}
