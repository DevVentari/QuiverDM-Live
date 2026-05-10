import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { searchService } from '../services/search.service';
import { usageService } from '../services/usage.service';
import { prisma } from '@/lib/prisma';
import {
  meiliClient,
  CAMPAIGN_INDEX,
  SESSION_INDEX,
  NPC_INDEX,
  WORLD_ENTITY_INDEX,
  WORLD_ENTRY_INDEX,
  HOMEBREW_INDEX,
} from '@/lib/search';

const GLOBAL_TYPES = [
  'campaign',
  'session',
  'npc',
  'world_entity',
  'world_entry',
  'homebrew',
] as const;

type GlobalType = (typeof GLOBAL_TYPES)[number];

interface GlobalResult {
  type: GlobalType;
  id: string;
  title: string;
  subtitle: string | null;
  campaignId: string | null;
  href: string;
}

function escapeFilterValue(v: string): string {
  return v.replace(/"/g, '\\"');
}

function buildHref(
  type: GlobalType,
  hit: Record<string, unknown>,
  slugByCampaignId: Map<string, string>
): string | null {
  switch (type) {
    case 'campaign': {
      const slug = String(hit.slug ?? '');
      return slug ? `/campaigns/${slug}` : null;
    }
    case 'session': {
      const campaignId = String(hit.campaignId ?? '');
      const slug = slugByCampaignId.get(campaignId);
      const id = String(hit.id ?? '');
      return slug && id ? `/campaigns/${slug}/sessions/${id}` : null;
    }
    case 'npc': {
      const campaignId = String(hit.campaignId ?? '');
      const slug = slugByCampaignId.get(campaignId);
      const id = String(hit.id ?? '');
      return slug && id ? `/campaigns/${slug}/npcs/${id}` : null;
    }
    case 'world_entity': {
      const campaignId = String(hit.campaignId ?? '');
      const slug = slugByCampaignId.get(campaignId);
      const id = String(hit.id ?? '');
      return slug && id ? `/campaigns/${slug}/brain/entities/${id}` : null;
    }
    case 'world_entry': {
      const campaignId = String(hit.campaignId ?? '');
      const slug = slugByCampaignId.get(campaignId);
      const entrySlug = String(hit.slug ?? '');
      return slug && entrySlug ? `/campaigns/${slug}/world/${entrySlug}` : null;
    }
    case 'homebrew': {
      const id = String(hit.id ?? '');
      return id ? `/homebrew/${id}` : null;
    }
  }
}

function snippetFromHit(type: GlobalType, hit: Record<string, unknown>): string | null {
  const pick = (...fields: string[]) => {
    for (const f of fields) {
      const v = hit[f];
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 200);
    }
    return null;
  };
  switch (type) {
    case 'campaign':
      return pick('description');
    case 'session':
      return pick('aiSummary', 'recap', 'playerRecap');
    case 'npc':
      return pick('description', 'faction');
    case 'world_entity':
      return pick('description');
    case 'world_entry':
      return pick('summary', 'content');
    case 'homebrew':
      return pick('searchText');
  }
}

function titleFromHit(type: GlobalType, hit: Record<string, unknown>): string {
  if (type === 'session') {
    const t = typeof hit.title === 'string' && hit.title.trim() ? hit.title : null;
    const num = typeof hit.sessionNumber === 'number' ? hit.sessionNumber : null;
    if (t && num !== null) return `Session ${num} — ${t}`;
    if (t) return t;
    if (num !== null) return `Session ${num}`;
  }
  return typeof hit.name === 'string'
    ? hit.name
    : typeof hit.title === 'string'
      ? hit.title
      : '';
}

