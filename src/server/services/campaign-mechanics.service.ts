import { prisma } from '@/lib/prisma';
import { authz } from './authorization.service';
import { NotFoundError, ValidationError } from '../errors';
import { contentSchemaFor, stripHiddenContent } from '@/lib/mechanics-content';

interface ListInput {
  campaignId: string;
  kind?: string;
  sourcebook?: string;
}

interface CreateInput {
  campaignId: string;
  kind: string;
  name: string;
  description?: string;
  content: unknown;
  sourcebook?: string;
  externalKey?: string;
  playerVisible?: boolean;
}

interface UpdateInput {
  id: string;
  name?: string;
  description?: string;
  content?: unknown;
  playerVisible?: boolean;
}

async function viewerCanSeeHidden(
  mechanic: { campaignId: string; assignedToCharacterId: string | null; playerVisible: boolean },
  userId: string,
): Promise<boolean> {
  const access = await authz.campaign(mechanic.campaignId, userId).verify();
  if (access.isDM) return true;
  if (!mechanic.assignedToCharacterId || !mechanic.playerVisible) return false;
  const ownsCharacter = await prisma.campaignCharacter.findFirst({
    where: {
      id: mechanic.assignedToCharacterId,
      character: { userId },
    },
    select: { id: true },
  });
  return !!ownsCharacter;
}

export const campaignMechanicsService = {
  async list({ campaignId, kind, sourcebook }: ListInput, userId: string) {
    const access = await authz.campaign(campaignId, userId).verify();
    const rows = await prisma.campaignMechanic.findMany({
      where: {
        campaignId,
        ...(kind ? { kind } : {}),
        ...(sourcebook ? { sourcebook } : {}),
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => ({
      ...row,
      content: stripHiddenContent(row.kind, row.content, access.isDM),
    }));
  },

  async getById(id: string, userId: string) {
    const row = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('campaignMechanic', id);
    const canSeeHidden = await viewerCanSeeHidden(row, userId);
    return { ...row, content: stripHiddenContent(row.kind, row.content, canSeeHidden) };
  },

  async create(input: CreateInput, userId: string) {
    await authz.campaign(input.campaignId, userId).requireDM();
    const schema = contentSchemaFor(input.kind);
    const parsed = schema.safeParse(input.content);
    if (!parsed.success) {
      throw ValidationError.forField(
        'content',
        `Invalid content shape for kind '${input.kind}': ${parsed.error.message}`,
      );
    }
    return prisma.campaignMechanic.create({
      data: {
        campaignId: input.campaignId,
        kind: input.kind,
        name: input.name,
        description: input.description ?? null,
        content: parsed.data as object,
        sourcebook: input.sourcebook ?? null,
        externalKey: input.externalKey ?? null,
        playerVisible: input.playerVisible ?? false,
      },
    });
  },

  async update({ id, ...patch }: UpdateInput, userId: string) {
    const existing = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('campaignMechanic', id);
    await authz.campaign(existing.campaignId, userId).requireDM();

    let nextContent: unknown = existing.content;
    if (patch.content !== undefined) {
      const schema = contentSchemaFor(existing.kind);
      const parsed = schema.safeParse(patch.content);
      if (!parsed.success) {
        throw ValidationError.forField(
          'content',
          `Invalid content shape: ${parsed.error.message}`,
        );
      }
      nextContent = parsed.data;
    }

    return prisma.campaignMechanic.update({
      where: { id },
      data: {
        name: patch.name ?? existing.name,
        description: patch.description ?? existing.description,
        content: nextContent as object,
        playerVisible: patch.playerVisible ?? existing.playerVisible,
      },
    });
  },

  async delete(id: string, userId: string) {
    const existing = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('campaignMechanic', id);
    await authz.campaign(existing.campaignId, userId).requireDM();
    await prisma.campaignMechanic.delete({ where: { id } });
    return { ok: true };
  },

  async assignToCharacter(id: string, characterId: string | null, userId: string) {
    const existing = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('campaignMechanic', id);
    await authz.campaign(existing.campaignId, userId).requireDM();
    if (characterId) {
      const character = await prisma.campaignCharacter.findFirst({
        where: { id: characterId, campaignId: existing.campaignId },
        select: { id: true },
      });
      if (!character) {
        throw new NotFoundError('campaignCharacter', characterId);
      }
    }
    return prisma.campaignMechanic.update({
      where: { id },
      data: { assignedToCharacterId: characterId },
    });
  },

  async markRevealed(id: string, sessionId: string, userId: string) {
    const existing = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('campaignMechanic', id);
    await authz.campaign(existing.campaignId, userId).requireDM();
    return prisma.campaignMechanic.update({
      where: { id },
      data: { revealedAtSessionId: sessionId, playerVisible: true },
    });
  },
};

