import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { chatWithAI } from '@/lib/ai/chat'

const KIND_PROMPTS: Record<
  'npc' | 'location' | 'hook',
  { system: string; user: string }
> = {
  npc: {
    system:
      'You are a master Dungeon Master. Generate a single fresh NPC for a fantasy tabletop RPG. Respond in 4 short sections: Name, Role (one line), Personality (two short sentences), Secret (one sentence). No preamble.',
    user: 'Generate a new NPC.',
  },
  location: {
    system:
      'You are a master Dungeon Master. Generate a single fresh location for a fantasy tabletop RPG. Respond in 4 short sections: Name, Type (one line — village, ruin, forest, etc.), Atmosphere (two short sentences evoking sensory details), Hook (one sentence — what draws PCs here). No preamble.',
    user: 'Generate a new location.',
  },
  hook: {
    system:
      'You are a master Dungeon Master. Generate a single fresh adventure hook for a fantasy tabletop RPG. Respond in 3 short sections: Title, Setup (two short sentences), Twist (one sentence — what is not as it seems). No preamble.',
    user: 'Generate a new adventure hook.',
  },
}

export const randomizerRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        kind: z.enum(['npc', 'location', 'hook']),
        flavor: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const prompt = KIND_PROMPTS[input.kind]
      const userMsg = input.flavor
        ? `${prompt.user} Flavor: ${input.flavor}`
        : prompt.user
      const content = await chatWithAI(
        [
          { role: 'system', content: prompt.system },
          { role: 'user', content: userMsg },
        ],
        {
          temperature: 0.95,
          userId: ctx.session.user.id,
        },
      )
      return { content: content.trim() }
    }),
})
