'use client';

import { Flex, TextField, Badge, Text, IconButton } from '@radix-ui/themes';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useState, KeyboardEvent } from 'react';

interface TagSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  suggestions?: string[];
}

/**
 * Tag input with autocomplete suggestions
 */
export function TagSelector({
  value,
  onChange,
  label,
  placeholder = 'Add tag and press Enter...',
  suggestions = [],
}: TagSelectorProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !value.includes(trimmedTag)) {
      onChange([...value, trimmedTag]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag if backspace with empty input
      onChange(value.slice(0, -1));
    }
  };

  // Filter suggestions that aren't already added
  const availableSuggestions = suggestions.filter(
    (s) => !value.includes(s.toLowerCase()) && s.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
          {label}
        </Text>
      )}

      {/* Current tags */}
      {value.length > 0 && (
        <Flex gap="2" wrap="wrap" style={{ marginBottom: '0.5rem' }}>
          {value.map((tag) => (
            <Badge key={tag} color="violet" size="2">
              {tag}
              <IconButton
                size="1"
                variant="ghost"
                onClick={() => removeTag(tag)}
                style={{ marginLeft: '0.25rem', cursor: 'pointer' }}
              >
                <Cross2Icon width="12" height="12" />
              </IconButton>
            </Badge>
          ))}
        </Flex>
      )}

      {/* Input field */}
      <TextField.Root
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />

      {/* Suggestions */}
      {inputValue && availableSuggestions.length > 0 && (
        <Flex
          gap="2"
          wrap="wrap"
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            background: 'var(--gray-3)',
            borderRadius: '4px',
          }}
        >
          <Text size="1" color="gray" style={{ width: '100%' }}>
            Suggestions:
          </Text>
          {availableSuggestions.slice(0, 6).map((suggestion) => (
            <Badge
              key={suggestion}
              color="gray"
              style={{ cursor: 'pointer' }}
              onClick={() => addTag(suggestion)}
            >
              + {suggestion}
            </Badge>
          ))}
        </Flex>
      )}
    </div>
  );
}
