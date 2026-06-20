import { Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'demo@quiverdm.com';
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'demo1234';

export async function signInAsTestUser(page: Page, email?: string, password?: string) {
  const e = email ?? TEST_USER_EMAIL;
  const p = password ?? TEST_USER_PASSWORD;
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(e);
  await page.getByLabel(/password/i).fill(p);
  await page.getByRole('button', { name: /sign in|enter the realm/i }).click();
  try {
    await page.waitForURL(/dashboard|onboarding|campaigns|characters|homebrew|settings|members/, {
      timeout: 15000,
    });
  } catch {
    const alertText = await page
      .locator('[role="alert"], .text-destructive')
      .first()
      .textContent()
      .catch(() => null);
    const details = alertText?.trim() || 'No auth error banner found.';
    throw new Error(`Sign-in did not redirect for ${e}. URL=${page.url()}. ${details}`);
  }
}

export async function loginAsSeededDm(page: Page) {
  await signInAsTestUser(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
}

export async function ensureTestUserExists(
  email = TEST_USER_EMAIL,
  password = TEST_USER_PASSWORD,
): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email },
    update: { onboardingCompleted: true },
    create: { email, name: 'Test User', onboardingCompleted: true },
  });
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.account.findFirst({
    where: { userId: user.id, provider: 'credentials' },
  });
  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: { password: passwordHash, providerAccountId: email },
    });
  } else {
    await prisma.account.create({
      data: {
        userId: user.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: email,
        password: passwordHash,
      },
    });
  }
}

export async function ensureTestCampaignExists(
  email: string,
  slug: string,
  name: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`ensureTestCampaignExists: user ${email} not found — call ensureTestUserExists first`);
  const campaign = await prisma.campaign.upsert({
    where: { slug },
    update: { name },
    create: { userId: user.id, slug, name, status: 'active' },
  });
  const existing = await prisma.campaignMember.findFirst({
    where: { campaignId: campaign.id, userId: user.id },
  });
  if (!existing) {
    await prisma.campaignMember.create({
      data: { campaignId: campaign.id, userId: user.id, role: 'OWNER' },
    });
  }
}

/**
 * Seeds an in-progress GameSession with prepared scenes so the live cockpit
 * (`/sessions/[id]/live`) renders a real scene runner. Returns the session id
 * and slug so tests navigate straight to the cockpit instead of hunting for a
 * `/live` link the sessions list never renders.
 *
 * Seeds >= 2 scenes so scene-navigation assertions have somewhere to advance to.
 */
export async function seedLiveSession(
  email: string,
  slug: string,
  opts: { sessionNumber?: number; title?: string } = {},
): Promise<{ sessionId: string; slug: string; campaignId: string; sceneCount: number }> {
  await ensureTestCampaignExists(email, slug, opts.title ?? 'Live Session Campaign');
  const campaign = await prisma.campaign.findUnique({ where: { slug } });
  if (!campaign) throw new Error(`seedLiveSession: campaign ${slug} not found after ensure`);

  const sessionNumber = opts.sessionNumber ?? 900;
  const scenes = [
    {
      id: nanoid(10),
      title: 'The Sleeping Giant Tap House',
      description: 'The party arrives at the rundown tavern on the edge of Phandalin.',
      location: 'Phandalin',
      readAloud:
        'The door groans open. A handful of rough-looking patrons turn to glare, hands drifting toward their belts.',
      order: 0,
      linkedNpcIds: [],
      linkedSecretIds: [],
      linkedMonsterNames: [],
    },
    {
      id: nanoid(10),
      title: 'The Redbrand Hideout',
      description: 'Beneath Tresendar Manor, the Redbrands have made their lair.',
      location: 'Tresendar Manor cellars',
      readAloud:
        'Cold air rises from the stone stairwell. Somewhere below, water drips in the dark.',
      order: 1,
      linkedNpcIds: [],
      linkedSecretIds: [],
      linkedMonsterNames: [],
    },
  ];

  const prepData = {
    scenes,
  } as unknown as Prisma.InputJsonValue;

  const session = await prisma.gameSession.upsert({
    where: { campaignId_sessionNumber: { campaignId: campaign.id, sessionNumber } },
    update: {
      title: opts.title ?? 'Live Session — Scene Runner',
      status: 'in_progress',
      startedAt: new Date(),
      prepStatus: 'complete',
      activeSceneIndex: 0,
      prepData,
    },
    create: {
      campaignId: campaign.id,
      sessionNumber,
      title: opts.title ?? 'Live Session — Scene Runner',
      status: 'in_progress',
      startedAt: new Date(),
      prepStatus: 'complete',
      activeSceneIndex: 0,
      prepData,
    },
  });

  return { sessionId: session.id, slug, campaignId: campaign.id, sceneCount: scenes.length };
}

