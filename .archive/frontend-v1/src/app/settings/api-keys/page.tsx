'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Flex, Heading, Text, Button, TextField, Badge } from '@radix-ui/themes';
import { motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';

export default function ApiKeysPage() {
  const router = useRouter();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});

  const { data: settings, refetch } = trpc.userSettings.getSettings.useQuery();
  const updateKeys = trpc.userSettings.updateApiKeys.useMutation();
  const deleteKey = trpc.userSettings.deleteApiKey.useMutation();

  const apiKeys = [
    {
      id: 'openaiApiKey',
      name: 'OpenAI API Key',
      description: 'Used for GPT-powered summaries and content generation',
      masked: settings?.maskedOpenaiApiKey,
      hasKey: settings?.hasOpenaiApiKey,
      placeholder: 'sk-...',
      docs: 'https://platform.openai.com/api-keys',
    },
    {
      id: 'anthropicApiKey',
      name: 'Anthropic API Key',
      description: 'Used for Claude-powered AI features',
      masked: settings?.maskedAnthropicApiKey,
      hasKey: settings?.hasAnthropicApiKey,
      placeholder: 'sk-ant-...',
      docs: 'https://console.anthropic.com/',
    },
    {
      id: 'huggingfaceToken',
      name: 'HuggingFace Token',
      description: 'Used for speaker diarization in transcription',
      masked: settings?.maskedHuggingfaceToken,
      hasKey: settings?.hasHuggingfaceToken,
      placeholder: 'hf_...',
      docs: 'https://huggingface.co/settings/tokens',
    },
    {
      id: 'dndBeyondCobaltCookie',
      name: 'D&D Beyond Cobalt Cookie',
      description: 'Used for importing characters from D&D Beyond',
      masked: settings?.maskedDndBeyondCobaltCookie,
      hasKey: settings?.hasDndBeyondCobaltCookie,
      placeholder: 'Your cobalt cookie value',
      docs: '/docs/API_KEYS_SETUP_GUIDE.md',
    },
  ];

  const handleSave = async (keyId: string) => {
    const value = keyValues[keyId];
    if (!value) return;

    try {
      await updateKeys.mutateAsync({
        [keyId]: value,
      });

      setEditingKey(null);
      setKeyValues((prev) => ({ ...prev, [keyId]: '' }));
      await refetch();
    } catch (error) {
      console.error('Error saving API key:', error);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      await deleteKey.mutateAsync({
        keyName: keyId as any,
      });

      await refetch();
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Heading size="8" className="text-white mb-2">
            API Keys
          </Heading>
          <Text size="3" className="text-gray-300">
            Manage your API keys for AI services and integrations. All keys are encrypted at rest.
          </Text>
        </div>

        {/* API Keys List */}
        <div className="grid gap-4">
          {apiKeys.map((key, index) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6">
                <Flex direction="column" gap="4">
                  {/* Header */}
                  <Flex justify="between" align="start">
                    <Flex direction="column" gap="1">
                      <Flex gap="2" align="center">
                        <Heading size="5">{key.name}</Heading>
                        {key.hasKey && <Badge color="green">Configured</Badge>}
                      </Flex>
                      <Text size="2" className="text-gray-400">
                        {key.description}
                      </Text>
                    </Flex>
                    <a
                      href={key.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-violet-400 hover:text-violet-300"
                    >
                      Get API Key →
                    </a>
                  </Flex>

                  {/* Edit/View Mode */}
                  {editingKey === key.id ? (
                    <Flex direction="column" gap="3">
                      <TextField.Root
                        placeholder={key.placeholder}
                        value={keyValues[key.id] || ''}
                        onChange={(e) =>
                          setKeyValues((prev) => ({
                            ...prev,
                            [key.id]: e.target.value,
                          }))
                        }
                        type="password"
                      />
                      <Flex gap="2">
                        <Button
                          color="violet"
                          onClick={() => handleSave(key.id)}
                          disabled={!keyValues[key.id]}
                        >
                          Save
                        </Button>
                        <Button
                          variant="soft"
                          color="gray"
                          onClick={() => {
                            setEditingKey(null);
                            setKeyValues((prev) => ({ ...prev, [key.id]: '' }));
                          }}
                        >
                          Cancel
                        </Button>
                      </Flex>
                    </Flex>
                  ) : (
                    <Flex gap="2" align="center">
                      {key.hasKey ? (
                        <>
                          <Text size="2" className="text-gray-300 font-mono flex-1">
                            {key.masked}
                          </Text>
                          <Button
                            variant="soft"
                            size="2"
                            onClick={() => setEditingKey(key.id)}
                          >
                            Update
                          </Button>
                          <Button
                            variant="soft"
                            color="red"
                            size="2"
                            onClick={() => handleDelete(key.id)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="soft"
                          color="violet"
                          onClick={() => setEditingKey(key.id)}
                        >
                          + Add {key.name}
                        </Button>
                      )}
                    </Flex>
                  )}
                </Flex>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Info Box */}
        <Card className="mt-6 p-6 bg-blue-900/20 border-blue-700/50">
          <Flex direction="column" gap="2">
            <Heading size="4">🔒 Security Notice</Heading>
            <Text size="2" className="text-gray-300">
              All API keys are encrypted using AES-256 encryption before being stored in the
              database. Your keys are never transmitted to our servers in plain text and are only
              decrypted when needed for API calls.
            </Text>
          </Flex>
        </Card>

        {/* Back Button */}
        <div className="mt-8">
          <Button variant="ghost" onClick={() => router.push('/settings')}>
            ← Back to Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
