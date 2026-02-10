'use client';

import { Grid, TextField, Text, Flex, Box } from '@radix-ui/themes';

interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

interface AbilityScoreInputProps {
  value: AbilityScores;
  onChange: (value: AbilityScores) => void;
  label?: string;
  required?: boolean;
  showModifiers?: boolean;
}

/**
 * Input for D&D 5e ability scores (STR, DEX, CON, INT, WIS, CHA)
 */
export function AbilityScoreInput({
  value,
  onChange,
  label,
  required = false,
  showModifiers = true,
}: AbilityScoreInputProps) {
  const abilities: Array<{ key: keyof AbilityScores; label: string; color: string }> = [
    { key: 'str', label: 'STR', color: '#e74c3c' },
    { key: 'dex', label: 'DEX', color: '#3498db' },
    { key: 'con', label: 'CON', color: '#2ecc71' },
    { key: 'int', label: 'INT', color: '#9b59b6' },
    { key: 'wis', label: 'WIS', color: '#f39c12' },
    { key: 'cha', label: 'CHA', color: '#e91e63' },
  ];

  const calculateModifier = (score: number): string => {
    const modifier = Math.floor((score - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : modifier.toString();
  };

  const updateAbility = (key: keyof AbilityScores, newValue: number) => {
    // Clamp between 1 and 30
    const clampedValue = Math.max(1, Math.min(30, newValue));
    onChange({
      ...value,
      [key]: clampedValue,
    });
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
          {label}
          {required && <span style={{ color: 'var(--red-9)' }}> *</span>}
        </Text>
      )}
      <Grid columns="6" gap="2">
        {abilities.map((ability) => (
          <Box key={ability.key}>
            <Flex direction="column" align="center">
              <Text
                size="2"
                weight="bold"
                style={{
                  color: ability.color,
                  marginBottom: '0.25rem',
                }}
              >
                {ability.label}
              </Text>
              <TextField.Root
                type="number"
                min="1"
                max="30"
                value={value[ability.key].toString()}
                onChange={(e) =>
                  updateAbility(ability.key, parseInt(e.target.value) || 10)
                }
                style={{
                  width: '70px',
                  textAlign: 'center',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                }}
              />
              {showModifiers && (
                <Text
                  size="1"
                  color="gray"
                  style={{
                    marginTop: '0.25rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {calculateModifier(value[ability.key])}
                </Text>
              )}
            </Flex>
          </Box>
        ))}
      </Grid>
      <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.5rem' }}>
        Ability scores range from 1 to 30
      </Text>
    </div>
  );
}
