import { z } from 'zod';

export const BriefingCardTypeSchema = z.enum(['FACTION', 'NPC', 'HOOK', 'REGION', 'CUSTOM']);

export const MapCoordsSchema = z.object({
  mapId: z.string(),
  x: z.number(),
  y: z.number(),
  placement: z.enum(['auto', 'proposed']),
});

export const BriefingCardSchema = z.object({
  id: z.string(),
  type: BriefingCardTypeSchema,
  entityName: z.string(),
  entityId: z.string().optional(),
  mapCoords: MapCoordsSchema.optional(),
  urgencyLevel: z.number().int().min(1).max(5).default(3),
  context: z.string().default(''),
  proposal: z.string().default(''),
  status: z.enum(['proposed', 'accepted', 'edited', 'dismissed', 'dm-added']).default('proposed'),
  dmNote: z.string().optional(),
});

export type BriefingCard = z.infer<typeof BriefingCardSchema>;
export type BriefingCardType = z.infer<typeof BriefingCardTypeSchema>;
export type MapCoords = z.infer<typeof MapCoordsSchema>;