export const searchRouter = router({
  semantic: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2).max(500),
        campaignId: z.string(),
        entityTypes: z
          .array(z.enum(['transcript', 'npc', 'quest', 'rules']))
          .optional()
          .default([]),
        limit: z.number().int().min(1).max(20).optional().default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const canSearch = await usageService.canSearch(userId);
      if (!canSearch) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Semantic search limit reached for your tier. Upgrade to Pro for more searches.',
        });
      }

      const results = await searchService.semantic(
        input.query,
        input.campaignId,
        userId,
        input.entityTypes,
        input.limit
      );

      // Fire-and-forget increment (search already ran; don't block on accounting)
      void usageService.incrementSemanticSearches(userId).catch(() => {});

      return results;
    }),

  global: protectedProcedure
    .input(
      z.object({
        q: z.string().min(1).max(200),
        types: z.array(z.enum(GLOBAL_TYPES)).optional(),
        limitPerType: z.number().int().min(1).max(20).optional().default(5),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const requested = new Set<GlobalType>(input.types ?? GLOBAL_TYPES);

      const memberships = await prisma.campaignMember.findMany({
        where: { userId },
        select: { campaignId: true, campaign: { select: { slug: true } } },
      });
      const accessibleCampaignIds = memberships.map((m) => m.campaignId);
      const slugByCampaignId = new Map<string, string>();
      for (const m of memberships) {
        if (m.campaign?.slug) slugByCampaignId.set(m.campaignId, m.campaign.slug);
      }

      if (accessibleCampaignIds.length === 0 && !requested.has('homebrew')) {
        return { results: [] as GlobalResult[], counts: {} as Record<GlobalType, number> };
      }

      const userIdEsc = escapeFilterValue(userId);
      const campaignIdFilter =
        accessibleCampaignIds.length > 0
          ? `campaignId IN [${accessibleCampaignIds.map((id) => `"${escapeFilterValue(id)}"`).join(', ')}]`
          : null;

      const queries: Array<{
        indexUid: string;
        q: string;
        filter: string | null;
        type: GlobalType;
      }> = [];

      if (requested.has('campaign')) {
        queries.push({
          indexUid: CAMPAIGN_INDEX,
          q: input.q,
          filter: `memberUserIds = "${userIdEsc}"`,
          type: 'campaign',
        });
      }
      if (requested.has('session') && campaignIdFilter) {
        queries.push({
          indexUid: SESSION_INDEX,
          q: input.q,
          filter: campaignIdFilter,
          type: 'session',
        });
      }
      if (requested.has('npc') && campaignIdFilter) {
        queries.push({
          indexUid: NPC_INDEX,
          q: input.q,
          filter: campaignIdFilter,
          type: 'npc',
        });
      }
      if (requested.has('world_entity') && campaignIdFilter) {
        queries.push({
          indexUid: WORLD_ENTITY_INDEX,
          q: input.q,
          filter: campaignIdFilter,
          type: 'world_entity',
        });
      }
      if (requested.has('world_entry') && campaignIdFilter) {
        queries.push({
          indexUid: WORLD_ENTRY_INDEX,
          q: input.q,
          filter: campaignIdFilter,
          type: 'world_entry',
        });
      }
      if (requested.has('homebrew')) {
        queries.push({
          indexUid: HOMEBREW_INDEX,
          q: input.q,
          filter: `userId = "${userIdEsc}"`,
          type: 'homebrew',
        });
      }

      if (queries.length === 0) {
        return { results: [] as GlobalResult[], counts: {} as Record<GlobalType, number> };
      }

      let multi: Awaited<ReturnType<typeof meiliClient.multiSearch>>;
      try {
        multi = await meiliClient.multiSearch({
          queries: queries.map(({ indexUid, q, filter }) => ({
            indexUid,
            q,
            filter: filter ?? undefined,
            limit: input.limitPerType,
            attributesToRetrieve: ['*'],
          })),
        });
      } catch (err) {
        console.warn('[search.global] Meili multiSearch failed:', err);
        return { results: [] as GlobalResult[], counts: {} as Record<GlobalType, number> };
      }

      const results: GlobalResult[] = [];
      const counts: Partial<Record<GlobalType, number>> = {};

      multi.results.forEach((res, idx) => {
        const meta = queries[idx];
        if (!meta) return;
        for (const rawHit of res.hits) {
          const hit = rawHit as Record<string, unknown>;
          const href = buildHref(meta.type, hit, slugByCampaignId);
          if (!href) continue;
          const id = String(hit.id ?? '');
          if (!id) continue;
          const campaignId =
            typeof hit.campaignId === 'string' ? hit.campaignId : null;
          results.push({
            type: meta.type,
            id,
            title: titleFromHit(meta.type, hit),
            subtitle: snippetFromHit(meta.type, hit),
            campaignId,
            href,
          });
          counts[meta.type] = (counts[meta.type] ?? 0) + 1;
        }
      });

      return { results, counts: counts as Record<GlobalType, number> };
    }),
});
