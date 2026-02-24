import { describe, it, expect } from 'vitest';

/**
 * Unit tests for NPC business logic and validation rules.
 * These test the validation constraints and data-shaping logic
 * without hitting the database. DB-level tests require integration setup.
 */

// Mirror the Zod schema used in src/server/routers/npcs.ts
import { z } from 'zod';

const NpcCreateSchema = z.object({
  campaignId: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  faction: z.string().optional(),
  secrets: z.string().optional(),
  imageUrl: z.string().optional(),
});

const NpcUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  faction: z.string().optional(),
  secrets: z.string().optional(),
  imageUrl: z.string().optional(),
});

describe('NPC create schema validation', () => {
  it('accepts valid NPC create payload', () => {
    const result = NpcCreateSchema.safeParse({
      campaignId: 'campaign-1',
      name: 'Garrek the Bold',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = NpcCreateSchema.safeParse({
      campaignId: 'campaign-1',
      name: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/required/i);
  });

  it('rejects missing name', () => {
    const result = NpcCreateSchema.safeParse({
      campaignId: 'campaign-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing campaignId', () => {
    const result = NpcCreateSchema.safeParse({ name: 'Garrek' });
    expect(result.success).toBe(false);
  });

  it('accepts NPC with all optional fields', () => {
    const result = NpcCreateSchema.safeParse({
      campaignId: 'campaign-1',
      name: 'Garrek the Bold',
      description: 'A fierce warrior',
      faction: 'Iron Brotherhood',
      secrets: 'Works for the Shadow King',
      imageUrl: 'https://example.com/garrek.png',
    });
    expect(result.success).toBe(true);
  });

  it('accepts NPC description with HTML content (not sanitized at router level)', () => {
    const result = NpcCreateSchema.safeParse({
      campaignId: 'campaign-1',
      name: 'Garrek',
      description: '<p>A <strong>fierce</strong> warrior</p>',
    });
    expect(result.success).toBe(true); // Sanitization is display concern
  });

  it('accepts single-character name', () => {
    const result = NpcCreateSchema.safeParse({ campaignId: 'c1', name: 'X' });
    expect(result.success).toBe(true);
  });

  it('accepts name at 255 characters', () => {
    const result = NpcCreateSchema.safeParse({
      campaignId: 'c1',
      name: 'A'.repeat(255),
    });
    // Current schema has no max — should pass
    expect(result.success).toBe(true);
  });
});

describe('NPC update schema validation', () => {
  it('accepts partial update with only name', () => {
    const result = NpcUpdateSchema.safeParse({ id: 'npc-1', name: 'Updated Name' });
    expect(result.success).toBe(true);
  });

  it('rejects update with empty name (when name is provided)', () => {
    const result = NpcUpdateSchema.safeParse({ id: 'npc-1', name: '' });
    expect(result.success).toBe(false);
  });

  it('accepts update with only description (name not required in update)', () => {
    const result = NpcUpdateSchema.safeParse({ id: 'npc-1', description: 'New description' });
    expect(result.success).toBe(true);
  });

  it('accepts no-op update (only id)', () => {
    const result = NpcUpdateSchema.safeParse({ id: 'npc-1' });
    expect(result.success).toBe(true);
  });
});

describe('NPC data shaping', () => {
  it('optional description defaults to undefined when not provided', () => {
    const result = NpcCreateSchema.parse({ campaignId: 'c1', name: 'Garrek' });
    expect(result.description).toBeUndefined();
  });

  it('optional fields are stripped when undefined', () => {
    const result = NpcCreateSchema.parse({ campaignId: 'c1', name: 'Garrek' });
    expect(result).not.toHaveProperty('faction');
    expect(result).not.toHaveProperty('secrets');
  });
});
