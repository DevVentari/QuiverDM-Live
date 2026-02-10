'use client';

import { Box, Flex, Text, Badge, Separator } from '@radix-ui/themes';

interface NPCStats {
  // Basic info
  size?: string;
  type?: string;
  alignment?: string;

  // Defenses
  ac?: number;
  acType?: string;
  hp?: number;
  hitDice?: string;
  speed?: string;

  // Ability scores
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;

  // Skills & saves
  saves?: string;
  skills?: string;

  // Resistances
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;

  // Senses
  senses?: string;
  languages?: string;

  // Challenge
  cr?: string;
  xp?: number;

  // Abilities & Actions
  traits?: Array<{ name: string; description: string }>;
  actions?: Array<{ name: string; description: string }>;
  reactions?: Array<{ name: string; description: string }>;
  legendaryActions?: Array<{ name: string; description: string }>;
}

interface NPCStatBlockProps {
  name: string;
  stats?: NPCStats | null;
}

function calcModifier(score?: number): string {
  if (!score) return '+0';
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export default function NPCStatBlock({ name, stats }: NPCStatBlockProps) {
  if (!stats || Object.keys(stats).length === 0) {
    return null;
  }

  return (
    <Box
      style={{
        backgroundColor: 'var(--gray-2)',
        border: '2px solid var(--violet-7)',
        borderRadius: '8px',
        padding: '24px',
        fontFamily: 'Georgia, serif',
      }}
    >
      {/* Name */}
      <Text
        size="8"
        weight="bold"
        style={{
          color: 'var(--violet-11)',
          display: 'block',
          marginBottom: '4px',
        }}
      >
        {name}
      </Text>

      {/* Size, Type, Alignment */}
      {(stats.size || stats.type || stats.alignment) && (
        <Text size="2" style={{ fontStyle: 'italic', display: 'block', marginBottom: '12px' }}>
          {[stats.size, stats.type, stats.alignment].filter(Boolean).join(' ')}
        </Text>
      )}

      <Separator size="4" style={{ backgroundColor: 'var(--violet-9)', height: '2px', margin: '12px 0' }} />

      {/* AC, HP, Speed */}
      <Flex direction="column" gap="1" style={{ marginBottom: '12px' }}>
        {stats.ac && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Armor Class</strong> {stats.ac}
            {stats.acType && ` (${stats.acType})`}
          </Text>
        )}
        {stats.hp && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Hit Points</strong> {stats.hp}
            {stats.hitDice && ` (${stats.hitDice})`}
          </Text>
        )}
        {stats.speed && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Speed</strong> {stats.speed}
          </Text>
        )}
      </Flex>

      <Separator size="4" style={{ backgroundColor: 'var(--violet-9)', height: '2px', margin: '12px 0' }} />

      {/* Ability Scores */}
      <Flex gap="4" justify="between" style={{ margin: '12px 0' }}>
        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => {
          const score = stats[ability];
          return (
            <Flex key={ability} direction="column" align="center" style={{ flex: 1 }}>
              <Text size="1" weight="bold" style={{ textTransform: 'uppercase', color: 'var(--violet-11)' }}>
                {ability}
              </Text>
              <Text size="2">
                {score || 10} ({calcModifier(score)})
              </Text>
            </Flex>
          );
        })}
      </Flex>

      <Separator size="4" style={{ backgroundColor: 'var(--violet-9)', height: '2px', margin: '12px 0' }} />

      {/* Saves, Skills, Resistances, Senses, Languages */}
      <Flex direction="column" gap="1" style={{ marginBottom: '12px' }}>
        {stats.saves && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Saving Throws</strong> {stats.saves}
          </Text>
        )}
        {stats.skills && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Skills</strong> {stats.skills}
          </Text>
        )}
        {stats.damageResistances && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Damage Resistances</strong> {stats.damageResistances}
          </Text>
        )}
        {stats.damageImmunities && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Damage Immunities</strong> {stats.damageImmunities}
          </Text>
        )}
        {stats.conditionImmunities && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Condition Immunities</strong> {stats.conditionImmunities}
          </Text>
        )}
        {stats.senses && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Senses</strong> {stats.senses}
          </Text>
        )}
        {stats.languages && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Languages</strong> {stats.languages}
          </Text>
        )}
        {stats.cr && (
          <Text size="2">
            <strong style={{ color: 'var(--violet-11)' }}>Challenge</strong> {stats.cr}
            {stats.xp && ` (${stats.xp.toLocaleString()} XP)`}
          </Text>
        )}
      </Flex>

      {/* Traits */}
      {stats.traits && stats.traits.length > 0 && (
        <>
          <Separator size="4" style={{ backgroundColor: 'var(--violet-9)', height: '2px', margin: '12px 0' }} />
          <Flex direction="column" gap="2" style={{ marginBottom: '12px' }}>
            {stats.traits.map((trait, idx) => (
              <Box key={idx}>
                <Text size="2">
                  <strong style={{ fontStyle: 'italic', color: 'var(--violet-11)' }}>{trait.name}.</strong> {trait.description}
                </Text>
              </Box>
            ))}
          </Flex>
        </>
      )}

      {/* Actions */}
      {stats.actions && stats.actions.length > 0 && (
        <>
          <Separator size="4" style={{ backgroundColor: 'var(--violet-9)', height: '2px', margin: '12px 0' }} />
          <Text size="3" weight="bold" style={{ color: 'var(--violet-11)', display: 'block', marginBottom: '8px' }}>
            Actions
          </Text>
          <Flex direction="column" gap="2" style={{ marginBottom: '12px' }}>
            {stats.actions.map((action, idx) => (
              <Box key={idx}>
                <Text size="2">
                  <strong style={{ fontStyle: 'italic', color: 'var(--violet-11)' }}>{action.name}.</strong> {action.description}
                </Text>
              </Box>
            ))}
          </Flex>
        </>
      )}

      {/* Reactions */}
      {stats.reactions && stats.reactions.length > 0 && (
        <>
          <Separator size="4" style={{ backgroundColor: 'var(--violet-9)', height: '2px', margin: '12px 0' }} />
          <Text size="3" weight="bold" style={{ color: 'var(--violet-11)', display: 'block', marginBottom: '8px' }}>
            Reactions
          </Text>
          <Flex direction="column" gap="2" style={{ marginBottom: '12px' }}>
            {stats.reactions.map((reaction, idx) => (
              <Box key={idx}>
                <Text size="2">
                  <strong style={{ fontStyle: 'italic', color: 'var(--violet-11)' }}>{reaction.name}.</strong> {reaction.description}
                </Text>
              </Box>
            ))}
          </Flex>
        </>
      )}

      {/* Legendary Actions */}
      {stats.legendaryActions && stats.legendaryActions.length > 0 && (
        <>
          <Separator size="4" style={{ backgroundColor: 'var(--violet-9)', height: '2px', margin: '12px 0' }} />
          <Text size="3" weight="bold" style={{ color: 'var(--violet-11)', display: 'block', marginBottom: '8px' }}>
            Legendary Actions
          </Text>
          <Flex direction="column" gap="2">
            {stats.legendaryActions.map((action, idx) => (
              <Box key={idx}>
                <Text size="2">
                  <strong style={{ fontStyle: 'italic', color: 'var(--violet-11)' }}>{action.name}.</strong> {action.description}
                </Text>
              </Box>
            ))}
          </Flex>
        </>
      )}

    </Box>
  );
}