export async function seedCampaignWithSourcebook(
  opts: { withEntity?: boolean; withEmptyChapter?: boolean } = {},
) {
  const suffix = nanoid(8).toLowerCase();
  const dm = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: {
      name: 'Demo DM',
      onboardingCompleted: true,
    },
    create: {
      email: TEST_USER_EMAIL,
      name: 'Demo DM',
      onboardingCompleted: true,
    },
  });

  const passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, 10);
  const account = await prisma.account.findFirst({
    where: { userId: dm.id, provider: 'credentials' },
  });
  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        providerAccountId: TEST_USER_EMAIL,
        type: 'credentials',
        password: passwordHash,
      },
    });
  } else {
    await prisma.account.create({
      data: {
        userId: dm.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: TEST_USER_EMAIL,
        password: passwordHash,
      },
    });
  }

  const campaignSlug = `sourcebook-reader-${suffix}`;
  const campaign = await prisma.campaign.upsert({
    where: { slug: campaignSlug },
    update: {
      userId: dm.id,
      name: `Sourcebook Reader ${suffix}`,
      status: 'active',
    },
    create: {
      userId: dm.id,
      slug: campaignSlug,
      name: `Sourcebook Reader ${suffix}`,
      description: 'Workflow fixture for the sourcebook reader.',
      status: 'active',
    },
  });

  const ownerMembership = await prisma.campaignMember.findFirst({
    where: { campaignId: campaign.id, userId: dm.id },
  });
  if (!ownerMembership) {
    await prisma.campaignMember.create({
      data: {
        campaignId: campaign.id,
        userId: dm.id,
        role: 'OWNER',
      },
    });
  }

  const entitlementSlug = `sourcebook-reader-entitlement-${suffix}`;
  const entitlement = await prisma.ddbEntitlement.upsert({
    where: { userId_slug: { userId: dm.id, slug: entitlementSlug } },
    update: {
      title: `Sourcebook Reader Entitlement ${suffix}`,
      accessType: 'owned',
      sourceUrl: 'https://www.dndbeyond.com/sources/test-book',
    },
    create: {
      userId: dm.id,
      slug: entitlementSlug,
      title: `Sourcebook Reader Entitlement ${suffix}`,
      accessType: 'owned',
      sourceUrl: 'https://www.dndbeyond.com/sources/test-book',
    },
  });

  const bookSlug = `sourcebook-reader-book-${suffix}`;
  const sourcebook = await prisma.ddbSourcebook.upsert({
    where: { userId_slug: { userId: dm.id, slug: bookSlug } },
    update: {
      title: `Sourcebook Reader Book ${suffix}`,
      campaignIds: [campaign.id],
    },
    create: {
      userId: dm.id,
      entitlementId: entitlement.id,
      slug: bookSlug,
      title: `Sourcebook Reader Book ${suffix}`,
      campaignIds: [campaign.id],
    },
  });

  const existingLink = await prisma.campaignSourcebook.findFirst({
    where: { campaignId: campaign.id, sourcebookId: sourcebook.id },
  });
  if (!existingLink) {
    await prisma.campaignSourcebook.create({
      data: {
        campaignId: campaign.id,
        sourcebookId: sourcebook.id,
      },
    });
  }

  const firstChapterSlug = `intro-${suffix}`;
  const secondChapterSlug = `chapter-two-${suffix}`;
  const emptyChapterSlug = `chapter-empty-${suffix}`;

  const firstChapterBody = [
    {
      heading: 'Intro',
      level: 2,
      markdown: opts.withEntity
        ? 'Welcome to the test chapter. Sildar awaits.'
        : 'Welcome to the test chapter. This chapter is ready.',
    },
  ] satisfies Array<{ heading: string | null; level: number; markdown: string }>;

  await prisma.ddbSourcebookChapter.upsert({
    where: { sourcebookId_slug: { sourcebookId: sourcebook.id, slug: firstChapterSlug } },
    update: {
      title: firstChapterSlug,
      chapterIndex: 0,
      bodySections: firstChapterBody as unknown as Prisma.InputJsonValue,
      bodySyncedAt: new Date(),
      contentHash: `hash-${suffix}-1`,
      syncStatus: 'idle',
      hasPendingChanges: false,
      pendingChanges: Prisma.JsonNull,
      lastSyncedAt: new Date(),
    },
    create: {
      sourcebookId: sourcebook.id,
      slug: firstChapterSlug,
      title: firstChapterSlug,
      chapterIndex: 0,
      bodySections: firstChapterBody as unknown as Prisma.InputJsonValue,
      bodySyncedAt: new Date(),
      contentHash: `hash-${suffix}-1`,
      syncStatus: 'idle',
      hasPendingChanges: false,
      pendingChanges: Prisma.JsonNull,
      lastSyncedAt: new Date(),
    },
  });

  await prisma.ddbSourcebookChapter.upsert({
    where: { sourcebookId_slug: { sourcebookId: sourcebook.id, slug: secondChapterSlug } },
    update: {
      title: secondChapterSlug,
      chapterIndex: 1,
      bodySections: [
        {
          heading: 'The Road',
          level: 2,
          markdown: 'The road stretches on and the party keeps moving.',
        },
      ] as unknown as Prisma.InputJsonValue,
      bodySyncedAt: new Date(),
      contentHash: `hash-${suffix}-2`,
      syncStatus: 'idle',
      hasPendingChanges: false,
      pendingChanges: Prisma.JsonNull,
      lastSyncedAt: new Date(),
    },
    create: {
      sourcebookId: sourcebook.id,
      slug: secondChapterSlug,
      title: secondChapterSlug,
      chapterIndex: 1,
      bodySections: [
        {
          heading: 'The Road',
          level: 2,
          markdown: 'The road stretches on and the party keeps moving.',
        },
      ] as unknown as Prisma.InputJsonValue,
      bodySyncedAt: new Date(),
      contentHash: `hash-${suffix}-2`,
      syncStatus: 'idle',
      hasPendingChanges: false,
      pendingChanges: Prisma.JsonNull,
      lastSyncedAt: new Date(),
    },
  });

  if (opts.withEmptyChapter) {
    await prisma.ddbSourcebookChapter.upsert({
      where: { sourcebookId_slug: { sourcebookId: sourcebook.id, slug: emptyChapterSlug } },
      update: {
        title: emptyChapterSlug,
        chapterIndex: 2,
        bodySections: Prisma.JsonNull,
        bodySyncedAt: null,
        contentHash: `hash-${suffix}-3`,
        syncStatus: 'idle',
        hasPendingChanges: false,
        pendingChanges: Prisma.JsonNull,
        lastSyncedAt: new Date(),
      },
      create: {
        sourcebookId: sourcebook.id,
        slug: emptyChapterSlug,
        title: emptyChapterSlug,
        chapterIndex: 2,
        bodySections: Prisma.JsonNull,
        bodySyncedAt: null,
        contentHash: `hash-${suffix}-3`,
        syncStatus: 'idle',
        hasPendingChanges: false,
        pendingChanges: Prisma.JsonNull,
        lastSyncedAt: new Date(),
      },
    });
  }

  if (opts.withEntity) {
    await prisma.sourcebookEntity.upsert({
      where: {
        sourcebookId_type_name: {
          sourcebookId: sourcebook.id,
          type: 'NPC',
          name: 'Sildar',
        },
      },
      update: {
        aliases: [],
        description: 'Sword of veteran tone.',
        imageUrl: null,
        properties: {},
      },
      create: {
        sourcebookId: sourcebook.id,
        chapterId: null,
        type: 'NPC',
        name: 'Sildar',
        aliases: [],
        description: 'Sword of veteran tone.',
        imageUrl: null,
        properties: {},
      },
    });
  }

  return {
    campaignSlug,
    bookSlug,
    firstChapterSlug,
    secondChapterSlug,
    ...(opts.withEmptyChapter ? { emptyChapterSlug } : {}),
    ...(opts.withEntity ? { chapterWithEntity: firstChapterSlug, entityName: 'Sildar' } : {}),
  };
}
