'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import {
  Container,
  Card,
  Flex,
  Heading,
  Text,
  TextField,
  TextArea,
  Button,
  Select,
  Box,
} from '@radix-ui/themes';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';

export default function NewCampaignPage() {
  const router = useRouter();
  const createMutation = trpc.campaigns.create.useMutation();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system: '5e',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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

      // Redirect to the new campaign
      router.push(`/campaigns/${campaign.slug}`);
    } catch (error) {
      console.error('Failed to create campaign:', error);
      setErrors({ submit: 'Failed to create campaign. Please try again.' });
    }
  };

  return (
    <Container size="2" className="py-8">
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex direction="column" gap="2">
          <Button
            variant="ghost"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => router.back()}
          >
            <ArrowLeft size={16} />
            Back
          </Button>
          <Flex align="center" gap="2">
            <Sparkles size={28} className="text-violet-400" />
            <Heading size="8">Create New Campaign</Heading>
          </Flex>
          <Text size="3" color="gray">
            Set up your D&D campaign in just a few steps
          </Text>
        </Flex>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <Flex direction="column" gap="5" p="5">
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
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
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
                  onValueChange={(value) =>
                    setFormData({ ...formData, system: value })
                  }
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

              {/* Info Box */}
              <Box
                p="3"
                style={{
                  backgroundColor: 'var(--violet-3)',
                  borderRadius: '8px',
                  borderLeft: '3px solid var(--violet-9)',
                }}
              >
                <Flex direction="column" gap="2">
                  <Text size="2" weight="bold" style={{ color: 'var(--violet-11)' }}>
                    💡 What happens next?
                  </Text>
                  <Text size="2" color="gray">
                    After creating your campaign, you can:
                  </Text>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    <li>
                      <Text size="2" color="gray">
                        Import characters from D&D Beyond
                      </Text>
                    </li>
                    <li>
                      <Text size="2" color="gray">
                        Upload session recordings for AI transcription
                      </Text>
                    </li>
                    <li>
                      <Text size="2" color="gray">
                        Add homebrew content from PDFs
                      </Text>
                    </li>
                    <li>
                      <Text size="2" color="gray">
                        Track NPCs, locations, and plot threads
                      </Text>
                    </li>
                  </ul>
                </Flex>
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

              {/* Actions */}
              <Flex gap="3" justify="end" pt="2">
                <Button
                  type="button"
                  variant="soft"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  style={{ backgroundColor: 'var(--violet-9)' }}
                >
                  <Save size={16} />
                  {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
                </Button>
              </Flex>
            </Flex>
          </Card>
        </form>
      </Flex>
    </Container>
  );
}
