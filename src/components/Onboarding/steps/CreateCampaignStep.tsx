'use client';

import { useState } from 'react';
import { Flex, Heading, Text, TextField, TextArea, Select, Button, Box } from '@radix-ui/themes';
import { Sparkles, Check } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface CreateCampaignStepProps {
  onCampaignCreated: (campaignId: string) => void;
}

export function CreateCampaignStep({ onCampaignCreated }: CreateCampaignStepProps) {
  const createMutation = trpc.campaigns.create.useMutation();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system: '5e',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const campaign = await createMutation.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
      });

      setCreated(true);
      onCampaignCreated(campaign.id);
    } catch (error) {
      console.error('Failed to create campaign:', error);
      setErrors({ submit: 'Failed to create campaign. Please try again.' });
    }
  };

  if (created) {
    return (
      <Flex direction="column" gap="4" align="center">
        <Box
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--green-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={40} style={{ color: 'var(--green-11)' }} />
        </Box>
        <Heading size="6">Campaign Created!</Heading>
        <Text size="3" color="gray" style={{ textAlign: 'center', maxWidth: '400px' }}>
          Great! Your campaign is ready. Let&apos;s set up D&D Beyond integration so you can import your
          characters.
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="5">
      <Flex direction="column" gap="2" align="center">
        <Sparkles size={32} className="text-violet-400" />
        <Heading size="6">Create Your First Campaign</Heading>
        <Text size="3" color="gray" style={{ textAlign: 'center', maxWidth: '450px' }}>
          Let&apos;s start by setting up your campaign. You can always change these details later.
        </Text>
      </Flex>

      <form onSubmit={handleSubmit}>
        <Flex direction="column" gap="4">
          {/* Campaign Name */}
          <Box>
            <label htmlFor="name">
              <Text as="div" size="2" mb="1" weight="bold">
                Campaign Name *
              </Text>
            </label>
            <TextField.Root
              id="name"
              placeholder="The Lost Mines of Phandelver"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              size="3"
            />
            {errors.name && (
              <Text size="2" color="red" mt="1">
                {errors.name}
              </Text>
            )}
          </Box>

          {/* Campaign Description */}
          <Box>
            <label htmlFor="description">
              <Text as="div" size="2" mb="1" weight="bold">
                Description
              </Text>
              <Text as="div" size="1" color="gray" mb="2">
                A brief overview of your campaign (optional)
              </Text>
            </label>
            <TextArea
              id="description"
              placeholder="A group of adventurers seek fortune and glory in the dangerous ruins beneath Phandalin..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              size="3"
            />
          </Box>

          {/* Game System */}
          <Box>
            <label htmlFor="system">
              <Text as="div" size="2" mb="1" weight="bold">
                Game System
              </Text>
            </label>
            <Select.Root
              value={formData.system}
              onValueChange={(value) => setFormData({ ...formData, system: value })}
            >
              <Select.Trigger id="system" style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="5e">D&D 5th Edition</Select.Item>
                <Select.Item value="pathfinder2e">Pathfinder 2e</Select.Item>
                <Select.Item value="pf1e">Pathfinder 1e</Select.Item>
                <Select.Item value="3.5e">D&D 3.5e</Select.Item>
                <Select.Item value="other">Other</Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>

          {/* Error Message */}
          {errors.submit && (
            <Box
              p="3"
              style={{
                backgroundColor: 'var(--red-3)',
                borderRadius: '8px',
                borderLeft: '3px solid var(--red-9)',
              }}
            >
              <Text size="2" color="red">
                {errors.submit}
              </Text>
            </Box>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={createMutation.isPending}
            size="3"
            style={{ backgroundColor: 'var(--violet-9)', width: '100%' }}
          >
            <Sparkles size={16} />
            {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
          </Button>
        </Flex>
      </form>
    </Flex>
  );
}
