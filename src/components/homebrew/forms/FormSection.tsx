'use client';

import { Card, Heading, Text, Box } from '@radix-ui/themes';
import { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  collapsible?: boolean;
}

/**
 * Reusable form section with consistent styling
 */
export function FormSection({
  title,
  description,
  children,
  collapsible = false,
}: FormSectionProps) {
  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <Box mb="3">
        <Heading size="4" mb="1">
          {title}
        </Heading>
        {description && (
          <Text size="2" color="gray">
            {description}
          </Text>
        )}
      </Box>
      {children}
    </Card>
  );
}
