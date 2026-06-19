import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { assignVoice } from '@/lib/voice/tts/voice-catalog';
import { isTtsConfigured } from '@/lib/voice/tts';
import { addVoiceGenerationJob } from '@/lib/queue/voice-generation-queue';
import type { NpcVoiceTraits, VoiceProfile } from '@/lib/voice/tts/types';

interface EntityLike {
  type?: string;
  name: string;
  description?: string | null;
  properties?: Record<string, unknown> | null;
}

const ARCHETYPE_LINES: Record<string, string> = {
  villain: 'You should not have come here.',
  merchant: 'Looking to buy? I have just the thing.',
  default: 'Well met, traveler.',
};

export function deriveTraits(entity: EntityLike): NpcVoiceTraits {
  const props = (entity.properties ?? {}) as Record<string, unknown>;
  return {
    gender: typeof props.gender === 'string' ? props.gender : undefined,
    race: typeof props.race === 'string' ? props.race : undefined,
    role: typeof props.role === 'string' ? props.role : undefined,
    personality: `${entity.description ?? ''} ${String(props.personality ?? '')}`.trim() || undefined,
  };
}

export function buildSignatureText(entity: EntityLike): string {
  const desc = (entity.description ?? '').trim();
  if (desc) {
    const firstSentence = desc.split(/(?<=[.!?])\s/)[0]?.trim();
    if (firstSentence && firstSentence.length <= 160) return firstSentence;
  }
  const props = (entity.properties ?? {}) as Record<string, unknown>;
  const role = typeof props.role === 'string' ? props.role.toLowerCase() : 'default';
  return ARCHETYPE_LINES[role] ?? ARCHETYPE_LINES.default;
}

function readVoiceProfile(properties: unknown): VoiceProfile | null {
  const p = (properties ?? {}) as Record<string, unknown>;
  return (p.voiceProfile as VoiceProfile) ?? null;
}

/**
 * Ensure an NPC entity has a voice profile + a pending signature clip.
 * Idempotent: skips if a voiceProfile already exists.
 */
export async function ensureSignatureForEntity(entityId: string): Promise<void> {
  const entity = await prisma.worldEntity.findUnique({
    where: { id: entityId },
    select: { id: true, type: true, name: true, description: true, properties: true, campaignId: true },
  });
  if (!entity || entity.type !== 'NPC') return;
  if (readVoiceProfile(entity.properties)) return; // already assigned

  const traits = deriveTraits(entity as EntityLike);
  const voiceId = assignVoice(traits);
  const profile: VoiceProfile = { provider: 'elevenlabs', voiceId, assignedBy: 'brain' };

  await prisma.worldEntity.update({
    where: { id: entity.id },
    data: { properties: { ...(entity.properties as Prisma.JsonObject), voiceProfile: profile as unknown as Prisma.InputJsonValue } },
  });

  const clip = await prisma.voiceClip.create({
    data: {
      campaignId: entity.campaignId,
      entityId: entity.id,
      kind: 'signature',
      text: buildSignatureText(entity as EntityLike),
      voiceId,
      provider: 'elevenlabs',
      status: 'pending',
    },
  });

  if (isTtsConfigured()) {
    await addVoiceGenerationJob({ clipId: clip.id });
  }
}

export async function getClipsForEntity(entityId: string) {
  return prisma.voiceClip.findMany({
    where: { entityId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function regenerateSignature(entityId: string): Promise<void> {
  const entity = await prisma.worldEntity.findUnique({
    where: { id: entityId },
    select: { id: true, type: true, name: true, description: true, properties: true, campaignId: true },
  });
  if (!entity) return;
  const profile = readVoiceProfile(entity.properties);
  const voiceId = profile?.voiceId ?? assignVoice(deriveTraits(entity as EntityLike));

  const clip = await prisma.voiceClip.create({
    data: {
      campaignId: entity.campaignId,
      entityId: entity.id,
      kind: 'signature',
      text: buildSignatureText(entity as EntityLike),
      voiceId,
      provider: 'elevenlabs',
      status: 'pending',
    },
  });
  if (isTtsConfigured()) await addVoiceGenerationJob({ clipId: clip.id });
}

export async function reassignVoice(entityId: string, voiceId: string): Promise<void> {
  const entity = await prisma.worldEntity.findUnique({
    where: { id: entityId }, select: { id: true, properties: true },
  });
  if (!entity) return;
  const profile: VoiceProfile = { provider: 'elevenlabs', voiceId, assignedBy: 'dm' };
  await prisma.worldEntity.update({
    where: { id: entityId },
    data: { properties: { ...(entity.properties as Prisma.JsonObject), voiceProfile: profile as unknown as Prisma.InputJsonValue } },
  });
  await regenerateSignature(entityId);
}
