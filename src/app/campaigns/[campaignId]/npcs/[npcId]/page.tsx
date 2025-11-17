'use client';

import { use, useState, useEffect } from 'react';
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
  Trash2,
  Edit,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';
import NPCStatBlock from '@/components/NPCStatBlock';
import NPCStatBlockEditor from '@/components/NPCStatBlockEditor';
import CampaignNav from '@/components/CampaignNav';

interface NPCDetailPageProps {
  params: Promise<{
    campaignId: string;
    npcId: string;
  }>;
}

export default function NPCDetailPage({ params }: NPCDetailPageProps) {
  const { campaignId, npcId } = use(params);
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [faction, setFaction] = useState('');
  const [secrets, setSecrets] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [stats, setStats] = useState<any>({});
  const [showSecrets, setShowSecrets] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // TODO: Replace with actual user role check from authentication
  // For now, always show DM view. When auth is added, check if user is campaign owner or has DM role
  const isDM = true; // Will be: user?.id === campaign?.userId || userRole === 'DM' || userRole === 'DM_ASSISTANT'

  const { data: npc, isLoading } = trpc.npcs.getById.useQuery({
    id: npcId,
  });

  const updateNPCMutation = trpc.npcs.update.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      setLastSaved(new Date());
    },
  });

  const deleteNPCMutation = trpc.npcs.delete.useMutation({
    onSuccess: () => {
      router.push(`/campaigns/${campaignId}/npcs`);
    },
  });

  // Initialize state when NPC loads
  useEffect(() => {
    if (npc) {
      setName(npc.name);
      setDescription(npc.description || '');
      setFaction(npc.faction || '');
      setSecrets(npc.secrets || '');
      setImageUrl(npc.imageUrl || '');
      setStats(npc.stats || {});
    }
  }, [npc]);

  // Parse description with AI
  const handleParseDescription = async () => {
    if (!description) return;

    setIsParsing(true);
    try {
      const response = await fetch('/api/npcs/parse-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, name }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse stats');
      }

      const data = await response.json();
      setStats({ ...stats, ...data.stats });
    } catch (error) {
      console.error('Error parsing stats:', error);
      alert('Failed to parse stats from description');
    } finally {
      setIsParsing(false);
    }
  };

  // Auto-save with debounce (only in edit mode)
  useEffect(() => {
    if (!npc || !isEditing) return;

    const timeoutId = setTimeout(() => {
      if (
        name !== npc.name ||
        description !== (npc.description || '') ||
        faction !== (npc.faction || '') ||
        secrets !== (npc.secrets || '') ||
        imageUrl !== (npc.imageUrl || '') ||
        JSON.stringify(stats) !== JSON.stringify(npc.stats || {})
      ) {
        setIsSaving(true);
        updateNPCMutation.mutate({
          id: npcId,
          name,
          description: description || undefined,
          faction: faction || undefined,
          secrets: secrets || undefined,
          imageUrl: imageUrl || undefined,
          stats: Object.keys(stats).length > 0 ? stats : undefined,
        });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [name, description, faction, secrets, imageUrl, stats, npc, npcId, isEditing]);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${npc?.name}?`)) {
      deleteNPCMutation.mutate({ id: npcId });
    }
  };

  if (isLoading) {
    return (
      <Container size="4" className="py-8">
        <Text>Loading NPC...</Text>
      </Container>
    );
  }

  if (!npc) {
    return (
      <Container size="4" className="py-8">
        <Text>NPC not found</Text>
      </Container>
    );
  }

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
                NPC
              </Text>
              <Heading size="8">{npc.name}</Heading>
            </Flex>
            {!isEditing ? (
              <>
                <Button
                  size="3"
                  variant="soft"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit size={16} />
                  Edit
                </Button>
                <IconButton
                  color="red"
                  variant="soft"
                  onClick={handleDelete}
                  disabled={deleteNPCMutation.isPending}
                >
                  <Trash2 size={20} />
                </IconButton>
              </>
            ) : (
              <Button
                size="3"
                variant="soft"
                color="gray"
                onClick={() => {
                  setIsEditing(false);
                  // Reset to original values
                  if (npc) {
                    setName(npc.name);
                    setDescription(npc.description || '');
                    setFaction(npc.faction || '');
                    setSecrets(npc.secrets || '');
                    setImageUrl(npc.imageUrl || '');
                    setStats(npc.stats || {});
                  }
                }}
              >
                <X size={16} />
                Cancel
              </Button>
            )}
          </Flex>

          <Flex align="center" gap="4">
            {npc.campaign && (
              <Text size="2" color="gray">
                Campaign: {npc.campaign.name}
              </Text>
            )}
            {lastSaved && (
              <Flex align="center" gap="1">
                <Save size={14} className="text-green-500" />
                <Text size="2" color="gray">
                  Saved {lastSaved.toLocaleTimeString()}
                </Text>
              </Flex>
            )}
            {isSaving && (
              <Flex align="center" gap="1">
                <Loader2 size={14} className="text-blue-500 animate-spin" />
                <Text size="2" color="gray">
                  Saving...
                </Text>
              </Flex>
            )}
          </Flex>
        </Flex>

        {/* Two-column layout: Stat Block (Left) + Portrait (Right) */}
        <Flex gap="6" style={{ alignItems: 'flex-start' }}>
          {/* Left Column - Stat Block & Info */}
          <Box style={{ flex: 2 }}>
            <Flex direction="column" gap="6">
              {/* Stat Block / Basic Info */}
              {!isEditing ? (
                <>
                  {/* D&D Stat Block - DM Only */}
                  {isDM && npc.stats && Object.keys(npc.stats).length > 0 && (
                    <NPCStatBlock
                      name={npc.name}
                      stats={npc.stats as any}
                    />
                  )}

                  {/* Description - Always Visible */}
                  {npc.description && (
                    <Card>
                      <Flex direction="column" gap="3">
                        <Heading size="4">Description</Heading>
                        <Text size="3" style={{ whiteSpace: 'pre-wrap' }}>
                          {npc.description}
                        </Text>
                      </Flex>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <Flex direction="column" gap="3">
                    <Heading size="4">Basic Information</Heading>

                    {/* Name */}
                    <Box>
                      <Box mb="2">
                        <Text size="2" weight="bold" color="gray">
                          Name
                        </Text>
                      </Box>
                      <TextField.Root
                        placeholder="NPC name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        size="3"
                      />
                    </Box>

                    {/* Description */}
                    <Box>
                      <Box mb="2">
                        <Text size="2" weight="bold" color="gray">
                          Description / Notes
                        </Text>
                      </Box>
                      <TextArea
                        placeholder="Physical appearance, personality, background..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={8}
                      />
                    </Box>
                  </Flex>
                </Card>
              )}

              {/* Stat Block Editor in Edit Mode */}
              {isEditing && (
                <Card>
                  <Flex direction="column" gap="3">
                    <Heading size="4">D&D 5e Stats</Heading>
                    <NPCStatBlockEditor
                      stats={stats}
                      description={description}
                      onChange={setStats}
                      onParseDescription={handleParseDescription}
                      isParsing={isParsing}
                    />
                  </Flex>
                </Card>
              )}
            </Flex>
          </Box>

          {/* Right Column - Portrait & Info */}
          <Box style={{ flex: 1 }}>
            <Flex direction="column" gap="4">
              {/* Portrait */}
              <Card>
                {isEditing ? (
                  <ImageUpload
                    value={imageUrl}
                    onChange={setImageUrl}
                    campaignId={campaignId}
                    placeholder="Upload or paste NPC portrait"
                  />
                ) : (
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      height: '400px',
                      backgroundColor: 'var(--gray-5)',
                      borderRadius: '8px',
                    }}
                  >
                    {npc.imageUrl ? (
                      <img
                        src={npc.imageUrl}
                        alt={npc.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '8px',
                        }}
                      />
                    ) : (
                      <Users size={64} className="text-gray-600" />
                    )}
                  </Flex>
                )}
              </Card>

              {/* Faction / Allegiance - Always Visible */}
              {(npc.faction || isEditing) && (
                <Card>
                  {isEditing ? (
                    <Flex direction="column" gap="2">
                      <Flex align="center" gap="2">
                        <Shield size={16} className="text-violet-500" />
                        <Text size="2" weight="medium">Faction</Text>
                      </Flex>
                      <TextField.Root
                        placeholder="e.g., Harpers, Zhentarim..."
                        value={faction}
                        onChange={(e) => setFaction(e.target.value)}
                        size="2"
                      />
                    </Flex>
                  ) : (
                    <Flex align="center" gap="2">
                      <Shield size={16} className="text-violet-500" />
                      <Text size="2">
                        <strong>Faction:</strong> {npc.faction}
                      </Text>
                    </Flex>
                  )}
                </Card>
              )}

              {/* Session Notes - Example/Placeholder */}
              {!isEditing && (
                <Card>
                  <Flex direction="column" gap="3">
                    <Heading size="3">Session Notes</Heading>
                    <Flex direction="column" gap="2">
                      {/* Example note - will be replaced with actual data later */}
                      <Text size="2" color="gray">
                        Gave Oriyen <Text weight="bold" color="violet" style={{ cursor: 'pointer' }}>&quot;Ambric&apos;s Sealed Letter&quot;</Text>
                      </Text>
                      <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>
                        Session notes will appear here as events unfold
                      </Text>
                    </Flex>
                  </Flex>
                </Card>
              )}
            </Flex>
          </Box>
        </Flex>

        <Separator size="4" />

        {/* DM Secrets - Full Width Below */}
        {(isEditing || npc.secrets) && (
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
                <>
                  {isEditing ? (
                    <TextArea
                      placeholder="Secret motivations, hidden agendas, important plot information..."
                      value={secrets}
                      onChange={(e) => setSecrets(e.target.value)}
                      rows={8}
                    />
                  ) : (
                    <Text size="3" style={{ whiteSpace: 'pre-wrap' }}>
                      {npc.secrets}
                    </Text>
                  )}
                </>
              )}

              {!showSecrets && (isEditing ? secrets : npc.secrets) && (
                <Text size="2" color="amber">
                  Secrets hidden - click the eye icon to reveal
                </Text>
              )}
            </Flex>
          </Card>
        )}
      </Flex>
    </Container>
  );
}
