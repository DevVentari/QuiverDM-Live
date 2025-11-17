'use client';

import { use, useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  TextField,
  TextArea,
  IconButton,
  Badge,
  Separator,
} from '@radix-ui/themes';
import {
  ArrowLeft,
  Save,
  Loader2,
  Users,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';
import CampaignNav from '@/components/CampaignNav';

interface NewNPCPageProps {
  params: Promise<{
    campaignId: string;
  }>;
}

export default function NewNPCPage({ params }: NewNPCPageProps) {
  const { campaignId } = use(params);
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [faction, setFaction] = useState('');
  const [secrets, setSecrets] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);

  const createNPCMutation = trpc.npcs.create.useMutation({
    onSuccess: (npc) => {
      router.push(`/campaigns/${campaignId}/npcs/${npc.id}`);
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      alert('Please enter a name for the NPC');
      return;
    }

    createNPCMutation.mutate({
      campaignId,
      name,
      description: description || undefined,
      faction: faction || undefined,
      secrets: secrets || undefined,
      imageUrl: imageUrl || undefined,
    });
  };

  return (
    <Container size="4" className="py-8">
      <CampaignNav campaignId={campaignId} />

      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex direction="column" gap="4">
          <Flex align="center" gap="3">
            <IconButton
              variant="ghost"
              onClick={() => router.push(`/campaigns/${campaignId}/npcs`)}
            >
              <ArrowLeft size={20} />
            </IconButton>
            <Flex direction="column" gap="1" style={{ flex: 1 }}>
              <Text size="1" color="gray" weight="medium">
                NEW NPC
              </Text>
              <Heading size="8">Create NPC</Heading>
            </Flex>
            <Button
              size="3"
              onClick={handleCreate}
              disabled={createNPCMutation.isPending || !name.trim()}
            >
              {createNPCMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Create NPC
                </>
              )}
            </Button>
          </Flex>
        </Flex>

        {/* Image/Avatar */}
        <Card>
          <Flex direction="column" gap="3">
            <Heading size="4">Character Portrait</Heading>
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              campaignId={campaignId}
              placeholder="Upload or paste NPC portrait"
            />
          </Flex>
        </Card>

        {/* Basic Info */}
        <Card>
          <Flex direction="column" gap="3">
            <Heading size="4">Basic Information</Heading>

            <Box>
              <Text size="2" weight="bold" mb="1">
                Name *
              </Text>
              <TextField.Root
                placeholder="NPC name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="3"
              />
            </Box>

            <Box>
              <Flex align="center" gap="2" mb="1">
                <Shield size={16} className="text-violet-500" />
                <Text size="2" weight="bold">
                  Faction / Allegiance
                </Text>
              </Flex>
              <TextField.Root
                placeholder="e.g., Harpers, Zhentarim, Independent..."
                value={faction}
                onChange={(e) => setFaction(e.target.value)}
                size="3"
              />
            </Box>

            <Box>
              <Text size="2" weight="bold" mb="1">
                Description
              </Text>
              <TextArea
                placeholder="Physical appearance, personality, background..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
              />
            </Box>
          </Flex>
        </Card>

        <Separator size="4" />

        {/* DM Secrets */}
        <Card>
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center">
              <Flex align="center" gap="2">
                <Heading size="4">DM Secrets</Heading>
                <Badge color="amber" variant="soft">
                  DM Only
                </Badge>
              </Flex>
              <IconButton
                variant="ghost"
                onClick={() => setShowSecrets(!showSecrets)}
              >
                {showSecrets ? <EyeOff size={20} /> : <Eye size={20} />}
              </IconButton>
            </Flex>

            <Text size="2" color="gray">
              Hidden information about this NPC - motivations, secrets, plot hooks
            </Text>

            {showSecrets && (
              <TextArea
                placeholder="Secret motivations, hidden agendas, important plot information..."
                value={secrets}
                onChange={(e) => setSecrets(e.target.value)}
                rows={8}
              />
            )}

            {!showSecrets && secrets && (
              <Text size="2" color="amber">
                Secrets hidden - click the eye icon to reveal
              </Text>
            )}
          </Flex>
        </Card>
      </Flex>
    </Container>
  );
}
