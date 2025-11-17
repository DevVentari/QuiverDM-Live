'use client';

import { useState } from 'react';
import { Box, Flex, Text, TextField, TextArea, Button, Grid, Separator } from '@radix-ui/themes';
import { Wand2, Loader2 } from 'lucide-react';

interface NPCStats {
  size?: string;
  type?: string;
  alignment?: string;
  ac?: number;
  acType?: string;
  hp?: number;
  hitDice?: string;
  speed?: string;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  saves?: string;
  skills?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  senses?: string;
  languages?: string;
  cr?: string;
  xp?: number;
  traits?: Array<{ name: string; description: string }>;
  actions?: Array<{ name: string; description: string }>;
  reactions?: Array<{ name: string; description: string }>;
  legendaryActions?: Array<{ name: string; description: string }>;
}

interface NPCStatBlockEditorProps {
  stats: NPCStats;
  description: string;
  onChange: (stats: NPCStats) => void;
  onParseDescription?: () => void;
  isParsing?: boolean;
}

export default function NPCStatBlockEditor({
  stats,
  description,
  onChange,
  onParseDescription,
  isParsing = false,
}: NPCStatBlockEditorProps) {
  const updateStat = (field: keyof NPCStats, value: any) => {
    onChange({ ...stats, [field]: value });
  };

  const updateAbility = (ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', value: string) => {
    const num = parseInt(value);
    updateStat(ability, isNaN(num) ? undefined : num);
  };

  return (
    <Flex direction="column" gap="4">
      {/* AI Parse Button */}
      {description && onParseDescription && (
        <Flex justify="between" align="center">
          <Text size="2" color="gray">
            Parse stats from description using AI
          </Text>
          <Button
            size="2"
            variant="soft"
            color="violet"
            onClick={onParseDescription}
            disabled={isParsing}
          >
            {isParsing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Wand2 size={14} />
                Auto-Extract Stats
              </>
            )}
          </Button>
        </Flex>
      )}

      {/* Basic Info */}
      <Box>
        <Text size="2" weight="bold" mb="2">
          Basic Info
        </Text>
        <Grid columns="3" gap="3">
          <TextField.Root
            placeholder="Size (e.g., Medium)"
            value={stats.size || ''}
            onChange={(e) => updateStat('size', e.target.value)}
          />
          <TextField.Root
            placeholder="Type (e.g., Humanoid)"
            value={stats.type || ''}
            onChange={(e) => updateStat('type', e.target.value)}
          />
          <TextField.Root
            placeholder="Alignment"
            value={stats.alignment || ''}
            onChange={(e) => updateStat('alignment', e.target.value)}
          />
        </Grid>
      </Box>

      {/* Combat Stats */}
      <Box>
        <Text size="2" weight="bold" mb="2">
          Combat Stats
        </Text>
        <Grid columns="3" gap="3">
          <Flex gap="2">
            <TextField.Root
              placeholder="AC"
              type="number"
              value={stats.ac || ''}
              onChange={(e) => updateStat('ac', parseInt(e.target.value))}
              style={{ width: '80px' }}
            />
            <TextField.Root
              placeholder="armor type"
              value={stats.acType || ''}
              onChange={(e) => updateStat('acType', e.target.value)}
              style={{ flex: 1 }}
            />
          </Flex>
          <Flex gap="2">
            <TextField.Root
              placeholder="HP"
              type="number"
              value={stats.hp || ''}
              onChange={(e) => updateStat('hp', parseInt(e.target.value))}
              style={{ width: '80px' }}
            />
            <TextField.Root
              placeholder="hit dice"
              value={stats.hitDice || ''}
              onChange={(e) => updateStat('hitDice', e.target.value)}
              style={{ flex: 1 }}
            />
          </Flex>
          <TextField.Root
            placeholder="Speed (e.g., 30 ft.)"
            value={stats.speed || ''}
            onChange={(e) => updateStat('speed', e.target.value)}
          />
        </Grid>
      </Box>

      {/* Ability Scores */}
      <Box>
        <Text size="2" weight="bold" mb="2">
          Ability Scores
        </Text>
        <Grid columns="6" gap="2">
          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => (
            <Box key={ability}>
              <Text size="1" weight="bold" mb="1" style={{ textTransform: 'uppercase' }}>
                {ability}
              </Text>
              <TextField.Root
                type="number"
                placeholder="10"
                value={stats[ability] || ''}
                onChange={(e) => updateAbility(ability, e.target.value)}
              />
            </Box>
          ))}
        </Grid>
      </Box>

      {/* Skills & Proficiencies */}
      <Box>
        <Text size="2" weight="bold" mb="2">
          Skills & Proficiencies
        </Text>
        <Flex direction="column" gap="2">
          <TextField.Root
            placeholder="Saving Throws (e.g., Dex +5, Wis +3)"
            value={stats.saves || ''}
            onChange={(e) => updateStat('saves', e.target.value)}
          />
          <TextField.Root
            placeholder="Skills (e.g., Perception +5, Stealth +7)"
            value={stats.skills || ''}
            onChange={(e) => updateStat('skills', e.target.value)}
          />
        </Flex>
      </Box>

      {/* Resistances & Immunities */}
      <Box>
        <Text size="2" weight="bold" mb="2">
          Resistances & Immunities
        </Text>
        <Flex direction="column" gap="2">
          <TextField.Root
            placeholder="Damage Resistances"
            value={stats.damageResistances || ''}
            onChange={(e) => updateStat('damageResistances', e.target.value)}
          />
          <TextField.Root
            placeholder="Damage Immunities"
            value={stats.damageImmunities || ''}
            onChange={(e) => updateStat('damageImmunities', e.target.value)}
          />
          <TextField.Root
            placeholder="Condition Immunities"
            value={stats.conditionImmunities || ''}
            onChange={(e) => updateStat('conditionImmunities', e.target.value)}
          />
        </Flex>
      </Box>

      {/* Senses & Languages */}
      <Box>
        <Text size="2" weight="bold" mb="2">
          Senses & Languages
        </Text>
        <Flex direction="column" gap="2">
          <TextField.Root
            placeholder="Senses (e.g., darkvision 60 ft., passive Perception 12)"
            value={stats.senses || ''}
            onChange={(e) => updateStat('senses', e.target.value)}
          />
          <TextField.Root
            placeholder="Languages"
            value={stats.languages || ''}
            onChange={(e) => updateStat('languages', e.target.value)}
          />
        </Flex>
      </Box>

      {/* Challenge Rating */}
      <Box>
        <Text size="2" weight="bold" mb="2">
          Challenge Rating
        </Text>
        <Grid columns="2" gap="3">
          <TextField.Root
            placeholder="CR (e.g., 5)"
            value={stats.cr || ''}
            onChange={(e) => updateStat('cr', e.target.value)}
          />
          <TextField.Root
            placeholder="XP"
            type="number"
            value={stats.xp || ''}
            onChange={(e) => updateStat('xp', parseInt(e.target.value))}
          />
        </Grid>
      </Box>

      <Separator size="4" />

      <Text size="1" color="gray">
        Traits, Actions, Reactions, and Legendary Actions can be edited in the description field for now.
        Full editor coming soon!
      </Text>
    </Flex>
  );
}
