import { PrismaClient } from '@prisma/client';

export type Assertion = {
  name: string;
  passed: boolean;
  detail?: string;
};

export function assert(
  assertions: Assertion[],
  name: string,
  condition: boolean,
  detail?: string,
) {
  assertions.push({ name, passed: condition, detail });
  if (!condition) {
    throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
  }
}

export function uniqueId(prefix: string): string {
  const stamp = Date.now();
  const rand = Math.floor(Math.random() * 100000);
  return `${prefix}-${stamp}-${rand}`;
}

export async function createBaseContext(
  prisma: PrismaClient,
  prefix: string,
) {
  const id = uniqueId(prefix);
  const owner = await prisma.user.create({
    data: {
      email: `${id}@workflow.test`,
      name: `${prefix} Owner`,
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      userId: owner.id,
      name: `${prefix} Campaign`,
      slug: id,
      description: `Workflow test campaign for ${prefix}`,
    },
  });

  await prisma.campaignMember.create({
    data: {
      campaignId: campaign.id,
      userId: owner.id,
      role: 'OWNER',
    },
  });

  return { owner, campaign, id };
}

export async function cleanupUser(prisma: PrismaClient, userId: string) {
  await prisma.user.delete({
    where: { id: userId },
  });
}

