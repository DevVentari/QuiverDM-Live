import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/server/db';
import { Prisma } from '@prisma/client';

interface ItemToSave {
  name: string;
  type: string;
  description: string;
  properties?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json() as { items: ItemToSave[]; campaignId?: string };
    const { items, campaignId } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    if (campaignId) {
      const membership = await prisma.campaignMember.findFirst({
        where: { campaignId, userId, role: { in: ['OWNER', 'CO_DM', 'PLAYER'] } },
      });
      if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let saved = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const content = await prisma.homebrewContent.create({
          data: {
            userId,
            type: item.type || 'item',
            name: item.name || 'Untitled',
            data: { description: item.description, ...(item.properties ?? {}) } as Prisma.InputJsonValue,
            images: [],
            tags: [item.type || 'item'],
            searchText: `${item.name} ${item.description}`,
            sourceType: 'media_import',
          },
        });
        if (campaignId) {
          await prisma.campaignHomebrewContent.create({
            data: { campaignId, homebrewId: content.id },
          });
        }
        saved++;
      } catch (err: unknown) {
        errors.push(`${item.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({ saved, errors });
  } catch {
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
