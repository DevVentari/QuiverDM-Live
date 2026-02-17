# Codex Task: Homebrew → Character Linking

## Objective
Enable users to link extracted homebrew content (items, spells, feats) from PDFs directly to their characters.

## Context
- Schema has `HomebrewContent` model with 11 types (item, spell, feat, etc.)
- Schema has `Character` model for player-owned characters
- Legacy `Player` model has `PlayerItem`, `PlayerSpell`, `PlayerFeat` join tables
- **Problem**: No join tables exist between `Character` ↔ homebrew content
- Current routers: `src/server/routers/characters.ts`, `src/server/routers/homebrew.ts`

## Implementation Tasks

### Phase 1: Database Schema (MUST DO FIRST)

**File**: `prisma/schema.prisma`

Add three new join tables:

```prisma
// Join table: Character has many Items (from Homebrew)
model CharacterItem {
  id              String          @id @default(cuid())
  characterId     String
  character       Character       @relation(fields: [characterId], references: [id], onDelete: Cascade)
  homebrewId      String
  homebrew        HomebrewContent @relation(fields: [homebrewId], references: [id], onDelete: Cascade)

  quantity        Int             @default(1)
  equipped        Boolean         @default(false)
  attuned         Boolean         @default(false)
  notes           String?         @db.Text
  addedAt         DateTime        @default(now())

  @@unique([characterId, homebrewId])
  @@index([characterId])
  @@index([homebrewId])
}

// Join table: Character has many Spells (from Homebrew)
model CharacterSpell {
  id              String          @id @default(cuid())
  characterId     String
  character       Character       @relation(fields: [characterId], references: [id], onDelete: Cascade)
  homebrewId      String
  homebrew        HomebrewContent @relation(fields: [homebrewId], references: [id], onDelete: Cascade)

  prepared        Boolean         @default(false)
  alwaysPrepared  Boolean         @default(false)
  addedAt         DateTime        @default(now())

  @@unique([characterId, homebrewId])
  @@index([characterId])
  @@index([homebrewId])
}

// Join table: Character has many Feats (from Homebrew)
model CharacterFeat {
  id              String          @id @default(cuid())
  characterId     String
  character       Character       @relation(fields: [characterId], references: [id], onDelete: Cascade)
  homebrewId      String
  homebrew        HomebrewContent @relation(fields: [homebrewId], references: [id], onDelete: Cascade)

  addedAt         DateTime        @default(now())

  @@unique([characterId, homebrewId])
  @@index([characterId])
  @@index([homebrewId])
}
```

Update `Character` model to add relations:
```prisma
model Character {
  // ... existing fields ...

  // Homebrew content links
  homebrewItems   CharacterItem[]
  homebrewSpells  CharacterSpell[]
  homebrewFeats   CharacterFeat[]

  // ... rest of model ...
}
```

Update `HomebrewContent` model to add relations:
```prisma
model HomebrewContent {
  // ... existing fields ...

  // Character links
  characterItems  CharacterItem[]
  characterSpells CharacterSpell[]
  characterFeats  CharacterFeat[]

  // ... rest of model ...
}
```

**After editing schema**:
```bash
npm run db:push
```

---

### Phase 2: Backend tRPC Procedures

**File**: `src/server/routers/characters.ts`

Add these new procedures to the `charactersRouter`:

