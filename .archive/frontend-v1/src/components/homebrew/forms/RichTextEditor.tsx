'use client';

import { TextArea, Text } from '@radix-ui/themes';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  helpText?: string;
}

/**
 * Simple markdown-friendly text editor for descriptions
 * Uses TextArea with markdown support hints
 */
export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder = 'Enter description (Markdown supported)...',
  required = false,
  rows = 8,
  helpText,
}: RichTextEditorProps) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
          {label}
          {required && <span style={{ color: 'var(--red-9)' }}> *</span>}
        </Text>
      )}
      <TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ fontFamily: 'monospace', width: '100%' }}
      />
      {helpText && (
        <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
          {helpText}
        </Text>
      )}
      <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
        Supports <strong>**bold**</strong>, <em>*italic*</em>, and markdown formatting
      </Text>
    </div>
  );
}
