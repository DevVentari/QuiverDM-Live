'use client';

import { Flex, TextField, Select, Text } from '@radix-ui/themes';
import { useState } from 'react';

interface DiceInputProps {
  value: {
    diceCount: number;
    diceSize: number;
    modifier?: number;
  };
  onChange: (value: { diceCount: number; diceSize: number; modifier?: number }) => void;
  label?: string;
  required?: boolean;
  showModifier?: boolean;
}

/**
 * Input for dice notation (e.g., 2d6+3)
 */
export function DiceInput({
  value,
  onChange,
  label,
  required = false,
  showModifier = true,
}: DiceInputProps) {
  const diceOptions = [4, 6, 8, 10, 12, 20, 100];

  const updateValue = (key: keyof typeof value, newValue: number) => {
    onChange({
      ...value,
      [key]: newValue,
    });
  };

  // Calculate dice string for display
  const diceString = `${value.diceCount}d${value.diceSize}${
    showModifier && value.modifier ? ` + ${value.modifier}` : ''
  }`;

  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
          {label}
          {required && <span style={{ color: 'var(--red-9)' }}> *</span>}
        </Text>
      )}
      <Flex gap="2" align="center">
        <TextField.Root
          type="number"
          min="1"
          max="99"
          value={value.diceCount.toString()}
          onChange={(e) => updateValue('diceCount', parseInt(e.target.value) || 1)}
          style={{ width: '80px' }}
          placeholder="Count"
        />
        <Text size="2">d</Text>
        <Select.Root
          value={value.diceSize.toString()}
          onValueChange={(val) => updateValue('diceSize', parseInt(val))}
        >
          <Select.Trigger style={{ width: '100px' }} />
          <Select.Content>
            {diceOptions.map((size) => (
              <Select.Item key={size} value={size.toString()}>
                d{size}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        {showModifier && (
          <>
            <Text size="2">+</Text>
            <TextField.Root
              type="number"
              min="-99"
              max="99"
              value={value.modifier?.toString() || '0'}
              onChange={(e) => updateValue('modifier', parseInt(e.target.value) || 0)}
              style={{ width: '80px' }}
              placeholder="Mod"
            />
          </>
        )}
        <Text size="1" color="gray" style={{ marginLeft: '1rem' }}>
          = {diceString}
        </Text>
      </Flex>
    </div>
  );
}