```typescript
/**
 * Add homebrew item to character
 */
addHomebrewItem: protectedProcedure
  .input(
    z.object({
      characterId: z.string(),
      homebrewId: z.string(),
      quantity: z.number().min(1).default(1),
      equipped: z.boolean().default(false),
      attuned: z.boolean().default(false),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // 1. Verify character ownership
    const character = await ctx.prisma.character.findUnique({
      where: { id: input.characterId },
    });

    if (!character) {
      throw new NotFoundError('character', input.characterId);
    }

    if (character.userId !== ctx.session.user.id) {
      throw ForbiddenError.forPermission('edit', 'Character');
    }

    // 2. Verify homebrew exists and is type='item'
    const homebrew = await ctx.prisma.homebrewContent.findUnique({
      where: { id: input.homebrewId },
    });

    if (!homebrew) {
      throw new NotFoundError('homebrew', input.homebrewId);
    }

    if (homebrew.type !== 'item') {
      throw new ValidationError('Only items can be added to inventory');
    }

    // 3. Create or update CharacterItem
    const characterItem = await ctx.prisma.characterItem.upsert({
      where: {
        characterId_homebrewId: {
          characterId: input.characterId,
          homebrewId: input.homebrewId,
        },
      },
      update: {
        quantity: input.quantity,
        equipped: input.equipped,
        attuned: input.attuned,
      },
      create: {
        characterId: input.characterId,
        homebrewId: input.homebrewId,
        quantity: input.quantity,
        equipped: input.equipped,
        attuned: input.attuned,
      },
      include: {
        homebrew: true,
      },
    });

    return characterItem;
  }),

/**
 * Add homebrew spell to character
 */
addHomebrewSpell: protectedProcedure
  .input(
    z.object({
      characterId: z.string(),
      homebrewId: z.string(),
      prepared: z.boolean().default(false),
      alwaysPrepared: z.boolean().default(false),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // 1. Verify character ownership
    const character = await ctx.prisma.character.findUnique({
      where: { id: input.characterId },
    });

    if (!character) {
      throw new NotFoundError('character', input.characterId);
    }

    if (character.userId !== ctx.session.user.id) {
      throw ForbiddenError.forPermission('edit', 'Character');
    }

    // 2. Verify homebrew exists and is type='spell'
    const homebrew = await ctx.prisma.homebrewContent.findUnique({
      where: { id: input.homebrewId },
    });

    if (!homebrew) {
      throw new NotFoundError('homebrew', input.homebrewId);
    }

    if (homebrew.type !== 'spell') {
      throw new ValidationError('Only spells can be added to spellbook');
    }

    // 3. Create or update CharacterSpell
    const characterSpell = await ctx.prisma.characterSpell.upsert({
      where: {
        characterId_homebrewId: {
          characterId: input.characterId,
          homebrewId: input.homebrewId,
        },
      },
      update: {
        prepared: input.prepared,
        alwaysPrepared: input.alwaysPrepared,
      },
      create: {
        characterId: input.characterId,
        homebrewId: input.homebrewId,
        prepared: input.prepared,
        alwaysPrepared: input.alwaysPrepared,
      },
      include: {
        homebrew: true,
      },
    });

    return characterSpell;
  }),

/**
 * Add homebrew feat to character
 */
addHomebrewFeat: protectedProcedure
  .input(
    z.object({
      characterId: z.string(),
      homebrewId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // 1. Verify character ownership
    const character = await ctx.prisma.character.findUnique({
      where: { id: input.characterId },
    });

    if (!character) {
      throw new NotFoundError('character', input.characterId);
    }

    if (character.userId !== ctx.session.user.id) {
      throw ForbiddenError.forPermission('edit', 'Character');
    }

    // 2. Verify homebrew exists and is type='feat'
    const homebrew = await ctx.prisma.homebrewContent.findUnique({
      where: { id: input.homebrewId },
    });

    if (!homebrew) {
      throw new NotFoundError('homebrew', input.homebrewId);
    }

    if (homebrew.type !== 'feat') {
      throw new ValidationError('Only feats can be added to character');
    }

    // 3. Create CharacterFeat
    const characterFeat = await ctx.prisma.characterFeat.create({
      data: {
        characterId: input.characterId,
        homebrewId: input.homebrewId,
      },
      include: {
        homebrew: true,
      },
    });

    return characterFeat;
  }),

/**
 * Remove homebrew item from character
 */
removeHomebrewItem: protectedProcedure
  .input(
    z.object({
      characterId: z.string(),
      homebrewId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Verify ownership
    const character = await ctx.prisma.character.findUnique({
      where: { id: input.characterId },
    });

    if (!character || character.userId !== ctx.session.user.id) {
      throw ForbiddenError.forPermission('edit', 'Character');
    }

    await ctx.prisma.characterItem.delete({
      where: {
        characterId_homebrewId: {
          characterId: input.characterId,
          homebrewId: input.homebrewId,
        },
      },
    });

    return { success: true };
  }),

/**
 * Remove homebrew spell from character
 */
removeHomebrewSpell: protectedProcedure
  .input(
    z.object({
      characterId: z.string(),
      homebrewId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Verify ownership
    const character = await ctx.prisma.character.findUnique({
      where: { id: input.characterId },
    });

    if (!character || character.userId !== ctx.session.user.id) {
      throw ForbiddenError.forPermission('edit', 'Character');
    }

    await ctx.prisma.characterSpell.delete({
      where: {
        characterId_homebrewId: {
          characterId: input.characterId,
          homebrewId: input.homebrewId,
        },
      },
    });

    return { success: true };
  }),

/**
 * Remove homebrew feat from character
 */
removeHomebrewFeat: protectedProcedure
  .input(
    z.object({
      characterId: z.string(),
      homebrewId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Verify ownership
    const character = await ctx.prisma.character.findUnique({
      where: { id: input.characterId },
    });

    if (!character || character.userId !== ctx.session.user.id) {
      throw ForbiddenError.forPermission('edit', 'Character');
    }

    await ctx.prisma.characterFeat.delete({
      where: {
        characterId_homebrewId: {
          characterId: input.characterId,
          homebrewId: input.homebrewId,
        },
      },
    });

    return { success: true };
  }),

/**
 * Get character with homebrew content
 */
getCharacterWithHomebrew: protectedProcedure
  .input(z.object({ characterId: z.string() }))
  .query(async ({ input, ctx }) => {
    const character = await ctx.prisma.character.findUnique({
      where: { id: input.characterId },
      include: {
        homebrewItems: {
          include: {
            homebrew: true,
          },
        },
        homebrewSpells: {
          include: {
            homebrew: true,
          },
        },
        homebrewFeats: {
          include: {
            homebrew: true,
          },
        },
      },
    });

    if (!character) {
      throw new NotFoundError('character', input.characterId);
    }

    // Only owner can view character details
    if (character.userId !== ctx.session.user.id) {
      throw ForbiddenError.forPermission('view', 'Character');
    }

    return character;
  }),
```

