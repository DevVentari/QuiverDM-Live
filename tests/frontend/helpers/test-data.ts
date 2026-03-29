import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { FRONTEND_TEST_EMAIL, FRONTEND_TEST_PASSWORD } from './auth';

const prisma = new PrismaClient();

export type FrontendFixture = {
  userId: string;
  campaignSlug: string;
  campaignId: string;
  sessionId: string;
};

export async function ensureFrontendFixture(): Promise<FrontendFixture> {
  const passwordHash = await bcrypt.hash(FRONTEND_TEST_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: FRONTEND_TEST_EMAIL },
    update: {
      name: 'Frontend Cert User',
      onboardingCompleted: true,
    },
    create: {
      email: FRONTEND_TEST_EMAIL,
      name: 'Frontend Cert User',
      onboardingCompleted: true,
    },
  });

  const credentialsAccount = await prisma.account.findFirst({
    where: {
      userId: user.id,
      provider: 'credentials',
    },
  });

  if (credentialsAccount) {
    await prisma.account.update({
      where: { id: credentialsAccount.id },
      data: {
        password: passwordHash,
        providerAccountId: FRONTEND_TEST_EMAIL,
        type: 'credentials',
      },
    });
  } else {
    await prisma.account.create({
      data: {
        userId: user.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: FRONTEND_TEST_EMAIL,
        password: passwordHash,
      },
    });
  }

  const campaignSlug = 'frontend-cert-campaign';
  const campaign = await prisma.campaign.upsert({
    where: { slug: campaignSlug },
    update: {
      userId: user.id,
      name: 'Frontend Certification Campaign',
      status: 'active',
    },
    create: {
      userId: user.id,
      slug: campaignSlug,
      name: 'Frontend Certification Campaign',
      description: 'Campaign fixture for Playwright workflow certification.',
      status: 'active',
    },
  });

  const ownerMembership = await prisma.campaignMember.findFirst({
    where: {
      campaignId: campaign.id,
      userId: user.id,
    },
  });
  if (!ownerMembership) {
    await prisma.campaignMember.create({
      data: {
        campaignId: campaign.id,
        userId: user.id,
        role: 'OWNER',
      },
    });
  }

  let session = await prisma.gameSession.findFirst({
    where: {
      campaignId: campaign.id,
      sessionNumber: 1,
    },
  });
  if (!session) {
    session = await prisma.gameSession.create({
      data: {
        campaignId: campaign.id,
        sessionNumber: 1,
        title: 'Frontend Certification Session',
        status: 'active',
      },
    });
  }

  const transcript = await prisma.transcript.findFirst({
    where: {
      sessionId: session.id,
    },
  });
  if (!transcript) {
    await prisma.transcript.create({
      data: {
        sessionId: session.id,
        rawText: 'DM: Frontend workflow transcript fixture.',
        correctedText: 'DM: Frontend workflow transcript fixture.',
        hasSpeakers: true,
      },
    });
  }

  const character = await prisma.character.findFirst({
    where: {
      userId: user.id,
      name: 'Frontend Cert Hero',
    },
  });
  if (!character) {
    await prisma.character.create({
      data: {
        userId: user.id,
        name: 'Frontend Cert Hero',
        class: 'Fighter',
        level: 2,
      },
    });
  }

  const homebrew = await prisma.homebrewContent.findFirst({
    where: {
      userId: user.id,
      name: 'Frontend Cert Item',
      type: 'item',
    },
  });
  if (!homebrew) {
    await prisma.homebrewContent.create({
      data: {
        userId: user.id,
        type: 'item',
        name: 'Frontend Cert Item',
        data: {
          description: 'Fixture item for frontend workflow checks.',
          rarity: 'common',
        },
        searchText: 'frontend cert item fixture',
        tags: ['fixture'],
        images: [],
      },
    });
  }

  const pdf = await prisma.homebrewPDF.findFirst({
    where: {
      userId: user.id,
      filename: 'frontend-cert.pdf',
    },
  });
  if (!pdf) {
    await prisma.homebrewPDF.create({
      data: {
        userId: user.id,
        campaignId: campaign.id,
        filename: 'frontend-cert.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        r2Url: 'fixtures/frontend-cert.pdf',
        processingStatus: 'completed',
        markdownContent: '# Frontend Cert PDF\nFixture content.',
        markerProcessed: true,
      },
    });
  }

  return {
    userId: user.id,
    campaignSlug,
    campaignId: campaign.id,
    sessionId: session.id,
  };
}