**Important**: Add necessary imports at the top:
```typescript
import { NotFoundError, ForbiddenError, ValidationError } from '../errors';
```

---

### Phase 3: Homebrew Detail Page UI

**Find the homebrew detail page** (likely `src/app/(app)/campaigns/[slug]/homebrew/[homebrewId]/page.tsx` or similar).

Add an "Add to Character" button component:

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddToCharacterButtonProps {
  homebrewId: string;
  homebrewName: string;
  homebrewType: 'item' | 'spell' | 'feat';
}

export function AddToCharacterButton({
  homebrewId,
  homebrewName,
  homebrewType,
}: AddToCharacterButtonProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Get user's characters
  const { data: characters } = trpc.characters.getMyCharacters.useQuery();

  // Mutations
  const addItem = trpc.characters.addHomebrewItem.useMutation();
  const addSpell = trpc.characters.addHomebrewSpell.useMutation();
  const addFeat = trpc.characters.addHomebrewFeat.useMutation();

  const handleAddToCharacter = async (characterId: string) => {
    try {
      if (homebrewType === 'item') {
        await addItem.mutateAsync({
          characterId,
          homebrewId,
          quantity: 1,
        });
      } else if (homebrewType === 'spell') {
        await addSpell.mutateAsync({
          characterId,
          homebrewId,
          prepared: false,
        });
      } else if (homebrewType === 'feat') {
        await addFeat.mutateAsync({
          characterId,
          homebrewId,
        });
      }

      toast({
        title: 'Success',
        description: `${homebrewName} added to character`,
      });

      setOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add to character',
        variant: 'destructive',
      });
    }
  };

  if (!characters || characters.length === 0) {
    return null; // Don't show button if user has no characters
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add to Character
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {homebrewName} to Character</DialogTitle>
          <DialogDescription>
            Select which character should receive this {homebrewType}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {characters.map((character) => (
            <Button
              key={character.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleAddToCharacter(character.id)}
              disabled={
                addItem.isPending || addSpell.isPending || addFeat.isPending
              }
            >
              <div className="flex items-center gap-3">
                {character.portraitUrl && (
                  <img
                    src={character.portraitUrl}
                    alt={character.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
                <div className="text-left">
                  <div className="font-medium">{character.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Level {character.level} {character.race} {character.class}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Integrate the button** into the homebrew detail page (add near the top of the page content):

```tsx
<AddToCharacterButton
  homebrewId={homebrew.id}
  homebrewName={homebrew.name}
  homebrewType={homebrew.type as 'item' | 'spell' | 'feat'}
/>
```

---

### Phase 4: Character Sheet Homebrew Display

**Find character sheet components** (likely in `src/components/character/` directory).

Create or update these components:

**File**: `src/components/character/CharacterHomebrewItems.tsx`

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CharacterHomebrewItemsProps {
  characterId: string;
}

export function CharacterHomebrewItems({ characterId }: CharacterHomebrewItemsProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: character } = trpc.characters.getCharacterWithHomebrew.useQuery({
    characterId,
  });

  const removeItem = trpc.characters.removeHomebrewItem.useMutation({
    onSuccess: () => {
      utils.characters.getCharacterWithHomebrew.invalidate({ characterId });
      toast({
        title: 'Item removed',
        description: 'Item removed from character',
      });
    },
  });

  if (!character || !character.homebrewItems?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No homebrew items yet. Import a PDF with items or add them manually.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {character.homebrewItems.map((characterItem) => (
        <div
          key={characterItem.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex-1">
            <div className="font-medium">{characterItem.homebrew.name}</div>
            <div className="text-sm text-muted-foreground">
              Quantity: {characterItem.quantity}
              {characterItem.equipped && ' • Equipped'}
              {characterItem.attuned && ' • Attuned'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              removeItem.mutate({
                characterId,
                homebrewId: characterItem.homebrewId,
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
```

**File**: `src/components/character/CharacterHomebrewSpells.tsx`

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CharacterHomebrewSpellsProps {
  characterId: string;
}

export function CharacterHomebrewSpells({ characterId }: CharacterHomebrewSpellsProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: character } = trpc.characters.getCharacterWithHomebrew.useQuery({
    characterId,
  });

  const removeSpell = trpc.characters.removeHomebrewSpell.useMutation({
    onSuccess: () => {
      utils.characters.getCharacterWithHomebrew.invalidate({ characterId });
      toast({
        title: 'Spell removed',
        description: 'Spell removed from character',
      });
    },
  });

  if (!character || !character.homebrewSpells?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No homebrew spells yet. Import a PDF with spells or add them manually.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {character.homebrewSpells.map((characterSpell) => (
        <div
          key={characterSpell.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex-1">
            <div className="font-medium">{characterSpell.homebrew.name}</div>
            <div className="text-sm text-muted-foreground">
              {characterSpell.prepared ? 'Prepared' : 'Not prepared'}
              {characterSpell.alwaysPrepared && ' • Always prepared'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              removeSpell.mutate({
                characterId,
                homebrewId: characterSpell.homebrewId,
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
```

**File**: `src/components/character/CharacterHomebrewFeats.tsx`

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CharacterHomebrewFeatsProps {
  characterId: string;
}

export function CharacterHomebrewFeats({ characterId }: CharacterHomebrewFeatsProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: character } = trpc.characters.getCharacterWithHomebrew.useQuery({
    characterId,
  });

  const removeFeat = trpc.characters.removeHomebrewFeat.useMutation({
    onSuccess: () => {
      utils.characters.getCharacterWithHomebrew.invalidate({ characterId });
      toast({
        title: 'Feat removed',
        description: 'Feat removed from character',
      });
    },
  });

  if (!character || !character.homebrewFeats?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No homebrew feats yet. Import a PDF with feats or add them manually.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {character.homebrewFeats.map((characterFeat) => (
        <div
          key={characterFeat.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex-1">
            <div className="font-medium">{characterFeat.homebrew.name}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              removeFeat.mutate({
                characterId,
                homebrewId: characterFeat.homebrewId,
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
```

**Integrate into character sheet page** - add sections for homebrew content:

```tsx
import { CharacterHomebrewItems } from '@/components/character/CharacterHomebrewItems';
import { CharacterHomebrewSpells } from '@/components/character/CharacterHomebrewSpells';
import { CharacterHomebrewFeats } from '@/components/character/CharacterHomebrewFeats';

// Add sections in the character sheet:
<section>
  <h3 className="text-lg font-semibold mb-2">Homebrew Items</h3>
  <CharacterHomebrewItems characterId={character.id} />
</section>

<section>
  <h3 className="text-lg font-semibold mb-2">Homebrew Spells</h3>
  <CharacterHomebrewSpells characterId={character.id} />
</section>

<section>
  <h3 className="text-lg font-semibold mb-2">Homebrew Feats</h3>
  <CharacterHomebrewFeats characterId={character.id} />
</section>
```

---

## Testing Checklist

After implementation:

1. ✅ Schema migration runs without errors
2. ✅ Can add homebrew item to character from homebrew detail page
3. ✅ Can add homebrew spell to character from homebrew detail page
4. ✅ Can add homebrew feat to character from homebrew detail page
5. ✅ Character sheet displays linked homebrew items
6. ✅ Character sheet displays linked homebrew spells
7. ✅ Character sheet displays linked homebrew feats
8. ✅ Can remove homebrew content from character
9. ✅ TypeScript compiles without errors
10. ✅ Test with imported PDF homebrew content

---

## Success Criteria

- Users can click "Add to Character" on any homebrew item/spell/feat detail page
- Character selector modal shows all user's characters
- Character sheet displays all linked homebrew content in dedicated sections
- Remove functionality works correctly
- No TypeScript errors
- Database schema updated with proper foreign keys and indexes

---

## Notes

- Follow existing patterns in `characters.ts` and `homebrew.ts` routers
- Use `NotFoundError`, `ForbiddenError`, `ValidationError` from `src/server/errors`
- Maintain authorization checks (character ownership)
- Use optimistic updates with `trpc.useUtils()` for better UX
- Follow shadcn/ui component patterns
